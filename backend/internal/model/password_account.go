package model

// 凭据与公开用户信息分离，绝不序列化密码哈希。
type PasswordAccount struct {
	Username     string `gorm:"primaryKey" json:"-"`
	UserID       int64  `json:"-"`
	PasswordHash string `json:"-"`
}
