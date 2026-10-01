package repository

import (
	"context"
	"gorm.io/gorm"
	"mini-codex/backend/internal/model"
)

func (s *Store) CreateTalentAttempt(ctx context.Context, row *model.TalentAttempt) error {
	return s.DB.WithContext(ctx).Create(row).Error
}

func (s *Store) TalentAttempt(ctx context.Context, user int64, game, id string) (model.TalentAttempt, error) {
	var row model.TalentAttempt
	err := s.DB.WithContext(ctx).Where("id = ? AND user_id = ? AND game = ?", id, user, game).Take(&row).Error
	return row, err
}

func (s *Store) TalentResult(ctx context.Context, attempt string) (model.TalentResult, error) {
	var row model.TalentResult
	err := s.DB.WithContext(ctx).Where("attempt_id = ?", attempt).Take(&row).Error
	return row, err
}

// 重试和并发请求只保留首份成绩，失败后可用同一个挑战 ID 安全重试。
func (s *Store) SaveTalentResult(ctx context.Context, result model.TalentResult) (model.TalentResult, error) {
	var row model.TalentResult
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`INSERT INTO talent_results(attempt_id,user_id,game,score,correct,wrong)
		 VALUES (?,?,?,?,?,?) ON CONFLICT(attempt_id) DO NOTHING`, result.AttemptID, result.UserID, result.Game, result.Score, result.Correct, result.Wrong).Error; err != nil {
			return err
		}
		return tx.Where("attempt_id = ?", result.AttemptID).Take(&row).Error
	})
	return row, err
}

func (s *Store) TalentLeaderboard(ctx context.Context, user int64, game string) (model.TalentBoard, error) {
	board := model.TalentBoard{Items: []model.TalentRank{}}
	rows := []model.TalentRank{}
	// 分数转成统一的升序键：反应力越小越好，其余项目越大越好。
	err := s.DB.WithContext(ctx).Raw(`WITH best AS (
	 SELECT user_id,min(CASE WHEN game='reaction' THEN score ELSE -score END) AS sort_score
	 FROM talent_results WHERE game=? GROUP BY user_id
	), ranked AS (
	 SELECT u.id AS user_id,u.login,u.avatar_url,
	 CASE WHEN ?='reaction' THEN b.sort_score ELSE -b.sort_score END AS score,
	 dense_rank() OVER (ORDER BY b.sort_score ASC) AS rank,
	 row_number() OVER (ORDER BY b.sort_score ASC,u.id ASC) AS position
	 FROM best b JOIN users u ON u.id=b.user_id
	) SELECT user_id,login,avatar_url,score,rank FROM ranked
	 WHERE position<=100 OR user_id=? ORDER BY position`, game, game, user).Scan(&rows).Error
	for i, row := range rows {
		if i < 100 {
			board.Items = append(board.Items, row)
		}
		if row.UserID == user {
			own := row
			board.Own = &own
		}
	}
	return board, err
}
