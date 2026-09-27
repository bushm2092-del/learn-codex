package sandbox

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"
)

func TestQueueBoundsAndOwnership(t *testing.T) {
	q := NewQueue(nil, func() bool { return false })
	first, err := q.Submit(1, Input{Source: "fn main() {}"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = q.Get(2, first.ID); !errors.Is(err, ErrMissing) {
		t.Fatal("cross-user read")
	}
	if err = q.Cancel(2, first.ID); !errors.Is(err, ErrMissing) {
		t.Fatal("cross-user cancel")
	}
	if _, err = q.Submit(1, Input{Source: "x"}); !errors.Is(err, ErrBusy) {
		t.Fatal("duplicate admission")
	}
	for i := int64(2); i <= 5; i++ {
		q.next = time.Time{}
		if _, err = q.Submit(i, Input{Source: "x"}); err != nil {
			t.Fatal(err)
		}
	}
	q.next = time.Time{}
	if _, err = q.Submit(6, Input{Source: "x"}); !errors.Is(err, ErrBusy) {
		t.Fatal("queue unbounded")
	}
	if err = q.Cancel(1, first.ID); err != nil {
		t.Fatal(err)
	}
	if q.jobs[first.ID].input.Source != "" {
		t.Fatal("cancel retains input")
	}
	for _, j := range q.pending {
		j.created = time.Now().Add(-3 * time.Minute)
	}
	q.prune(time.Now())
	if len(q.pending) != 0 {
		t.Fatal("queue TTL")
	}
	if _, err = q.Submit(7, Input{Source: strings.Repeat("a", 12289)}); !errors.Is(err, ErrInvalid) {
		t.Fatal("source cap")
	}
}
func TestQueueSerialCancellation(t *testing.T) {
	started := make(chan string, 2)
	release := make(chan struct{})
	q := NewQueue(func(ctx context.Context, id string, in Input) (string, error) {
		started <- id
		<-ctx.Done()
		<-release
		return "", ctx.Err()
	}, func() bool { return true })
	first, _ := q.Submit(1, Input{Source: "one"})
	q.next = time.Time{}
	second, _ := q.Submit(2, Input{Source: "two"})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { q.Run(ctx); close(done) }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("worker not started")
	}
	q.Cancel(1, first.ID)
	select {
	case <-started:
		t.Fatal("released slot before cleanup")
	case <-time.After(300 * time.Millisecond):
	}
	close(release)
	select {
	case id := <-started:
		if id != second.ID {
			t.Fatal(id)
		}
	case <-time.After(time.Second):
		t.Fatal("second missing")
	}
	cancel()
	<-done
}
func TestIsolationArgs(t *testing.T) {
	args := strings.Join(containerArgs("generated", "/run/generated"), " ")
	for _, s := range []string{"--runtime=learn-rust", "--network=none", "--read-only", "--memory=1g", "--memory-swap=1g", "--pids-limit=64", "--cap-drop=ALL", "--log-driver=none", "--user=65534:65534"} {
		if !strings.Contains(args, s) {
			t.Fatal(s)
		}
	}
	for _, s := range []string{"--privileged", "docker.sock", "--network=host"} {
		if strings.Contains(args, s) {
			t.Fatal(s)
		}
	}
}
func TestPublicIPs(t *testing.T) {
	for _, s := range []string{"127.0.0.1", "10.1.1.1", "169.254.169.254", "100.100.100.200", "::1", "::ffff:127.0.0.1", "fc00::1"} {
		if publicIP(netip.MustParseAddr(s)) {
			t.Fatal(s)
		}
	}
	if !publicIP(netip.MustParseAddr("8.8.8.8")) {
		t.Fatal("public IP rejected")
	}
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestRelayRestrictsAndRedacts(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.String() != "https://api.deepseek.com/chat/completions" || r.Header.Get("Authorization") != "Bearer test-secret" {
			t.Fatal("wrong upstream")
		}
		b, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(b), `"max_tokens":256`) {
			t.Fatal("token cap")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"answer":"test-secret"}`)), Header: http.Header{}}, nil
	})}
	h := relayHandler("test-secret", client)
	send := func(path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, strings.NewReader(body))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if send("http://169.254.169.254/latest/meta-data", `{}`).Code != 403 {
		t.Fatal("arbitrary destination")
	}
	body := `{"model":"deepseek-flash","messages":[{"role":"user","content":"hello"}],"max_tokens":9999}`
	w := send("http://api.deepseek.com/chat/completions", body)
	if w.Code != 200 || strings.Contains(w.Body.String(), "test-secret") {
		t.Fatal(w.Body.String())
	}
	if send("http://api.deepseek.com/chat/completions", body).Code != 429 || calls != 1 {
		t.Fatal("request budget")
	}
}
