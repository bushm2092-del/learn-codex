package httpapi

import (
	"context"
	"github.com/gin-gonic/gin"
	"io"
	"mini-codex/backend/internal/config"
	"mini-codex/backend/internal/model"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestSandboxProxyAndDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	socket := filepath.Join(t.TempDir(), "worker.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Learn-User") != "42" || r.URL.Path != "/jobs" {
			t.Error("untrusted identity or path")
		}
		b, _ := io.ReadAll(r.Body)
		if string(b) != `{"source":"fn main(){}"}` {
			t.Error("body changed")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"id":"test","state":"queued"}`))
	})}
	go server.Serve(listener)
	defer server.Shutdown(context.Background())
	for _, enabled := range []bool{false, true} {
		cfg := config.Config{}
		if enabled {
			cfg.SandboxSocket = socket
		}
		a := &API{cfg: cfg}
		r := gin.New()
		r.POST("/sandbox/jobs", func(c *gin.Context) { c.Set("user", model.User{ID: 42}); a.sandbox(c) })
		req := httptest.NewRequest("POST", "/sandbox/jobs", strings.NewReader(`{"source":"fn main(){}"}`))
		req.Header.Set("X-Learn-User", "999")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		want := 503
		if enabled {
			want = 200
		}
		if w.Code != want {
			t.Fatal(w.Code, w.Body.String())
		}
	}
}
