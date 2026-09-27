-- +goose Up
CREATE TABLE users (
 id BIGSERIAL PRIMARY KEY, github_id BIGINT NOT NULL UNIQUE,
 login TEXT NOT NULL, avatar_url TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_states (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX oauth_expiry ON oauth_states(expires_at);
CREATE TABLE chapters (id TEXT PRIMARY KEY, title TEXT NOT NULL, position INTEGER NOT NULL UNIQUE);
INSERT INTO chapters VALUES
 ('agent-loop','Agent Loop',1), ('model-protocols','Responses / Chat',2), ('function-call','Function Calling',3),
 ('context','Context',4), ('session-storage','Session Storage',5), ('mcp','MCP',6), ('skills','Skills',7),
 ('sandbox','Sandbox',8), ('plan-mode','Plan Mode',9), ('goal-mode','Goal Mode',10), ('subagent','Subagent',11), ('agent-team','Agent Team',12);
CREATE TABLE comments (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), chapter_id TEXT NOT NULL REFERENCES chapters(id), body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX comments_chapter_page ON comments(chapter_id,id DESC);
CREATE TABLE check_ins (user_id BIGINT NOT NULL REFERENCES users(id), chapter_id TEXT NOT NULL REFERENCES chapters(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,chapter_id));
CREATE INDEX check_ins_chapter ON check_ins(chapter_id);
CREATE TABLE daily_views (day DATE NOT NULL, page TEXT NOT NULL, pv BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(day,page));
CREATE TABLE daily_visitors (day DATE NOT NULL, page TEXT NOT NULL, visitor_hash TEXT NOT NULL, PRIMARY KEY(day,page,visitor_hash));

-- +goose Down
DROP TABLE daily_visitors, daily_views, check_ins, comments, chapters, oauth_states, sessions, users;
