-- +goose Up
-- 新章节登记可重复执行，保留既有章节与学习数据；两阶段移动避免唯一位置冲突。
UPDATE chapters SET position = -position
WHERE position >= 4 AND NOT EXISTS (SELECT 1 FROM chapters WHERE id = 'function-call-source');
UPDATE chapters SET position = -position + 1 WHERE position < 0;
INSERT INTO chapters (id, title, position) VALUES ('function-call-source', 'Codex Function Calling · Source Walkthrough', 4)
ON CONFLICT (id) DO NOTHING;

-- +goose Down
-- 保留章节及其评论、打卡数据，不进行破坏性回退。
SELECT 1;
