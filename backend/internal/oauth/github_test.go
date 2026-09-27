package oauth

import (
	"context"
	"golang.org/x/oauth2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestGitHubPKCEAndProfile(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/token" {
			_ = r.ParseForm()
			if r.Form.Get("code_verifier") != "verifier" || r.Form.Get("code") != "code" {
				t.Error("missing PKCE verifier")
			}
			_, _ = w.Write([]byte(`{"access_token":"test-token","token_type":"bearer"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing bearer")
		}
		_, _ = w.Write([]byte(`{"id":42,"login":"learner","avatar_url":"https://avatars.example/u/42"}`))
	}))
	defer server.Close()
	g := New("client", "secret", "https://example.com/callback")
	g.Config.Endpoint = oauth2.Endpoint{AuthURL: server.URL + "/authorize", TokenURL: server.URL + "/token"}
	g.ProfileURL = server.URL + "/user"
	target, _ := url.Parse(g.Authorize("state", "verifier"))
	if target.Query().Get("state") != "state" || target.Query().Get("code_challenge_method") != "S256" || target.Query().Get("code_challenge") == "" {
		t.Fatal("missing OAuth protections")
	}
	p, err := g.Profile(context.Background(), "code", "verifier")
	if err != nil || p.ID != 42 || p.Login != "learner" {
		t.Fatalf("%+v %v", p, err)
	}
}
