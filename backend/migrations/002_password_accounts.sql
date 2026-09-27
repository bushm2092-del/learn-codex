-- +goose Up
ALTER TABLE users ALTER COLUMN github_id DROP NOT NULL;
CREATE TABLE password_accounts (
 username TEXT PRIMARY KEY CHECK (username ~ '^[a-z0-9_]{3,32}$'),
 user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 password_hash TEXT NOT NULL
);

-- +goose Down
-- 保留本地用户数据；仅移除凭据表，github_id 仍允许 NULL。
DROP TABLE password_accounts;
