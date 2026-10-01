package model

import "time"

type TalentQuestion struct {
	Numbers []int `json:"numbers,omitempty"`
	Choices []int `json:"choices,omitempty"`
	Word    int   `json:"word,omitempty"`
	Ink     int   `json:"ink,omitempty"`
}

type TalentChallenge struct {
	Sequences [][]int `json:"sequences,omitempty"`
	// 仅用于读取升级前尚未结束的前缀记忆挑战。
	Sequence  []int            `json:"sequence,omitempty"`
	Questions []TalentQuestion `json:"questions,omitempty"`
}

type TalentAttempt struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    int64     `json:"-"`
	Game      string    `json:"game"`
	Challenge string    `json:"-" gorm:"type:jsonb"`
	CreatedAt time.Time `json:"created_at"`
}

type TalentResult struct {
	ID        int64     `json:"id"`
	AttemptID string    `json:"attempt_id"`
	UserID    int64     `json:"-"`
	Game      string    `json:"game"`
	Score     int       `json:"score"`
	Correct   int       `json:"correct"`
	Wrong     int       `json:"wrong"`
	CreatedAt time.Time `json:"created_at"`
}

type TalentRank struct {
	UserID    int64  `json:"user_id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
	Score     int    `json:"score"`
	Rank      int64  `json:"rank"`
}

type TalentBoard struct {
	Items []TalentRank `json:"items"`
	Own   *TalentRank  `json:"own"`
}
