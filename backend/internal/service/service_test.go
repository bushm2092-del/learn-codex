package service

import (
	"strings"
	"testing"
	"time"
)

func TestValidateComment(t *testing.T) {
	for _, body := range []string{"", "  ", strings.Repeat("中", 2001), "a\x00b", string([]byte{0xff})} {
		if _, err := ValidateComment(body); err == nil {
			t.Fatalf("accepted invalid comment")
		}
	}
	got, err := ValidateComment("  好的  ")
	if err != nil || got != "好的" {
		t.Fatalf("trim: %q %v", got, err)
	}
	if _, err = ValidateComment(strings.Repeat("中", 2000)); err != nil {
		t.Fatal(err)
	}
}
func TestDateRange(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	a, b, err := DateRange("", "", now)
	if err != nil || a != "2026-08-29" || b != "2026-09-27" {
		t.Fatalf("%s %s %v", a, b, err)
	}
	for _, pair := range [][2]string{{"invalid", "2026-01-01"}, {"2026-02-01", "2026-01-01"}, {"2024-01-01", "2026-01-01"}} {
		if _, _, err = DateRange(pair[0], pair[1], now); err == nil {
			t.Fatal("invalid range accepted")
		}
	}
}
func TestToken(t *testing.T) {
	a, err := Token()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := Token()
	if len(a) != 64 || a == b || a == Hash(a) || len(Hash(a)) != 64 {
		t.Fatal("invalid token")
	}
}
