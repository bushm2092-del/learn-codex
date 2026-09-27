package httpapi

import (
	"github.com/gin-gonic/gin"
	"mini-codex/backend/internal/config"
	"mini-codex/backend/internal/service"
	"net/http/httptest"
	"testing"
)

func TestBoundary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := New(config.Config{FrontendOrigin: "https://learn.example"}, service.New(nil), nil)
	for _, tc := range []struct {
		method, path, origin string
		status               int
	}{
		{"GET", "/healthz", "", 200}, {"GET", "/api/v1/me", "", 401},
		{"POST", "/api/v1/sandbox/jobs", "https://learn.example", 401},
		{"POST", "/api/v1/sandbox/jobs", "https://evil.example", 403},
		{"GET", "/api/v1/sandbox/jobs/unknown", "", 401},
		{"DELETE", "/api/v1/sandbox/jobs/unknown", "https://learn.example", 401},
		{"POST", "/api/v1/auth/logout", "", 403}, {"POST", "/api/v1/auth/logout", "https://evil.example", 403},
		{"POST", "/api/v1/auth/logout", "https://learn.example", 401}, {"GET", "/api/v1/auth/github", "", 503},
		{"GET", "/api/v1/auth/github/callback?state=bad&code=bad", "", 400},
	} {
		t.Run(tc.method+tc.path+tc.origin, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set("Origin", tc.origin)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.status {
				t.Fatalf("got %d want %d: %s", w.Code, tc.status, w.Body.String())
			}
		})
	}
}
