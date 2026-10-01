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
	"mini-codex/backend/internal/repository"
	"mini-codex/backend/internal/service"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"
)

func TestTalentPostgresFlow(t *testing.T) {
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
	schema := fmt.Sprintf("talent_test_%d", time.Now().UnixNano())
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
	users := []model.User{{Login: "talent_one", GitHubID: 991}, {Login: "talent_two", GitHubID: 992}}
	if err = db.Create(&users).Error; err != nil {
		t.Fatal(err)
	}
	tokens := []string{"talent-test-token-one", "talent-test-token-two"}
	for i, user := range users {
		if err = db.Create(&model.Session{TokenHash: service.Hash(tokens[i]), UserID: user.ID, ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	gin.SetMode(gin.TestMode)
	router := New(config.Config{FrontendOrigin: "http://localhost:4174"}, service.New(repository.New(db)), nil)
	request := func(method, path, body string, user int) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Origin", "http://localhost:4174")
		req.Header.Set("Content-Type", "application/json")
		if user >= 0 {
			req.AddCookie(&http.Cookie{Name: "learn_session", Value: tokens[user]})
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}
	status := func(w *httptest.ResponseRecorder, want int) {
		t.Helper()
		if w.Code != want {
			t.Fatalf("got %d want %d: %s", w.Code, want, w.Body.String())
		}
	}
	start := func(game string, user int) string {
		t.Helper()
		w := request("POST", "/api/v1/talent/"+game+"/attempts", "{}", user)
		status(w, 201)
		var out struct {
			ID        string          `json:"id"`
			Challenge json.RawMessage `json:"challenge"`
		}
		if err = json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		if bytes.Contains(out.Challenge, []byte("answers")) {
			t.Fatal("answer key exposed")
		}
		if game == "memory" {
			var challenge model.TalentChallenge
			if err := json.Unmarshal(out.Challenge, &challenge); err != nil {
				t.Fatal(err)
			}
			if len(challenge.Sequences) != 20 || len(challenge.Sequence) != 0 {
				t.Fatal("memory API must return independent sequences")
			}
			for i, sequence := range challenge.Sequences {
				if len(sequence) != i+1 {
					t.Fatalf("incorrect memory level %d length", i+1)
				}
			}
		}
		return out.ID
	}
	finish := func(game, id, body string, user int) model.TalentResult {
		t.Helper()
		w := request("POST", "/api/v1/talent/"+game+"/attempts/"+id+"/result", body, user)
		status(w, 200)
		var out model.TalentResult
		if err = json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	board := func(game string, user int) model.TalentBoard {
		t.Helper()
		w := request("GET", "/api/v1/talent/"+game+"/leaderboard", "", user)
		status(w, 200)
		var out model.TalentBoard
		if err = json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	status(request("POST", "/api/v1/talent/reaction/attempts", "{}", -1), 401)
	status(request("GET", "/api/v1/talent/reaction/leaderboard", "", -1), 401)
	status(request("POST", "/api/v1/talent/unknown/attempts", "{}", 0), 400)
	if empty := board("memory", 0); empty.Own != nil || len(empty.Items) != 0 {
		t.Fatal("expected empty board")
	}
	id := start("reaction", 0)
	reactionID := id
	status(request("POST", "/api/v1/talent/reaction/attempts/"+id+"/result", `{"samples_ms":[200,200,200,200,200]}`, 1), 404)
	status(request("POST", "/api/v1/talent/reaction/attempts/"+id+"/result", `{"samples_ms":[1,1,1,1,1]}`, 0), 400)
	result := finish("reaction", id, `{"samples_ms":[210,200,190,230,170],"score":1}`, 0)
	if result.Score != 200 {
		t.Fatalf("client score used: %+v", result)
	}
	var wg sync.WaitGroup
	responses := make(chan *httptest.ResponseRecorder, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			responses <- request("POST", "/api/v1/talent/reaction/attempts/"+id+"/result", `{"samples_ms":[100,100,100,100,100]}`, 0)
		}()
	}
	wg.Wait()
	close(responses)
	for w := range responses {
		status(w, 200)
		var row model.TalentResult
		json.Unmarshal(w.Body.Bytes(), &row)
		if row.ID != result.ID || row.Score != 200 {
			t.Fatal("retry changed immutable score")
		}
	}
	finish("reaction", start("reaction", 0), `{"samples_ms":[300,300,300,300,300]}`, 0)
	finish("reaction", start("reaction", 1), `{"samples_ms":[200,200,200,200,200]}`, 1)
	ranks := board("reaction", 0)
	if len(ranks.Items) != 2 || ranks.Items[0].Rank != 1 || ranks.Items[1].Rank != 1 || ranks.Own.Score != 200 {
		t.Fatalf("incorrect best/tie: %+v", ranks)
	}
	for _, game := range []string{"memory", "reasoning", "focus"} {
		id = start(game, 0)
		var attempt model.TalentAttempt
		db.First(&attempt, "id = ?", id)
		var challenge struct {
			Sequences [][]int `json:"sequences"`
			Answers   []int   `json:"answers"`
		}
		json.Unmarshal([]byte(attempt.Challenge), &challenge)
		answers := challenge.Answers[:0]
		if game == "memory" {
			answers = append(answers, challenge.Sequences[0]...)
			answers = append(answers, challenge.Sequences[1]...)
		} else {
			answers = challenge.Answers[:3]
			status(request("POST", "/api/v1/talent/"+game+"/attempts/"+id+"/result", `{"answers":[0]}`, 0), 400)
			db.Model(&model.TalentAttempt{}).Where("id = ?", id).Update("created_at", time.Now().Add(-61*time.Second))
		}
		payload, _ := json.Marshal(service.TalentSubmission{Answers: answers})
		row := finish(game, id, string(payload), 0)
		want := 3
		if game == "memory" {
			want = 2
		}
		if row.Score != want {
			t.Fatalf("wrong %s score: %+v", game, row)
		}
		ranks = board(game, 0)
		if len(ranks.Items) != 1 || ranks.Own.Score != want {
			t.Fatalf("game boards mixed: %+v", ranks)
		}
	}
	expired := start("reaction", 0)
	db.Model(&model.TalentAttempt{}).Where("id = ?", expired).Update("created_at", time.Now().Add(-11*time.Minute))
	status(request("POST", "/api/v1/talent/reaction/attempts/"+expired+"/result", `{"samples_ms":[200,200,200,200,200]}`, 0), 410)
	db.Model(&model.TalentAttempt{}).Where("id = ?", reactionID).Update("created_at", time.Now().Add(-11*time.Minute))
	if retry := finish("reaction", reactionID, `{}`, 0); retry.ID != result.ID {
		t.Fatal("expired retry lost stored result")
	}
	db.Model(&model.TalentAttempt{}).Where("id IN ?", []string{expired, reactionID}).Update("created_at", time.Now().Add(-25*time.Hour))
	if err := repository.New(db).Cleanup(context.Background()); err != nil {
		t.Fatal(err)
	}
	status(request("POST", "/api/v1/talent/reaction/attempts/"+expired+"/result", `{}`, 0), 404)
	if retry := finish("reaction", reactionID, `{}`, 0); retry.ID != result.ID {
		t.Fatal("cleanup removed completed attempt")
	}
}
