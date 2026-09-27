package httpapi

import (
	"errors"
	"github.com/gin-gonic/gin"
	"mini-codex/backend/internal/model"
	"mini-codex/backend/internal/service"
	"time"
)

func (a *API) passwordAuth(register bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if c.ShouldBindJSON(&input) != nil {
			c.JSON(400, gin.H{"error": "invalid_input"})
			return
		}
		var user model.User
		var err error
		if register {
			user, err = a.svc.Register(c.Request.Context(), input.Username, input.Password)
		} else {
			user, err = a.svc.PasswordLogin(c.Request.Context(), input.Username, input.Password)
		}
		switch {
		case errors.Is(err, service.ErrCredentials):
			c.JSON(401, gin.H{"error": "invalid_credentials"})
			return
		case errors.Is(err, service.ErrUsernameTaken):
			c.JSON(409, gin.H{"error": "username_taken"})
			return
		case err != nil:
			a.fail(c, err)
			return
		}
		if err = a.startSession(c, user.ID); err != nil {
			a.fail(c, err)
			return
		}
		status := 200
		if register {
			status = 201
		}
		c.JSON(status, user)
	}
}

// 两种登录方式共用会话：每次登录签发新令牌，不复用浏览器提供的值。
func (a *API) startSession(c *gin.Context, userID int64) error {
	token, err := service.Token()
	if err != nil {
		return err
	}
	if err = a.svc.Store.CreateSession(c.Request.Context(), model.Session{TokenHash: service.Hash(token), UserID: userID, ExpiresAt: time.Now().Add(7 * 24 * time.Hour)}); err != nil {
		return err
	}
	if old, e := c.Cookie("learn_session"); e == nil {
		_ = a.svc.Store.DeleteSession(c.Request.Context(), service.Hash(old))
	}
	a.cookie(c, "learn_session", token, "/", 7*24*3600)
	return nil
}
