# Learn Codex Backend

前后端一体离线发布使用仓库根目录 `make offline-pack VERSION=v1`，服务器启动、迁移、备份流程见 [离线部署说明](../deploy/README.md)。本目录 compose.yaml 继续用于独立后台本地开发。

教学站独立业务后台，与 `frontends/Teach` 对接；不属于 Codex Rust 内核。教学前端已接入登录、章节评论与打卡、排行榜及 PV/UV。真实 GitHub 登录需要自建 OAuth App。

## 技术与边界

### 用户名密码账号

先执行迁移 `go run ./cmd/server migrate`（Docker 部署继续由 migrate 服务执行），新增 `password_accounts` 表并允许本地用户没有 GitHub ID。

- `POST /api/v1/auth/register` 和 `POST /api/v1/auth/login` 接收 `{"username":"learner","password":"your-long-password"}`。注册成功 201，登录成功 200，均签发原有 HttpOnly 会话 Cookie；需要合法 Origin。
- 用户名为 3–32 位英文字母、数字、下划线，统一小写。密码至少 12 个 Unicode 字符，最多 72 字节，不裁剪、不静默截断。
- bcrypt cost 12 加盐哈希；凭据不进入用户响应或日志。本地账号和 GitHub 账号独立，不因同名合并。
- 重复用户名 409；错误密码和不存在的账号统一 401。注册与登录共享每直连 IP 5 次突发额度，每 12 秒恢复一次，进程重启会重置；多副本/生产部署应在网关补充统一防滥用限流。
- 注册自动登录；再次登录轮换会话，退出立即失效。当前没有密码找回、邮箱验证或账号合并功能。
- 迁移回滚会删除密码凭据但保留用户及学习数据；上线前应备份，生产优先前向迁移。

- Go 1.26、Gin、GORM + PostgreSQL 17、Goose SQL 迁移、`golang.org/x/oauth2`。
- 标准库 `slog` JSON 日志、HTTP 超时、优雅停机，基于 `x/time/rate` 的进程内限流。
- 模块化单体 + 构造函数依赖注入；不引入暂时不需要的 Redis、消息队列或微服务。
- Cookie 服务端会话可即时注销；数据库只保存 SHA-256 会话令牌哈希。OAuth 使用 state + PKCE，令牌仅用于获取公开 GitHub 身份，不申请仓库权限、不保存 GitHub access token。

```text
backend/
├── cmd/server/          # 启动、迁移入口、信号与生命周期
├── internal/
│   ├── config/          # 环境变量与启动校验
│   ├── database/        # PostgreSQL 连接池、Goose
│   ├── model/           # 数据库实体与响应结构
│   ├── repository/      # GORM、事务与聚合查询
│   ├── service/         # 业务规则、校验、打卡与统计约束
│   ├── oauth/           # GitHub 协议适配，Provider 可注入测试
│   └── httpapi/         # 路由、鉴权、Cookie、Origin、限流
├── migrations/          # 编号 SQL，嵌入二进制；不使用 AutoMigrate
├── Dockerfile
└── compose.yaml
```

## Docker 本地部署

1. `cp .env.example .env`，把 `POSTGRES_PASSWORD` 替换成随机密码（建议 `openssl rand -hex 32`，避免 DSN 特殊字符）；填写 GitHub 配置。
2. `docker compose --env-file .env up --build -d`。
3. `curl http://localhost:8080/readyz`。

Compose 依次等待 PostgreSQL 就绪、执行一次迁移、启动 API。数据库不对宿主机开放端口，数据保存在 `pgdata` 卷；API 仅绑定 `127.0.0.1:8080`。`docker compose down` 保留数据，**不要在需要保留数据时使用 `down -v`**。

迁移是独立部署步骤，不在每个服务副本启动时修改表。升级时先备份数据库，再运行 `docker compose run --rm migrate`，随后更新 API。生产迁移应只有一个作业执行。

### 本地 Go 开发

准备 PostgreSQL，将环境变量加载到 shell 后执行：

```sh
go run ./cmd/server migrate
go run ./cmd/server
```

应用不会自动加载 `.env`；Compose 使用 `--env-file`。直接运行 Go 时可使用 IDE 环境配置或在受信任的本地配置文件上执行 `set -a; source .env; set +a`。

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 必填 PostgreSQL URL；远程数据库使用 TLS |
| `HTTP_ADDR` | 默认 `:8080` |
| `FRONTEND_ORIGIN` | 精确前端 origin，不带路径或末尾 `/` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth App 配置；缺省时登录返回 503，其余接口可用 |
| `GITHUB_CALLBACK_URL` | 精确回调地址 |
| `COOKIE_SECURE` | 默认 true；仅本地 HTTP 开发设 false |

### GitHub OAuth App

在 GitHub Developer settings 创建 OAuth App：

- Homepage URL：`http://localhost:4173`
- Authorization callback URL：`http://localhost:8080/api/v1/auth/github/callback`
- 登录入口：浏览器跳转 `/api/v1/auth/github`，回调成功后跳回 `FRONTEND_ORIGIN/`。
- 生产替换成 HTTPS 域名；密钥通过部署环境或 secret manager 注入，不提交到仓库。

## API v1

返回 JSON，错误格式为 `{"error":"machine_code"}`。评论、排行榜和聚合统计为公开数据，个人进度需要登录。

