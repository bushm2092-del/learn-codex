package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"io"
	"net/http"
	"time"
)

type Profile struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

// 协议边界允许测试注入本地 OAuth 服务，不将 GitHub token 传播到业务层。
type Provider interface {
	Authorize(state, verifier string) string
	Profile(context.Context, string, string) (Profile, error)
}
type GitHub struct {
	Config     oauth2.Config
	Client     *http.Client
	ProfileURL string
}

func New(id, secret, callback string) *GitHub {
	return &GitHub{Config: oauth2.Config{ClientID: id, ClientSecret: secret, RedirectURL: callback, Endpoint: github.Endpoint}, Client: &http.Client{Timeout: 10 * time.Second}, ProfileURL: "https://api.github.com/user"}
}
func (g *GitHub) Authorize(state, verifier string) string {
	return g.Config.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
}
func (g *GitHub) Profile(ctx context.Context, code, verifier string) (Profile, error) {
	var p Profile
	ctx = context.WithValue(ctx, oauth2.HTTPClient, g.Client)
	token, err := g.Config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return p, errors.New("github token exchange failed")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.ProfileURL, nil)
	if err != nil {
		return p, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "learn-codex")
	res, err := g.Client.Do(req)
	if err != nil {
		return p, errors.New("github profile unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return p, errors.New("github profile rejected")
	}
	if err = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&p); err != nil {
		return p, err
	}
	if p.ID <= 0 || p.Login == "" {
		return p, errors.New("invalid github identity")
	}
	return p, nil
}
