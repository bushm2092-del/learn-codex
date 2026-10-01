package service

import (
	"errors"
	"mini-codex/backend/internal/model"
	"testing"
)

func TestTalentScoring(t *testing.T) {
	tests := []struct {
		name, game            string
		challenge             storedTalentChallenge
		in                    TalentSubmission
		score, correct, wrong int
		invalid               bool
	}{
		{name: "reaction mean", game: "reaction", in: TalentSubmission{SamplesMS: []int{201, 220, 190, 250, 180}}, score: 208, correct: 5},
		{name: "reaction missing round", game: "reaction", in: TalentSubmission{SamplesMS: []int{200}}, invalid: true},
		{name: "reaction lower boundary", game: "reaction", in: TalentSubmission{SamplesMS: []int{79, 200, 200, 200, 200}}, invalid: true},
		{name: "reaction upper boundary", game: "reaction", in: TalentSubmission{SamplesMS: []int{5001, 200, 200, 200, 200}}, invalid: true},
		{name: "memory failed third", game: "memory", challenge: storedTalentChallenge{TalentChallenge: model.TalentChallenge{Sequence: []int{2, 4, 1}}}, in: TalentSubmission{Answers: []int{2, 2, 4, 2, 0}}, score: 2, correct: 2, wrong: 1},
		{name: "memory partial round", game: "memory", challenge: storedTalentChallenge{TalentChallenge: model.TalentChallenge{Sequence: []int{2, 4, 1}}}, in: TalentSubmission{Answers: []int{2, 2}}, score: 1, correct: 1},
		{name: "memory complete", game: "memory", challenge: storedTalentChallenge{TalentChallenge: model.TalentChallenge{Sequence: []int{2, 4, 1}}}, in: TalentSubmission{Answers: []int{2, 2, 4, 2, 4, 1}}, score: 3, correct: 3},
		{name: "memory trailing after error", game: "memory", challenge: storedTalentChallenge{TalentChallenge: model.TalentChallenge{Sequence: []int{2, 4}}}, in: TalentSubmission{Answers: []int{1, 2}}, invalid: true},
		{name: "reasoning penalty", game: "reasoning", challenge: storedTalentChallenge{Answers: []int{1, 2, 3}}, in: TalentSubmission{Answers: []int{1, 0, 3}}, score: 1, correct: 2, wrong: 1},
		{name: "focus floor", game: "focus", challenge: storedTalentChallenge{Answers: []int{1, 2, 3}}, in: TalentSubmission{Answers: []int{0, 0, 3}}, score: 0, correct: 1, wrong: 2},
		{name: "invalid choice", game: "focus", challenge: storedTalentChallenge{Answers: []int{0}}, in: TalentSubmission{Answers: []int{4}}, invalid: true},
		{name: "extra answers", game: "reasoning", challenge: storedTalentChallenge{Answers: []int{0}}, in: TalentSubmission{Answers: []int{0, 0}}, invalid: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			score, correct, wrong, err := scoreTalent(tc.game, tc.challenge, tc.in)
			if tc.invalid {
				if !errors.Is(err, ErrInvalid) {
					t.Fatalf("expected invalid input, got %v", err)
				}
				return
			}
			if err != nil || score != tc.score || correct != tc.correct || wrong != tc.wrong {
				t.Fatalf("got (%d,%d,%d,%v), want (%d,%d,%d,nil)", score, correct, wrong, err, tc.score, tc.correct, tc.wrong)
			}
		})
	}
}

func TestGeneratedTalentChallenges(t *testing.T) {
	for _, game := range []string{"reaction", "memory", "reasoning", "focus"} {
		c, err := newTalentChallenge(game)
		if err != nil {
			t.Fatal(err)
		}
		if game == "memory" {
			if len(c.Sequence) != 20 {
				t.Fatal("expected 20 memory cells")
			}
			for _, cell := range c.Sequence {
				if cell < 0 || cell > 8 {
					t.Fatal("invalid cell")
				}
			}
		}
		if game == "reasoning" || game == "focus" {
			if len(c.Questions) != 256 || len(c.Answers) != 256 {
				t.Fatal("missing questions")
			}
			for i, q := range c.Questions {
				answer := c.Answers[i]
				if answer < 0 || answer > 3 {
					t.Fatal("invalid answer")
				}
				if game == "focus" {
					if q.Ink != answer || q.Word < 0 || q.Word > 3 {
						t.Fatal("invalid focus question")
					}
					continue
				}
				seen := map[int]bool{}
				for _, choice := range q.Choices {
					if seen[choice] {
						t.Fatal("duplicate option")
					}
					seen[choice] = true
				}
				a, b, c, d := q.Numbers[0], q.Numbers[1], q.Numbers[2], q.Numbers[3]
				next := d + (d - c) + 1
				if b-a == c-b && c-b == d-c {
					next = d + (b - a)
				} else if b == a*2 && c == b*2 && d == c*2 {
					next = d * 2
				} else if c == a+b && d == b+c {
					next = c + d
				}
				if q.Choices[answer] != next {
					t.Fatalf("wrong sequence answer: %v => %v", q.Numbers, q.Choices)
				}
			}
		}
	}
}
