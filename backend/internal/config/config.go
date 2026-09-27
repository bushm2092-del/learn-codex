package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	SandboxSocket                                                          string
	Addr, DatabaseURL, FrontendOrigin, CallbackURL, ClientID, ClientSecret string
	SecureCookies                                                          bool
}

func Load() (Config, error) {
	secure, parseErr := strconv.ParseBool(env("COOKIE_SECURE", "true"))
	if parseErr != nil {
		return Config{}, fmt.Errorf("COOKIE_SECURE must be true or false")
	}
	c := Config{Addr: env("HTTP_ADDR", ":8080"), DatabaseURL: os.Getenv("DATABASE_URL"), FrontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:4173"), CallbackURL: env("GITHUB_CALLBACK_URL", "http://localhost:8080/api/v1/auth/github/callback"), ClientID: os.Getenv("GITHUB_CLIENT_ID"), ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"), SecureCookies: env("COOKIE_SECURE", "true") == "true"}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	c.SecureCookies = secure
	c.SandboxSocket = os.Getenv("RUST_SANDBOX_SOCKET")
	if c.SandboxSocket != "" && c.SandboxSocket != "/run/learn-rust-worker/worker.sock" {
		return c, fmt.Errorf("invalid sandbox socket")
	}
	if (c.ClientID == "") != (c.ClientSecret == "") {
		return c, fmt.Errorf("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured together")
	}
	for _, value := range []string{c.FrontendOrigin, c.CallbackURL} {
		u, err := url.Parse(value)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return c, fmt.Errorf("invalid public URL configuration")
		}
		if c.SecureCookies && u.Scheme != "https" {
			return c, fmt.Errorf("secure cookies require HTTPS public URLs; set COOKIE_SECURE=false only for local development")
		}
	}
	u, _ := url.Parse(c.FrontendOrigin)
	if u.Path != "" {
		return c, fmt.Errorf("FRONTEND_ORIGIN must be an origin without a path or trailing slash")
	}
	if strings.Contains(c.Addr, "\n") {
		return c, fmt.Errorf("invalid HTTP_ADDR")
	}
	return c, nil
}
func env(key, fallback string) string {
	if s := os.Getenv(key); s != "" {
		return s
	}
	return fallback
}
