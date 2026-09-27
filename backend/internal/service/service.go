package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"mini-codex/backend/internal/model"
	"mini-codex/backend/internal/repository"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrInvalid = errors.New("invalid input")

type Service struct{ Store *repository.Store }

func New(store *repository.Store) *Service { return &Service{Store: store} }
func Token() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	return hex.EncodeToString(b), err
}
func Hash(raw string) string { sum := sha256.Sum256([]byte(raw)); return hex.EncodeToString(sum[:]) }
func ValidateComment(body string) (string, error) {
	body = strings.TrimSpace(body)
	if !utf8.ValidString(body) || utf8.RuneCountInString(body) < 1 || utf8.RuneCountInString(body) > 2000 || strings.ContainsRune(body, 0) {
		return "", ErrInvalid
	}
	return body, nil
}
func (s *Service) Comment(ctx context.Context, user int64, chapter, body string) (model.Comment, error) {
	c := model.Comment{UserID: user, ChapterID: chapter}
	var err error
	c.Body, err = ValidateComment(body)
	if err != nil {
		return c, err
	}
	if err = s.Store.Chapter(ctx, chapter); err != nil {
		return c, err
	}
	err = s.Store.AddComment(ctx, &c)
	return c, err
}
func (s *Service) CheckIn(ctx context.Context, user int64, chapter string) (bool, error) {
	if err := s.Store.Chapter(ctx, chapter); err != nil {
		return false, err
	}
	return s.Store.CheckIn(ctx, user, chapter)
}
func (s *Service) ValidatePage(ctx context.Context, page string) error {
	if page == "/" {
		return nil
	}
	if !strings.HasPrefix(page, "/lessons/") {
		return ErrInvalid
	}
	return s.Store.Chapter(ctx, strings.TrimPrefix(page, "/lessons/"))
}
func DateRange(from, to string, now time.Time) (string, string, error) {
	if to == "" {
		to = now.UTC().Format("2006-01-02")
	}
	if from == "" {
		from = now.UTC().AddDate(0, 0, -29).Format("2006-01-02")
	}
	a, e1 := time.Parse("2006-01-02", from)
	b, e2 := time.Parse("2006-01-02", to)
	if e1 != nil || e2 != nil || a.After(b) || b.Sub(a) > 365*24*time.Hour {
		return "", "", ErrInvalid
	}
	return from, to, nil
}
