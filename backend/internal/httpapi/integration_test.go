package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"mini-codex/backend/internal/config"
	"mini-codex/backend/internal/database"
	"mini-codex/backend/internal/model"
	"mini-codex/backend/internal/oauth"
	"mini-codex/backend/internal/repository"
	"mini-codex/backend/internal/service"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

type testProvider struct{}

func (testProvider) Authorize(state, verifier string) string {
	return "https://github.example/authorize?state=" + state
}
func (testProvider) Profile(context.Context, string, string) (oauth.Profile, error) {
	return oauth.Profile{ID: 123, Login: "test-learner"}, nil
}

func TestPostgresFlow(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL for PostgreSQL integration tests")
	}
	admin, err := database.Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	pool, _ := admin.DB()
	defer pool.Close()
	// 每次测试创建独立 schema，不清空调用方数据库。
	schema := fmt.Sprintf("test_%d", time.Now().UnixNano())
	if err = admin.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	defer admin.Exec("DROP SCHEMA " + schema + " CASCADE")
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db, err := database.Open(u.String())
	if err != nil {
		t.Fatal(err)
	}
	conn, _ := db.DB()
	defer conn.Close()
	if err = database.Migrate(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if err = database.Migrate(context.Background(), db); err != nil {
		t.Fatal("migration not idempotent", err)
	}
	store := repository.New(db)
	svc := service.New(store)
	gin.SetMode(gin.TestMode)
	cfg := config.Config{FrontendOrigin: "http://localhost:4173", ClientID: "test", ClientSecret: "test"}
	router := New(cfg, svc, testProvider{})
	request := func(method, path, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Origin", cfg.FrontendOrigin)
		req.Header.Set("Content-Type", "application/json")
		for _, cookie := range cookies {
			req.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}
	requireStatus := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("got %d want %d: %s", w.Code, status, w.Body.String())
		}
	}
	login := request("GET", "/api/v1/auth/github", "")
	requireStatus(login, 302)
	stateCookie := login.Result().Cookies()[0]
	callback := request("GET", "/api/v1/auth/github/callback?state="+stateCookie.Value+"&code=code", "", stateCookie)
	requireStatus(callback, 302)
	var session *http.Cookie
	for _, c := range callback.Result().Cookies() {
		if c.Name == "learn_session" {
			session = c
		}
	}
	if session == nil || !session.HttpOnly || session.SameSite != http.SameSiteLaxMode {
		t.Fatal("session cookie missing protections")
	}
	requireStatus(request("GET", "/api/v1/auth/github/callback?state="+stateCookie.Value+"&code=code", "", stateCookie), 400)
	me := request("GET", "/api/v1/me", "", session)
	requireStatus(me, 200)
	var user model.User
	_ = json.Unmarshal(me.Body.Bytes(), &user)
	if user.ID == 0 || user.Login != "test-learner" {
		t.Fatal("bad identity", me.Body.String())
	}
	updated := model.User{GitHubID: 123, Login: "renamed-learner"}
	if err = store.UpsertUser(context.Background(), &updated); err != nil || updated.ID != user.ID {
		t.Fatalf("login created a duplicate identity: %+v %v", updated, err)
	}
	comment := request("POST", "/api/v1/chapters/agent-loop/comments", `{"body":"  学到了  "}`, session)
	requireStatus(comment, 201)
	var c model.Comment
	_ = json.Unmarshal(comment.Body.Bytes(), &c)
	if c.ID == 0 || c.Body != "学到了" {
		t.Fatal("comment not persisted", comment.Body.String())
	}
	other := model.User{GitHubID: 456, Login: "other"}
	if err = store.UpsertUser(context.Background(), &other); err != nil {
		t.Fatal(err)
	}
	deleted, err := store.DeleteComment(context.Background(), c.ID, other.ID)
	if err != nil || deleted {
		t.Fatal("deleted another user's comment")
	}
	requireStatus(request("POST", "/api/v1/chapters/agent-loop/comments", `{"body":" "}`, session), 400)
	requireStatus(request("PUT", "/api/v1/chapters/unknown/check-in", "", session), 404)
	for i := 0; i < 2; i++ {
		requireStatus(request("PUT", "/api/v1/chapters/agent-loop/check-in", "", session), 200)
	}
	// 唯一键在并发写入下仍然只计一章。
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, e := svc.CheckIn(context.Background(), user.ID, "context"); e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	ranks, err := store.Leaderboard(context.Background())
	if err != nil || len(ranks) != 1 || ranks[0].Chapters != 2 || ranks[0].Rank != 1 {
		t.Fatalf("bad ranks %+v %v", ranks, err)
	}
	for _, chapter := range []string{"agent-loop", "context"} {
		if _, err = svc.CheckIn(context.Background(), other.ID, chapter); err != nil {
			t.Fatal(err)
		}
	}
	ranks, err = store.Leaderboard(context.Background())
	if err != nil || len(ranks) != 2 || ranks[0].Rank != 1 || ranks[1].Rank != 1 || ranks[0].UserID > ranks[1].UserID {
		t.Fatal("tie ordering", ranks, err)
	}
	// 取消幂等、身份隔离，并实时影响进度和排行榜。
	requireStatus(request("DELETE", "/api/v1/chapters/agent-loop/check-in", ""), 401)
	requireStatus(request("DELETE", "/api/v1/chapters/unknown/check-in", "", session), 404)
	for i := 0; i < 2; i++ {
		requireStatus(request("DELETE", "/api/v1/chapters/agent-loop/check-in", "", session), 204)
	}
	progress, err := store.Progress(context.Background(), user.ID)
	if err != nil || len(progress) != 1 || progress[0].ChapterID != "context" {
		t.Fatal("cancel did not update progress", progress, err)
	}
	ranks, err = store.Leaderboard(context.Background())
	if err != nil || len(ranks) != 2 || ranks[0].UserID != other.ID || ranks[0].Chapters != 2 || ranks[1].Chapters != 1 {
		t.Fatal("cancel affected wrong user or rank", ranks, err)
	}
	requireStatus(request("PUT", "/api/v1/chapters/agent-loop/check-in", "", session), 200)
	view := request("POST", "/api/v1/analytics/views", `{"page":"/lessons/agent-loop"}`)
	requireStatus(view, 204)
	visitor := view.Result().Cookies()[0]
	requireStatus(request("POST", "/api/v1/analytics/views", `{"page":"/lessons/agent-loop"}`, visitor), 204)
	requireStatus(request("POST", "/api/v1/analytics/views", `{"page":"/"}`, visitor), 204)
	stats := request("GET", "/api/v1/analytics/stats", "")
	requireStatus(stats, 200)
	var values model.Stats
	_ = json.Unmarshal(stats.Body.Bytes(), &values)
	if values.PV != 3 || values.UV != 1 {
		t.Fatalf("bad stats %+v", values)
	}
	requireStatus(request("POST", "/api/v1/analytics/views", `{"page":"https://evil.example"}`, visitor), 400)
	requireStatus(request("DELETE", fmt.Sprintf("/api/v1/comments/%d", c.ID), "", session), 204)
	requireStatus(request("POST", "/api/v1/auth/logout", "", session), 204)
	requireStatus(request("GET", "/api/v1/me", "", session), 401)
	var count int64
	db.Model(&model.Session{}).Where("token_hash = ?", session.Value).Count(&count)
	if count != 0 {
		t.Fatal("plaintext token stored")
	}
	if strings.Contains(me.Body.String(), "github_id") {
		t.Fatal("private provider ID exposed")
	}
	// 新路由器隔离限流预算；仍使用真实 PostgreSQL 和完整 HTTP 边界。
	router = New(cfg, svc, testProvider{})
	registered := request("POST", "/api/v1/auth/register", `{"username":"Local_Learner","password":"a-long-test-password"}`)
	requireStatus(registered, 201)
	localSession := registered.Result().Cookies()[0]
	requireStatus(request("GET", "/api/v1/me", "", localSession), 200)
	requireStatus(request("POST", "/api/v1/auth/register", `{"username":"local_learner","password":"a-long-test-password"}`), 409)
	requireStatus(request("POST", "/api/v1/auth/login", `{"username":"local_learner","password":"wrong-password-long"}`), 401)
	requireStatus(request("POST", "/api/v1/auth/login", `{"username":"missing_user","password":"wrong-password-long"}`), 401)
	loggedIn := request("POST", "/api/v1/auth/login", `{"username":"LOCAL_LEARNER","password":"a-long-test-password"}`, localSession)
	requireStatus(loggedIn, 200)
	requireStatus(request("GET", "/api/v1/me", "", localSession), 401)
	newSession := loggedIn.Result().Cookies()[0]
	if newSession.Value == localSession.Value || !newSession.HttpOnly {
		t.Fatal("session not rotated")
	}
	requireStatus(request("GET", "/api/v1/me", "", newSession), 200)
	requireStatus(request("POST", "/api/v1/auth/login", `{"username":"local_learner","password":"a-long-test-password"}`), 429)
	var account model.PasswordAccount
	db.First(&account, "username = ?", "local_learner")
	if account.PasswordHash == "a-long-test-password" || !strings.HasPrefix(account.PasswordHash, "$2") {
		t.Fatal("password not hashed")
	}
	if strings.Contains(registered.Body.String(), "password") {
		t.Fatal("credentials exposed")
	}
	requireStatus(request("POST", "/api/v1/auth/logout", "", newSession), 204)
	requireStatus(request("GET", "/api/v1/me", "", newSession), 401)
}
