package database

import (
	"context"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"mini-codex/backend/migrations"
	"time"
)

func Open(dsn string) (*gorm.DB, error) {
	// 禁止 ORM 输出 SQL 参数，避免令牌哈希和 OAuth verifier 出现在错误日志。
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, err
	}
	pool, err := db.DB()
	if err != nil {
		return nil, err
	}
	pool.SetMaxOpenConns(20)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxLifetime(30 * time.Minute)
	return db, nil
}
func Migrate(ctx context.Context, db *gorm.DB) error {
	pool, err := db.DB()
	if err != nil {
		return err
	}
	goose.SetBaseFS(migrations.FS)
	if err = goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.UpContext(ctx, pool, ".")
}
