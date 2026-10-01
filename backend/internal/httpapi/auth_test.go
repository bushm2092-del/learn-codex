package httpapi

import "testing"

func TestLoginDestination(t *testing.T) {
	for _, next := range []string{
		"/leaderboard", "/lessons/agent-loop", "/talent", "/talent/leaderboard",
		"/talent/reaction", "/talent/memory", "/talent/reasoning", "/talent/focus",
		"/talent/leaderboard?game=reaction", "/talent/leaderboard?game=memory",
		"/talent/leaderboard?game=reasoning", "/talent/leaderboard?game=focus",
	} {
		if got := loginDestination(next); got != next {
			t.Errorf("loginDestination(%q) = %q", next, got)
		}
	}
	for _, next := range []string{
		"", "/", "https://evil.example/talent", "//evil.example", "/\\evil.example",
		"/talented", "/talent/../", "/talent/unknown", "/talent/reaction/",
		"/talent/reaction\n", "/talent/leaderboard?game=unknown", "/talent/leaderboard?game=reaction&next=//evil.example",
		"/talent/leaderboard?game=reaction#other", "%2F%2Fevil.example",
	} {
		if got := loginDestination(next); got != "/" {
			t.Errorf("unsafe loginDestination(%q) = %q", next, got)
		}
	}
}
