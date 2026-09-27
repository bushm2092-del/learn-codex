package sandbox

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/net/netutil"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// 禁止环境代理、重定向和任意目标；解析后直接拨已校验的公网 IP，TLS 仍验证原域名。
func publicDial(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil || host != "api.deepseek.com" || port != "443" {
		return nil, errors.New("destination rejected")
	}
	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		return nil, err
	}
	for _, ip := range ips {
		if !publicIP(ip) {
			return nil, errors.New("private destination rejected")
		}
	}
	for _, ip := range ips {
		c, e := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		if e == nil {
			return c, nil
		}
	}
	return nil, errors.New("upstream unavailable")
}
func publicIP(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		return false
	}
	for _, s := range []string{"0.0.0.0/8", "100.64.0.0/10", "192.0.0.0/24", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "240.0.0.0/4", "2001:db8::/32"} {
		if netip.MustParsePrefix(s).Contains(ip) {
			return false
		}
	}
	return true
}
func relayHandler(key string, client *http.Client) http.Handler {
	var used atomic.Bool
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Connection", "close")
		if r.Method != "POST" || r.URL.Path != "/chat/completions" || r.URL.RawQuery != "" || r.Host != "api.deepseek.com" {
			http.Error(w, "request rejected", 403)
			return
		}
		if !used.CompareAndSwap(false, true) {
			http.Error(w, "one model request per run", 429)
			return
		}
		if key == "" {
			http.Error(w, "API key required", 401)
			return
		}
		var input struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			Stream    bool `json:"stream"`
			MaxTokens int  `json:"max_tokens"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
		dec.DisallowUnknownFields()
		if dec.Decode(&input) != nil || dec.Decode(new(any)) != io.EOF || input.Stream || input.Model != "deepseek-flash" || len(input.Messages) == 0 || len(input.Messages) > 16 {
			http.Error(w, "invalid request", 400)
			return
		}
		for _, m := range input.Messages {
			if m.Role != "user" && m.Role != "assistant" && m.Role != "system" {
				http.Error(w, "invalid role", 400)
				return
			}
		}
		if input.MaxTokens <= 0 || input.MaxTokens > 256 {
			input.MaxTokens = 256
		}
		body, _ := json.Marshal(input)
		req, _ := http.NewRequestWithContext(r.Context(), "POST", "https://api.deepseek.com/chat/completions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key)
		res, err := client.Do(req)
		if err != nil {
			http.Error(w, "upstream unavailable", 502)
			return
		}
		defer res.Body.Close()
		raw, err := io.ReadAll(io.LimitReader(res.Body, 32769))
		if err != nil || len(raw) > 32768 {
			http.Error(w, "response too large", 502)
			return
		}
		raw = []byte(strings.ReplaceAll(string(raw), key, "[redacted]"))
		w.Header().Set("Content-Length", strconv.Itoa(len(raw)))
		w.WriteHeader(res.StatusCode)
		_, _ = w.Write(raw)
	})
}
func startRelay(ctx context.Context, dir, key string) (func(), error) {
	path := dir + "/http.sock"
	l, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	if err = os.Chmod(path, 0666); err != nil {
		l.Close()
		return nil, err
	}
	transport := &http.Transport{DialContext: publicDial, TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 12 * time.Second, MaxResponseHeaderBytes: 8192, DisableKeepAlives: true}
	client := &http.Client{Transport: transport, Timeout: 12 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	server := &http.Server{Handler: relayHandler(key, client), ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 3 * time.Second, WriteTimeout: 14 * time.Second, MaxHeaderBytes: 4096, BaseContext: func(net.Listener) context.Context { return ctx }}
	go server.Serve(netutil.LimitListener(l, 8))
	return func() { server.Close(); transport.CloseIdleConnections() }, nil
}
