package config

import "testing"

func TestLoad(t *testing.T) {
	t.Setenv("GITHUB_CLIENT_ID", "")
	t.Setenv("GITHUB_CLIENT_SECRET", "")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("COOKIE_SECURE", "true")
	t.Setenv("FRONTEND_ORIGIN", "http://localhost:4173")
	t.Setenv("GITHUB_CALLBACK_URL", "http://localhost:8080/api/v1/auth/github/callback")
	if _, err := Load(); err == nil {
		t.Fatal("insecure public URLs accepted")
	}
	t.Setenv("COOKIE_SECURE", "false")
	if _, err := Load(); err != nil {
		t.Fatal(err)
	}
	t.Setenv("COOKIE_SECURE", "flase")
	if _, err := Load(); err == nil {
		t.Fatal("misspelled security setting accepted")
	}
	t.Setenv("COOKIE_SECURE", "false")
	t.Setenv("FRONTEND_ORIGIN", "http://localhost:4173/extra")
	if _, err := Load(); err == nil {
		t.Fatal("origin with path accepted")
	}
}
