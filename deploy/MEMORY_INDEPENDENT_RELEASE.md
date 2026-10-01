# 每关独立顺序记忆 · 2026-10-01

记忆测试每关重新生成独立随机序列，长度从 1 格逐关增加到 20 格。前端使用 `challenge.sequences` 播放和判断当前关卡；后台逐关验证原始点击，按完整通过关数计分。升级前已开始的 `sequence` 前缀挑战继续按发出时的规则结算。已有排行榜成绩保留，旧页面刷新后使用新玩法。

- 前后端版本为 `memory-independent-20261001`（linux/amd64），需要同时发布。
- 后台在宿主机以 `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w'` 编译 `./cmd/server`，使用 `backend-release.Dockerfile` 叠加现有 `learn-codex-api:talent-context-20261001` 镜像，不依赖 Docker Hub 拉取。
- 前端在宿主机完成 `pnpm build`，使用 `frontend-release.Dockerfile` 叠加现有 `learn-codex-frontend:talent-context-20261001` 镜像，保留旧静态资源和源码快照。
- 服务器沿用 `/home/admin/learn-codex-releases/learn-codex-teach-copy-20260928-e2a5495` 的 Compose 项目、账号配置、数据库和 Rust worker。
- 发布前备份数据库到 `backups/before-memory-independent-20261001.sql`，备份当前覆盖文件到 `backups/frontend-before-memory-independent-20261001.override.yaml`。本次无需新增数据库迁移，Goose 当前版本仍为 4。
- 将 `memory-independent-20261001.override.yaml` 安装为该目录的 `frontend.override.yaml`，保留现有 `rust-sandbox.override.yaml`，重建 API 与前端使 Nginx 重新解析后台地址。

```bash
sudo docker compose --env-file release.env --env-file .env \
  -f compose.yaml -f rust-sandbox.override.yaml -f frontend.override.yaml \
  up -d --force-recreate --no-deps --no-build --pull never --wait api frontend
```

验证已覆盖 Go 格式、vet、race 测试与 PostgreSQL 集成测试（独立序列、答错、部分关卡、20 关通关、旧挑战结算），教学站类型检查、生产构建及 28 项测试，设计 JSON 与改动空白检查。按用户要求不运行浏览器自动化。
