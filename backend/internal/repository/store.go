package repository

import (
	"context"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"mini-codex/backend/internal/model"
	"time"
)

type Store struct{ DB *gorm.DB }

func New(db *gorm.DB) *Store { return &Store{DB: db} }
func (s *Store) Chapters(ctx context.Context) ([]model.Chapter, error) {
	rows := []model.Chapter{}
	err := s.DB.WithContext(ctx).Order("position").Find(&rows).Error
	return rows, err
}
func (s *Store) Chapter(ctx context.Context, id string) error {
	return s.DB.WithContext(ctx).First(&model.Chapter{}, "id = ?", id).Error
}
func (s *Store) UpsertUser(ctx context.Context, u *model.User) error {
	return s.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "github_id"}}, DoUpdates: clause.AssignmentColumns([]string{"login", "avatar_url"})}, clause.Returning{}).Create(u).Error
}
func (s *Store) SaveState(ctx context.Context, state model.OAuthState) error {
	return s.DB.WithContext(ctx).Create(&state).Error
}

// 一条 DELETE RETURNING 保证并发回调只能消费一次 state。
func (s *Store) ConsumeState(ctx context.Context, hash string) (model.OAuthState, error) {
	var state model.OAuthState
	tx := s.DB.WithContext(ctx).Raw("DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > now() RETURNING *", hash).Scan(&state)
	if tx.Error != nil {
		return state, tx.Error
	}
	if tx.RowsAffected == 0 {
		return state, gorm.ErrRecordNotFound
	}
	return state, nil
}
func (s *Store) CreateSession(ctx context.Context, session model.Session) error {
	return s.DB.WithContext(ctx).Create(&session).Error
}
func (s *Store) UserForSession(ctx context.Context, hash string) (model.User, error) {
	var u model.User
	err := s.DB.WithContext(ctx).Table("users").Select("users.*").Joins("JOIN sessions ON sessions.user_id = users.id").Where("sessions.token_hash = ? AND sessions.expires_at > now()", hash).First(&u).Error
	return u, err
}
func (s *Store) DeleteSession(ctx context.Context, hash string) error {
	return s.DB.WithContext(ctx).Delete(&model.Session{}, "token_hash = ?", hash).Error
}
func (s *Store) Comments(ctx context.Context, chapter string, before int64) ([]model.Comment, error) {
	rows := []model.Comment{}
	q := s.DB.WithContext(ctx).Where("chapter_id = ?", chapter)
	if before > 0 {
		q = q.Where("id < ?", before)
	}
	err := q.Order("id DESC").Limit(20).Find(&rows).Error
	return rows, err
}
func (s *Store) AddComment(ctx context.Context, c *model.Comment) error {
	return s.DB.WithContext(ctx).Create(c).Error
}
func (s *Store) DeleteComment(ctx context.Context, id, user int64) (bool, error) {
	q := s.DB.WithContext(ctx).Where("id = ? AND user_id = ?", id, user).Delete(&model.Comment{})
	return q.RowsAffected > 0, q.Error
}
func (s *Store) CheckIn(ctx context.Context, user int64, chapter string) (bool, error) {
	q := s.DB.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&model.CheckIn{UserID: user, ChapterID: chapter})
	return q.RowsAffected > 0, q.Error
}
func (s *Store) Progress(ctx context.Context, user int64) ([]model.CheckIn, error) {
	rows := []model.CheckIn{}
	err := s.DB.WithContext(ctx).Where("user_id = ?", user).Order("created_at").Find(&rows).Error
	return rows, err
}

// 删除条件必须同时包含用户与章节，重复取消保持幂等。
func (s *Store) CancelCheckIn(ctx context.Context, user int64, chapter string) error {
	return s.DB.WithContext(ctx).Where("user_id = ? AND chapter_id = ?", user, chapter).Delete(&model.CheckIn{}).Error
}
func (s *Store) ChapterLearners(ctx context.Context, chapter string) ([]model.ChapterLearner, int64, error) {
	rows := []model.ChapterLearner{}
	var total int64
	if err := s.DB.WithContext(ctx).Model(&model.CheckIn{}).Where("chapter_id = ?", chapter).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	// 限制头像数量，按最近打卡排序；同一时间以用户 ID 保证稳定顺序。
	err := s.DB.WithContext(ctx).Table("check_ins c").Select("u.id, u.login, u.avatar_url").Joins("JOIN users u ON u.id = c.user_id").Where("c.chapter_id = ?", chapter).Order("c.created_at DESC, c.user_id ASC").Limit(40).Scan(&rows).Error
	return rows, total, err
}
func (s *Store) Leaderboard(ctx context.Context) ([]model.Rank, error) {
	rows := []model.Rank{}
	err := s.DB.WithContext(ctx).Raw(`SELECT u.id AS user_id,u.login,u.avatar_url,count(*) AS chapters,
 dense_rank() OVER (ORDER BY count(*) DESC) AS rank
 FROM check_ins c JOIN users u ON u.id=c.user_id
 GROUP BY u.id ORDER BY chapters DESC,u.id ASC LIMIT 100`).Scan(&rows).Error
	return rows, err
}
func (s *Store) RecordView(ctx context.Context, page, visitor string, now time.Time) error {
	day := now.UTC().Format("2006-01-02")
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("INSERT INTO daily_views(day,page,pv) VALUES (?,?,1) ON CONFLICT(day,page) DO UPDATE SET pv=daily_views.pv+1", day, page).Error; err != nil {
			return err
		}
		return tx.Exec("INSERT INTO daily_visitors(day,page,visitor_hash) VALUES (?,?,?) ON CONFLICT DO NOTHING", day, page, visitor).Error
	})
}
func (s *Store) Stats(ctx context.Context, page, from, to string) (model.Stats, error) {
	var stats model.Stats
	err := s.DB.WithContext(ctx).Raw(`SELECT
 (SELECT coalesce(sum(pv),0) FROM daily_views WHERE day BETWEEN ? AND ? AND (? = '' OR page = ?)) AS pv,
 (SELECT count(DISTINCT visitor_hash) FROM daily_visitors WHERE day BETWEEN ? AND ? AND (? = '' OR page = ?)) AS uv`, from, to, page, page, from, to, page, page).Scan(&stats).Error
	return stats, err
}
func (s *Store) Cleanup(ctx context.Context) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM sessions WHERE expires_at < now()").Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM oauth_states WHERE expires_at < now()").Error; err != nil {
			return err
		}
		// 保留有成绩的挑战用于幂等重试，只清理一天前未完成的娱乐挑战。
		return tx.Exec("DELETE FROM talent_attempts a WHERE created_at < now() - interval '24 hours' AND NOT EXISTS (SELECT 1 FROM talent_results r WHERE r.attempt_id = a.id)").Error
	})
}
