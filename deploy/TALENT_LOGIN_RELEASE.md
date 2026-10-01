# 天赋测试登录页 · 2026-10-01

从天赋测试进入登录页时，使用天赋模块的品牌、导航和挑战文案，返回入口指向大厅。表单收窄到 360px，标题 24px，输入框与按钮至少 44px；主按钮明确使用浅色文字和箭头，避免通用按钮颜色覆盖。注册、密码登录与 GitHub 登录均返回原挑战或带 `game` 的天赋榜单，游戏账号菜单也链接天赋排行榜。

## 发布

- 前后端版本均为 `talent-login-20261001`，目标为 linux/amd64，需要同时更新。
- 后台在构建机使用 `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w'` 编译 `./cmd/server`。使用 `backend-release.Dockerfile` 叠加服务器已有的 `learn-codex-api:memory-independent-20261001` 运行时。
- 前端使用 `pnpm build` 的静态产物与现有 `nginx.conf`，通过 `frontend-release.Dockerfile` 叠加 `learn-codex-frontend:memory-independent-20261001`，保留上一版静态资源与源码快照。两种镜像均设置源码提交的 `org.opencontainers.image.revision` 标签；构建不拉取基础镜像。
- 服务器沿用 `/home/admin/learn-codex-releases/learn-codex-teach-copy-20260928-e2a5495` 的 Compose 项目、配置与 Rust worker。发布包不包含账号配置或数据库内容。
- 安装前将现有覆盖文件保存到 `backups/frontend-before-talent-login-20261001.override.yaml`，将数据库以 0600 权限备份到 `backups/before-talent-login-20261001.sql`。
- 将 `talent-login-20261001.override.yaml` 安装为 release 目录中的 `frontend.override.yaml`，保持 `rust-sandbox.override.yaml`，只重建 API 与前端。
- 无新增数据库迁移，GitHub 回跳路径使用 10 分钟 HttpOnly Cookie 暂存，授权开始与回调均校验站内白名单，回调清除 Cookie。

```bash
sudo docker compose --env-file release.env --env-file .env \
  -f compose.yaml -f rust-sandbox.override.yaml -f frontend.override.yaml \
  up -d --force-recreate --no-deps --no-build --pull never --wait api frontend
```

## 验证与回退

验证涵盖前端类型检查、生产构建、30 项测试、中英文登录页面的服务端渲染，以及 Go vet、race 和 PostgreSQL 集成测试。OAuth 测试使用注入的假 GitHub Provider，覆盖挑战/榜单回跳、外站地址拒绝、篡改 Cookie 和 state 重放；不等同于使用真实 GitHub 账号完成授权。按用户要求不运行浏览器自动化。

上线检查容器健康、API 就绪、入口及关键静态资源的内容校验和、OAuth 回跳 Cookie 属性、Rust worker 状态。需要回退时，用备份的覆盖文件恢复 `frontend.override.yaml`，再执行相同的重建命令；本次无数据库结构变更，不运行数据库回退迁移。
