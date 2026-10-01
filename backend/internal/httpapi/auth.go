package httpapi

import (
	"crypto/subtle"
	"errors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"mini-codex/backend/internal/model"
	"mini-codex/backend/internal/service"
	"time"
)

func (a *API) login(c *gin.Context) {
	if a.cfg.ClientID == "" || a.cfg.ClientSecret == "" {
		c.JSON(503, gin.H{"error": "github_login_not_configured"})
		return
	}
	state, err := service.Token()
	if err != nil {
		a.fail(c, err)
		return
	}
	verifier, err := service.Token()
	if err != nil {
		a.fail(c, err)
		return
	}
	err = a.svc.Store.SaveState(c.Request.Context(), model.OAuthState{StateHash: service.Hash(state), Verifier: verifier, ExpiresAt: time.Now().Add(10 * time.Minute)})
	if err != nil {
		a.fail(c, err)
		return
	}
	a.cookie(c, "learn_oauth", state, "/api/v1/auth/github", 600)
	a.cookie(c, "learn_oauth_next", loginDestination(c.Query("next")), "/api/v1/auth/github", 600)
	c.Redirect(302, a.provider.Authorize(state, verifier))
}
func (a *API) callback(c *gin.Context) {
	cookie, err := c.Cookie("learn_oauth")
	state := c.Query("state")
	code := c.Query("code")
	next, _ := c.Cookie("learn_oauth_next")
	a.cookie(c, "learn_oauth", "", "/api/v1/auth/github", -1)
	a.cookie(c, "learn_oauth_next", "", "/api/v1/auth/github", -1)
	if err != nil || len(state) != 64 || subtle.ConstantTimeCompare([]byte(cookie), []byte(state)) != 1 || code == "" {
		c.JSON(400, gin.H{"error": "invalid_oauth_state"})
		return
	}
	saved, err := a.svc.Store.ConsumeState(c.Request.Context(), service.Hash(state))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(400, gin.H{"error": "expired_oauth_state"})
		} else {
			a.fail(c, err)
		}
		return
	}
	profile, err := a.provider.Profile(c.Request.Context(), code, saved.Verifier)
	if err != nil {
		c.JSON(502, gin.H{"error": "github_login_failed"})
		return
	}
	user := model.User{GitHubID: profile.ID, Login: profile.Login, AvatarURL: profile.AvatarURL}
	if err = a.svc.Store.UpsertUser(c.Request.Context(), &user); err != nil {
		a.fail(c, err)
		return
	}
	if err = a.startSession(c, user.ID); err != nil {
		a.fail(c, err)
		return
	}
	c.Redirect(302, a.cfg.FrontendOrigin+loginDestination(next))
}

// OAuth 开始和回调均校验固定站内路径，拒绝外站、协议相对地址和任意查询参数。
func loginDestination(next string) string {
	switch next {
	case "/leaderboard", "/lessons/agent-loop", "/talent", "/talent/leaderboard",
		"/talent/reaction", "/talent/memory", "/talent/reasoning", "/talent/focus":
		return next
	}
	for _, game := range []string{"reaction", "memory", "reasoning", "focus"} {
		if next == "/talent/leaderboard?game="+game {
			return next
		}
	}
	return "/"
}

func (a *API) logout(c *gin.Context) {
	token, _ := c.Cookie("learn_session")
	if err := a.svc.Store.DeleteSession(c.Request.Context(), service.Hash(token)); err != nil {
		a.fail(c, err)
		return
	}
	a.cookie(c, "learn_session", "", "/", -1)
	c.Status(204)
}
