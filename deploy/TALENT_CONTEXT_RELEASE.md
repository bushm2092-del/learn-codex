# 天赋测试与 Context · 2026-10-01

- 整个项目的现有修改一并提交：独立天赋模块、Context 文章与演示、共享文章组件，以及 Rust 的历史整理、本地摘要、Remote V2 和 TokenBudget 子集。
- 前后端发布版本为 `talent-context-20261001`（linux/amd64），镜像分别为 `learn-codex-api:talent-context-20261001` 和 `learn-codex-frontend:talent-context-20261001`。
- 前端使用宿主机构建的完整静态产物，通过 `frontend-release.Dockerfile` 叠加服务器现有 `s04-ready-s05-draft-20260930` 镜像，保留旧静态资源。Context 的本次构建源码和定义索引在宿主机生成，保留 `lesson/*` 的已提交源码快照。
- 服务器发布目录沿用 `/home/admin/learn-codex-releases/learn-codex-teach-copy-20260928-e2a5495`，现有数据库、环境配置、GitHub OAuth 和 Rust worker 保持原配置。
- 数据库升级前备份到 `backups/before-talent-context-20261001.sql`；运行新 API 镜像的 Goose Up，补齐幂等的 003 章节登记和 004 天赋测试表。不会执行 Down 或删除学习数据。
- `talent-context-20261001.override.yaml` 部署到该目录的 `frontend.override.yaml`，沿用旧覆盖文件名，同时覆盖 `api`、`migrate`、`frontend` 三个镜像。旧覆盖文件另行备份。

后续重启使用当前覆盖文件和已有沙箱配置：

```bash
sudo docker compose --env-file release.env --env-file .env \
  -f compose.yaml -f rust-sandbox.override.yaml -f frontend.override.yaml \
  up -d --no-deps --no-build --pull never --wait api frontend
```

验证包括 Rust 格式、workspace check/test，Go 格式、vet、race 测试与 PostgreSQL 集成测试，教学站类型检查、构建及 28 项测试，TUI 类型检查、构建及 21 项测试，源码快照和 JSON 检查。独立文档目录已无 package.json，`pnpm docs:build` 无法执行；教学站 Markdown 由文章测试与生产构建验证。按用户要求不运行浏览器自动化。
