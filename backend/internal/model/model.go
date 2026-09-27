package model

import "time"

type User struct {
	ID        int64     `json:"id"`
	GitHubID  int64     `json:"-" gorm:"column:github_id"`
	Login     string    `json:"login"`
	AvatarURL string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
}
type Session struct {
	TokenHash string `gorm:"primaryKey"`
	UserID    int64
	ExpiresAt time.Time
}
type OAuthState struct {
	StateHash string `gorm:"primaryKey"`
	Verifier  string
	ExpiresAt time.Time
}

func (OAuthState) TableName() string { return "oauth_states" }

type Chapter struct {
	ID       string `json:"id" gorm:"primaryKey"`
	Title    string `json:"title"`
	Position int    `json:"position"`
}
type Comment struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	ChapterID string    `json:"chapter_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}
type CheckIn struct {
	UserID    int64     `json:"user_id" gorm:"primaryKey"`
	ChapterID string    `json:"chapter_id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"created_at"`
}
type Rank struct {
	UserID    int64  `json:"user_id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
	Chapters  int64  `json:"chapters"`
	Rank      int64  `json:"rank"`
}
type Stats struct {
	PV int64 `json:"pv"`
	UV int64 `json:"uv"`
}
