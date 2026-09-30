# 第四节正式与第五节草稿 · 2026-09-30

- 第四节 `/lessons/function-call-source` 标记正式，包含本轮正文、标签与源码入口调整。
- 第五节 `/lessons/context` 以草稿开放：Prompt、ContextManager、工具结果入历史，以及真实 Codex 的历史整理与窗口限制。当前教学内核尚未实现压缩，正文明确说明这一边界。
- 首页加入 AI 生成的终端示意，并采用并排首屏。
- 新前端镜像 `learn-codex-frontend:s04-ready-s05-draft-20260930` 基于原 `s04-article-20260929` 叠加静态资源，保留旧资源与源码快照。构建配方为 `frontend-release.Dockerfile`。
- 发布目录保持 `/home/admin/learn-codex-releases/learn-codex-teach-copy-20260928-e2a5495`，用本次 `frontend-20260930.override.yaml` 更新该目录的 `frontend.override.yaml`；原覆盖文件另行备份。
- 仅重建 frontend，不修改 API、数据库、worker，也不运行数据库迁移；context 章节已登记。
- 回退时把前端镜像恢复为 `learn-codex-frontend:s04-article-20260929`，使用原 compose 和沙箱覆盖文件重建 frontend，保留学习数据。

验证：`pnpm check`、`pnpm build` 与 `git diff --check` 通过；本地第五节包含五个内容段落，390px 无横向溢出。服务器侧 HTTPS 第四节和第五节 HTML 的 SHA-256 均为 `2bb5a3c8cdb51da9d375803cef13af6e053333a2d0c790b7d19d9dbb3a157ec8`，与本地 index.html 一致。第五节统计接口正常返回，frontend、api、postgres 均健康。当前电脑访问生产域名出现 TLS 连接错误，公网浏览器未完成复核。
