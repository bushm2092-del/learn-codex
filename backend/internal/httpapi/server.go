package httpapi

import (
	"context"
	"errors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"io"
	"log/slog"
	"mini-codex/backend/internal/config"
	"mini-codex/backend/internal/model"
	"mini-codex/backend/internal/oauth"
	"mini-codex/backend/internal/service"
	"net/http"
	"time"
)

type API struct {
	cfg      config.Config
	svc      *service.Service
	provider oauth.Provider
}

func New(cfg config.Config, svc *service.Service, provider oauth.Provider) *gin.Engine {
	a := &API{cfg: cfg, svc: svc, provider: provider}
	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.Use(gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, _ any) {
		slog.Error("http_panic")
		c.AbortWithStatusJSON(500, gin.H{"error": "internal_error"})
	}), a.boundary(), newLimiter())
	r.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.GET("/readyz", func(c *gin.Context) {
		db, err := svc.Store.DB.DB()
		if err == nil {
			err = db.PingContext(c.Request.Context())
		}
		if err != nil {
			c.JSON(503, gin.H{"error": "database_unavailable"})
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})
	v := r.Group("/api/v1")
	v.GET("/auth/github", a.login)
	v.GET("/auth/github/callback", a.callback)
	v.GET("/chapters", a.chapters)
	v.GET("/chapters/:chapter/comments", a.comments)
	v.GET("/leaderboard", a.leaderboard)
	v.POST("/analytics/views", a.view)
	v.GET("/analytics/stats", a.stats)
	protected := v.Group("")
	protected.Use(a.authenticate)
	protected.GET("/me", func(c *gin.Context) { c.JSON(200, c.MustGet("user")) })
	protected.POST("/auth/logout", a.logout)
	protected.GET("/me/check-ins", a.progress)
	protected.POST("/chapters/:chapter/comments", a.comment)
	protected.DELETE("/comments/:id", a.deleteComment)
	protected.PUT("/chapters/:chapter/check-in", a.checkIn)
	return r
}
func (a *API) boundary() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Cache-Control", "no-store")
		c.Header("Referrer-Policy", "no-referrer")
		origin := c.GetHeader("Origin")
		if origin != "" && origin != a.cfg.FrontendOrigin {
			c.AbortWithStatusJSON(403, gin.H{"error": "origin_rejected"})
			return
		}
		if origin == a.cfg.FrontendOrigin {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(204)
			return
		}
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead && origin != a.cfg.FrontendOrigin {
			c.AbortWithStatusJSON(403, gin.H{"error": "origin_required"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
		c.Next()
		// 不记录原始 URI，避免 OAuth code 和 state 进入日志。
		slog.Info("http_request", "method", c.Request.Method, "route", c.FullPath(), "status", c.Writer.Status(), "duration_ms", time.Since(start).Milliseconds())
	}
}
func (a *API) cookie(c *gin.Context, name, value, path string, age int) {
	http.SetCookie(c.Writer, &http.Cookie{Name: name, Value: value, Path: path, MaxAge: age, HttpOnly: true, Secure: a.cfg.SecureCookies, SameSite: http.SameSiteLaxMode})
}
func (a *API) authenticate(c *gin.Context) {
	token, err := c.Cookie("learn_session")
	if err != nil {
		c.AbortWithStatusJSON(401, gin.H{"error": "login_required"})
		return
	}
	user, err := a.svc.Store.UserForSession(c.Request.Context(), service.Hash(token))
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			a.fail(c, err)
			c.Abort()
			return
		}
		c.AbortWithStatusJSON(401, gin.H{"error": "login_required"})
		return
	}
	c.Set("user", user)
	c.Next()
}
func userID(c *gin.Context) int64 { return c.MustGet("user").(model.User).ID }
func (a *API) fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalid):
		c.JSON(400, gin.H{"error": "invalid_input"})
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(404, gin.H{"error": "not_found"})
	default:
		slog.Error("request_failed", "route", c.FullPath())
		c.JSON(500, gin.H{"error": "internal_error"})
	}
}
