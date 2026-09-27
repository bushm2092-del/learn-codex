package service

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"mini-codex/backend/internal/model"
	"regexp"
	"strings"
	"unicode/utf8"
)

var ErrCredentials = errors.New("invalid credentials")
var ErrUsernameTaken = errors.New("username unavailable")
var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,32}$`)

// 未找到账号仍进行同成本比较，避免明显的账号存在性时间差。
var dummyPasswordHash = func() []byte {
	hash, err := bcrypt.GenerateFromPassword([]byte("dummy-password-not-an-account"), 12)
	if err != nil {
		panic("cannot initialize password hashing")
	}
	return hash
}()

func ValidateCredentials(username, password string) (string, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	if !usernamePattern.MatchString(username) || !utf8.ValidString(password) || utf8.RuneCountInString(password) < 12 || len(password) > 72 {
		return "", ErrInvalid
	}
	return username, nil
}
func (s *Service) Register(ctx context.Context, username, password string) (model.User, error) {
	username, err := ValidateCredentials(username, password)
	if err != nil {
		return model.User{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return model.User{}, err
	}
	user, err := s.Store.CreatePasswordUser(ctx, username, string(hash))
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return model.User{}, ErrUsernameTaken
	}
	return user, err
}
func (s *Service) PasswordLogin(ctx context.Context, username, password string) (model.User, error) {
	username, err := ValidateCredentials(username, password)
	if err != nil {
		return model.User{}, ErrCredentials
	}
	account, err := s.Store.PasswordAccount(ctx, username)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(password))
		return model.User{}, ErrCredentials
	}
	if err != nil {
		return model.User{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(password)) != nil {
		return model.User{}, ErrCredentials
	}
	return s.Store.User(ctx, account.UserID)
}
