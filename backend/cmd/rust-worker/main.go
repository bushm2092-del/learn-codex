// rust-worker 是单独的受信任宿主进程；网站 API 和用户容器均不能访问 Docker socket。
package main

import (
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/net/netutil"
	"log"
	"mini-codex/backend/internal/sandbox"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
func run() error {
	if os.Getenv("RUST_SANDBOX_ENABLED") != "true" {
		return errors.New("sandbox disabled")
	}
	if err := os.MkdirAll("/run/learn-rust-worker", 0755); err != nil {
		return err
	}
	lock, err := os.OpenFile("/run/learn-rust-worker/worker.lock", os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err = syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		return errors.New("worker already running")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	runner := &sandbox.Runner{}
	check, cancel := context.WithTimeout(ctx, 30*time.Second)
	err = runner.Preflight(check)
	cancel()
	if err != nil {
		return err
	}
	if err = os.MkdirAll("/run/learn-rust-relays", 0700); err != nil {
		return err
	}
	queue := sandbox.NewQueue(runner.Execute, runner.Ready)
	done := make(chan struct{})
	go func() { queue.Run(ctx); close(done) }()
	mux := http.NewServeMux()
	mux.HandleFunc("/jobs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		owner, e := strconv.ParseInt(r.Header.Get("X-Learn-User"), 10, 64)
		if e != nil || owner <= 0 {
			http.Error(w, `{"error":"unauthorized"}`, 401)
			return
		}
		var result sandbox.Result
		switch r.Method {
		case "POST":
			var in sandbox.Input
			d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
			d.DisallowUnknownFields()
			if d.Decode(&in) != nil {
				http.Error(w, `{"error":"invalid_input"}`, 400)
				return
			}
			result, e = queue.Submit(owner, in)
		case "GET":
			result, e = queue.Get(owner, r.URL.Query().Get("id"))
		case "DELETE":
			e = queue.Cancel(owner, r.URL.Query().Get("id"))
		default:
			w.WriteHeader(405)
			return
		}
		if e != nil {
			code := 503
			if errors.Is(e, sandbox.ErrBusy) {
				code = 429
			}
			if errors.Is(e, sandbox.ErrMissing) {
				code = 404
			}
			if errors.Is(e, sandbox.ErrInvalid) {
				code = 400
			}
			http.Error(w, `{"error":"`+e.Error()+`"}`, code)
			return
		}
		if r.Method == "DELETE" {
			w.WriteHeader(204)
			return
		}
		json.NewEncoder(w).Encode(result)
	})
	socket := "/run/learn-rust-worker/worker.sock"
	if err = os.MkdirAll("/run/learn-rust-worker", 0755); err != nil {
		return err
	}
	// systemd 保证单实例；仅删除固定的旧 socket，不删除用户路径。
	if err = os.Remove(socket); err != nil && !os.IsNotExist(err) {
		return err
	}
	listener, err := net.Listen("unix", socket)
	if err != nil {
		return err
	}
	defer listener.Close()
	if err = os.Chown(socket, 0, 10001); err != nil {
		return err
	}
	if err = os.Chmod(socket, 0660); err != nil {
		return err
	}
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, MaxHeaderBytes: 4096}
	go func() { <-ctx.Done(); server.Close() }()
	err = server.Serve(netutil.LimitListener(listener, 16))
	stop()
	<-done
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
