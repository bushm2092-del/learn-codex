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

const maxModelRequestsPerRun int32 = 3

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
	var requests atomic.Int32
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Connection", "close")
		if r.Method != "POST" || r.URL.Path != "/responses" || r.URL.RawQuery != "" || r.Host != "api.deepseek.com" {
			http.Error(w, "request rejected", 403)
			return
		}
		// 请求字段随模型协议演进，不在 relay 重复维护白名单；这里只校验沙箱的
		// 固定目标、模型、非流式请求和预算，其余 JSON 原样转发给 DeepSeek。
		var input map[string]json.RawMessage
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
		if dec.Decode(&input) != nil || dec.Decode(new(any)) != io.EOF {
			http.Error(w, "invalid request", 400)
			return
		}
		var model string
		var stream bool
		var inputText string
		var inputItems []json.RawMessage
		inputIsText := json.Unmarshal(input["input"], &inputText) == nil && inputText != ""
		inputIsItems := json.Unmarshal(input["input"], &inputItems) == nil && len(inputItems) > 0 && len(inputItems) <= 16
		if json.Unmarshal(input["model"], &model) != nil || model != "deepseek-flash" ||
			(input["stream"] != nil && json.Unmarshal(input["stream"], &stream) != nil) || stream ||
			(!inputIsText && !inputIsItems) {
			http.Error(w, "invalid request", 400)
			return
		}
		var maxTokens int
		if input["max_output_tokens"] != nil && json.Unmarshal(input["max_output_tokens"], &maxTokens) != nil {
			http.Error(w, "invalid max_output_tokens", 400)
			return
		}
		if maxTokens <= 0 || maxTokens > 256 {
			input["max_output_tokens"] = json.RawMessage("256")
		}
		// 先有界读取完整请求体，再返回预算或鉴权错误，避免 bridge 仍在写请求体时
		// Unix socket 被提前关闭并把 429/401 错误转换成 502 broken pipe。
		if requests.Add(1) > maxModelRequestsPerRun {
			http.Error(w, "model request budget exceeded", 429)
			return
		}
		if key == "" {
			http.Error(w, "API key required", 401)
			return
		}
		body, _ := json.Marshal(input)
		req, _ := http.NewRequestWithContext(r.Context(), "POST", "https://api.deepseek.com/responses", bytes.NewReader(body))
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
	transport := &http.Transport{DialContext: publicDial, TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 23 * time.Second, MaxResponseHeaderBytes: 8192, DisableKeepAlives: true}
	client := &http.Client{Transport: transport, Timeout: 25 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	server := &http.Server{Handler: relayHandler(key, client), ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 3 * time.Second, WriteTimeout: 27 * time.Second, MaxHeaderBytes: 4096, BaseContext: func(net.Listener) context.Context { return ctx }}
	go server.Serve(netutil.LimitListener(l, 8))
	return func() { server.Close(); transport.CloseIdleConnections() }, nil
}
