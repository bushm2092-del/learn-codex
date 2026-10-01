-- +goose Up
-- 娱乐测试与章节学习数据分开；每次挑战最多写入一份不可变成绩。
CREATE TABLE talent_attempts (
    id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game VARCHAR(16) NOT NULL CHECK (game IN ('reaction','memory','reasoning','focus')),
    challenge JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX talent_attempts_created ON talent_attempts(created_at);
CREATE TABLE talent_results (
    id BIGSERIAL PRIMARY KEY,
    attempt_id VARCHAR(64) NOT NULL UNIQUE REFERENCES talent_attempts(id),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game VARCHAR(16) NOT NULL CHECK (game IN ('reaction','memory','reasoning','focus')),
    score INTEGER NOT NULL CHECK (score >= 0),
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX talent_results_game_user_score ON talent_results(game,user_id,score);

-- +goose Down
DROP TABLE talent_results;
DROP TABLE talent_attempts;
