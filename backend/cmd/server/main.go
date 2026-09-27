package main

import (
	"context"
	"errors"
	"log/slog"
	"mini-codex/backend/internal/config"
	"mini-codex/backend/internal/database"
	"mini-codex/backend/internal/httpapi"
	"mini-codex/backend/internal/oauth"
	"mini-codex/backend/internal/repository"
	"mini-codex/backend/internal/service"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("startup_failed", "reason", err.Error())
		os.Exit(1)
	}
}
func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		return errors.New("database connection failed")
	}
	pool, _ := db.DB()
	defer pool.Close()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if len(os.Args) > 1 {
		if os.Args[1] != "migrate" {
			return errors.New("usage: server [migrate]")
		}
		if err = database.Migrate(ctx, db); err != nil {
			return errors.New("database migration failed")
		}
		return nil
	}
	store := repository.New(db)
	api := httpapi.New(cfg, service.New(store), oauth.New(cfg.ClientID, cfg.ClientSecret, cfg.CallbackURL))
	server := &http.Server{Addr: cfg.Addr, Handler: api, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case err = <-done:
			if errors.Is(err, http.ErrServerClosed) {
				return nil
			}
			return err
		case <-ticker.C:
			cleanupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			err = store.Cleanup(cleanupCtx)
			cancel()
			if err != nil {
				slog.Error("session_cleanup_failed")
			}
		case <-ctx.Done():
			shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			return server.Shutdown(shutdown)
		}
	}
}
