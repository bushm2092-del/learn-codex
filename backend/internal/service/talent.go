package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"gorm.io/gorm"
	"math/big"
	"mini-codex/backend/internal/model"
	"time"
)

var ErrAttemptExpired = errors.New("talent attempt expired")

func ValidTalentGame(game string) bool {
	return game == "reaction" || game == "memory" || game == "reasoning" || game == "focus"
}

type storedTalentChallenge struct {
	model.TalentChallenge
	Answers []int `json:"answers,omitempty"`
}

type TalentSubmission struct {
	SamplesMS []int `json:"samples_ms"`
	Answers   []int `json:"answers"`
}

func talentRandom(n int) (int, error) {
	x, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0, err
	}
	return int(x.Int64()), nil
}

func newTalentChallenge(game string) (storedTalentChallenge, error) {
	c := storedTalentChallenge{}
	if game == "memory" {
		for i := 0; i < 20; i++ {
			cell, err := talentRandom(9)
			if err != nil {
				return c, err
			}
			c.Sequence = append(c.Sequence, cell)
		}
	}
	if game == "reasoning" || game == "focus" {
		for i := 0; i < 256; i++ {
			kind, err := talentRandom(4)
			if err != nil {
				return c, err
			}
			a, err := talentRandom(8)
			if err != nil {
				return c, err
			}
			b, err := talentRandom(4)
			if err != nil {
				return c, err
			}
			q := model.TalentQuestion{}
			answer := kind
			if game == "focus" {
				q.Word = a % 4
				q.Ink = kind
			} else {
				start, step := a+1, b+2
				next := 0
				switch kind {
				case 0:
					q.Numbers = []int{start, start + step, start + 2*step, start + 3*step}
					next = start + 4*step
				case 1:
					q.Numbers = []int{start, start * 2, start * 4, start * 8}
					next = start * 16
				case 2:
					q.Numbers = []int{start, start + step, start + 2*step + 1, start + 3*step + 3}
					next = start + 4*step + 6
				case 3:
					q.Numbers = []int{start, start + step, 2*start + step, 3*start + 2*step}
					next = 5*start + 3*step
				}
				answer, err = talentRandom(4)
				if err != nil {
					return c, err
				}
				// 四个候选项互不重复，正确答案的位置随机。
				q.Choices = []int{next - 2, next - 1, next + 1, next + 2}
				q.Choices[answer] = next
			}
			c.Questions = append(c.Questions, q)
			c.Answers = append(c.Answers, answer)
		}
	}
	return c, nil
}

func (s *Service) StartTalent(ctx context.Context, user int64, game string) (model.TalentAttempt, model.TalentChallenge, error) {
	if !ValidTalentGame(game) {
		return model.TalentAttempt{}, model.TalentChallenge{}, ErrInvalid
	}
	challenge, err := newTalentChallenge(game)
	if err != nil {
		return model.TalentAttempt{}, model.TalentChallenge{}, err
	}
	id, err := Token()
	if err != nil {
		return model.TalentAttempt{}, model.TalentChallenge{}, err
	}
	data, err := json.Marshal(challenge)
	if err != nil {
		return model.TalentAttempt{}, model.TalentChallenge{}, err
	}
	row := model.TalentAttempt{ID: id, UserID: user, Game: game, Challenge: string(data), CreatedAt: time.Now()}
	err = s.Store.CreateTalentAttempt(ctx, &row)
	return row, challenge.TalentChallenge, err
}

// 浏览器负责计时；服务器按发出的题目和原始答案计算成绩，不接受客户端积分。
// 这不能证明没有脚本参与，娱乐榜不提供能力认证或严格防作弊保证。
func scoreTalent(game string, c storedTalentChallenge, in TalentSubmission) (int, int, int, error) {
	if game == "reaction" {
		if len(in.SamplesMS) != 5 || len(in.Answers) != 0 {
			return 0, 0, 0, ErrInvalid
		}
		total := 0
		for _, sample := range in.SamplesMS {
			if sample < 80 || sample > 5000 {
				return 0, 0, 0, ErrInvalid
			}
			total += sample
		}
		return (total + 2) / 5, 5, 0, nil
	}
	if len(in.SamplesMS) != 0 {
		return 0, 0, 0, ErrInvalid
	}
	if game == "memory" {
		if len(in.Answers) > 210 {
			return 0, 0, 0, ErrInvalid
		}
		offset, level := 0, 0
		for length := 1; length <= len(c.Sequence); length++ {
			for j := 0; j < length; j++ {
				if offset == len(in.Answers) {
					return level, level, 0, nil
				}
				value := in.Answers[offset]
				offset++
				if value < 0 || value > 8 {
					return 0, 0, 0, ErrInvalid
				}
				if value != c.Sequence[j] {
					if offset != len(in.Answers) {
						return 0, 0, 0, ErrInvalid
					}
					return level, level, 1, nil
				}
			}
			level = length
		}
		return level, level, 0, nil
	}
	if len(in.Answers) > len(c.Answers) {
		return 0, 0, 0, ErrInvalid
	}
	correct, wrong := 0, 0
	for i, answer := range in.Answers {
		if answer < 0 || answer > 3 {
			return 0, 0, 0, ErrInvalid
		}
		if answer == c.Answers[i] {
			correct++
		} else {
			wrong++
		}
	}
	score := correct - wrong
	if score < 0 {
		score = 0
	}
	return score, correct, wrong, nil
}

func (s *Service) FinishTalent(ctx context.Context, user int64, game, id string, in TalentSubmission) (model.TalentResult, error) {
	if !ValidTalentGame(game) || len(id) != 64 {
		return model.TalentResult{}, ErrInvalid
	}
	attempt, err := s.Store.TalentAttempt(ctx, user, game, id)
	if err != nil {
		return model.TalentResult{}, err
	}
	// 先读已完成记录，过期之后的网络重试仍返回原成绩。
	existing, err := s.Store.TalentResult(ctx, id)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.TalentResult{}, err
	}
	elapsed := time.Since(attempt.CreatedAt)
	if elapsed > 10*time.Minute {
		return model.TalentResult{}, ErrAttemptExpired
	}
	if (game == "reasoning" || game == "focus") && elapsed < 60*time.Second && len(in.Answers) < 256 {
		return model.TalentResult{}, ErrInvalid
	}
	var challenge storedTalentChallenge
	if err = json.Unmarshal([]byte(attempt.Challenge), &challenge); err != nil {
		return model.TalentResult{}, err
	}
	score, correct, wrong, err := scoreTalent(game, challenge, in)
	if err != nil {
		return model.TalentResult{}, err
	}
	return s.Store.SaveTalentResult(ctx, model.TalentResult{AttemptID: id, UserID: user, Game: game, Score: score, Correct: correct, Wrong: wrong})
}
