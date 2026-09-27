package service

import (
	"strings"
	"testing"
)

func TestValidateCredentials(t *testing.T) {
	username, err := ValidateCredentials(" Learner_1 ", "long-password-123")
	if err != nil || username != "learner_1" {
		t.Fatal(username, err)
	}
	for _, pair := range [][2]string{
		{"ab", "long-password-123"}, {"bad name", "long-password-123"}, {"learner", "short"},
		{"learner", strings.Repeat("x", 73)}, {"learner", strings.Repeat("中", 25)},
	} {
		if _, err := ValidateCredentials(pair[0], pair[1]); err == nil {
			t.Fatal("accepted invalid input")
		}
	}
}