| 方法与路径 | 功能 | 登录 |
| --- | --- | --- |
| `GET /healthz` / `GET /readyz` | 进程存活 / 数据库就绪 | 否 |
| `GET /api/v1/auth/github` | 跳转 GitHub | 否 |
| `GET /api/v1/auth/config` | 是否已配置 GitHub 登录，不返回密钥 | 否 |
| `GET /api/v1/auth/github/callback` | OAuth 回调 | 否 |
| `GET /api/v1/me` | 当前账号公开信息 | 是 |
| `POST /api/v1/auth/logout` | 注销当前会话 | 是 |
| `GET /api/v1/chapters` | 章节目录 | 否 |
| `GET /api/v1/chapters/:chapter/comments?before=123` | 评论，按 ID 倒序，每页 20 条 | 否 |
| `POST /api/v1/chapters/:chapter/comments` | `{"body":"内容"}` | 是 |
| `DELETE /api/v1/comments/:id` | 删除自己的评论，非作者返回 404 | 是 |
| `PUT /api/v1/chapters/:chapter/check-in` | 幂等章节打卡 | 是 |
| `GET /api/v1/me/check-ins` | 当前账号学习记录 | 是 |
| `GET /api/v1/leaderboard` | 已打卡用户前 100 名 | 否 |
| `POST /api/v1/analytics/views` | `{"page":"/lessons/agent-loop"}` | 否 |
| `GET /api/v1/analytics/stats?from=2026-09-01&to=2026-09-27&page=/lessons/agent-loop` | 聚合 PV/UV | 否 |

列表格式 `{"items":[]}`；评论额外返回 `next_cursor`（0 表示无下一页）。打卡返回 `{"checked_in":true,"created":true}`，重复请求 `created=false`。

### 前端接入约定

```js
fetch('http://localhost:8080/api/v1/chapters/agent-loop/check-in', {
  method: 'PUT', credentials: 'include'
});
```

所有写请求必须携带与配置一致的 `Origin`，浏览器会自动发送；跨域 fetch 必须使用 `credentials: 'include'`。生产建议前端和 API 同站点并由反向代理代理 `/api`；当前 SameSite=Lax 不支持任意跨站第三方 Cookie 部署。Origin 验证用于 CSRF 防护，不是机器人防护。OAuth 回调是 GET，以一次性 state 和绑定浏览器的 Cookie 校验。

评论是纯文本（1–2000 Unicode 字符），前端必须用文本节点渲染，禁止直接插入 HTML。前端路由发生有效访问时上报一次 PV；不要在重渲染或请求重试时重复上报。

## 统计与排名口径

- PV：每个被接受的上报计一次，不承诺重试去重。仅接受 `/` 和已登记章节路径，不收集查询参数、IP 或完整浏览轨迹。
- UV：匿名 `learn_visitor` Cookie 标识的去重数量；数据库仅存该随机标识的哈希。跨日期、跨页面查询按整个区间去重，不相加每日 UV。清理 Cookie 或换浏览器会重复计数，不等于真实人数。Cookie 一年有效，访问统计的保留期限应在公开上线前按隐私政策设置。
- 按 UTC 日统计，默认最近 30 日；查询跨度不超过 365 天。没有事件时返回 0。
- 排行榜：每个用户完成的不同章节数量；同数量同名次（dense rank），同分按用户 ID 稳定展示。打卡是用户自报，不验证读完或考试通过，禁止把排名当成能力认证。
- 12 个章节 ID 与教学站目录一致；当前待编写章节也登记，后续如需要限制开放章节，需同时增加发布状态规则。

## 验证

```sh
go fmt ./...
go vet ./...
go test -race ./...
TEST_DATABASE_URL='postgres://user:password@localhost:5432/test?sslmode=disable' go test ./internal/httpapi -run TestPostgresFlow -count=1 -v
```

集成测试创建并删除独立随机 schema，不清空现有表；数据库账号需有 CREATE SCHEMA 权限。未设置测试 URL 时明确跳过，不表示数据库路径已验证。测试使用假的 GitHub 身份提供方，另外用 httptest 校验 OAuth token 交换的 PKCE 和 Bearer 行为。

## 公网上线前

- 入口反向代理终止 HTTPS，设置 `COOKIE_SECURE=true`，限制外部访问健康检查；配置 PostgreSQL 备份与恢复演练、监控和密钥轮换。
- 容器非 root、只读根文件系统、不暴露数据库端口。容器镜像版本和 Go 依赖锁定在配置中；部署时扫描镜像及依赖。
- 当前限流是每直连 IP 每秒 2 次、突发 30 次，单实例内存状态。默认不信任代理头；通过网关部署时需配置网关限流和受信任代理，不能直接相信客户端的 X-Forwarded-For。
- 尚未提供评论审核后台、举报、反刷或验证码；公开社区上线前应补齐运营能力。没有引入 Redis 集群限流或异步分析管道，规模扩大时再增加。
- 过期会话与 OAuth state 每小时清理。不要记录请求 Cookie、OAuth 回调查询串或认证头；网关日志也要脱敏。

## 取消打卡

`DELETE /api/v1/chapters/:chapter/check-in`：需要登录和合法 Origin，仅取消当前用户的该章节记录，重复取消返回 204。章节不存在返回 404；进度和排行榜按剩余记录实时计算。
