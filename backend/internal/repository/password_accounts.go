package repository

import (
	"context"
	"gorm.io/gorm"
	"mini-codex/backend/internal/model"
)

func (s *Store) CreatePasswordUser(ctx context.Context, username, hash string) (model.User, error) {
	user := model.User{Login: username}
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 本地账号没有 GitHub 身份，不能写入伪造的 provider ID。
		if err := tx.Omit("GitHubID").Create(&user).Error; err != nil {
			return err
		}
		return tx.Create(&model.PasswordAccount{Username: username, UserID: user.ID, PasswordHash: hash}).Error
	})
	return user, err
}
func (s *Store) PasswordAccount(ctx context.Context, username string) (model.PasswordAccount, error) {
	var account model.PasswordAccount
	err := s.DB.WithContext(ctx).First(&account, "username = ?", username).Error
	return account, err
}
func (s *Store) User(ctx context.Context, id int64) (model.User, error) {
	var user model.User
	err := s.DB.WithContext(ctx).First(&user, id).Error
	return user, err
}
