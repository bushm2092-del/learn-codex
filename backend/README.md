# Learn Codex Backend

章节累计访问统计：`GET /api/v1/chapters/:chapter/stats` 返回 `{pv, uv}`，按章节页面隔离。PV 累计访问次数，UV 在全部记录中按匿名访客标识去重，不等于真实人数。沿用现有访问数据，无需迁移。

前后端一体离线发布使用仓库根目录 `make offline-pack VERSION=v1`，服务器启动、迁移、备份流程见 [离线部署说明](../deploy/README.md)。本目录 compose.yaml 继续用于独立后台本地开发。

教学站独立业务后台，与 `frontends/teach` 对接；不属于 Codex Rust 内核。教学前端已接入登录、章节评论与打卡、排行榜及 PV/UV。真实 GitHub 登录需要自建 OAuth App。

## 技术与边界

### 用户名密码账号

先执行迁移 `go run ./cmd/server migrate`（Docker 部署继续由 migrate 服务执行），新增 `password_accounts` 表并允许本地用户没有 GitHub ID。

- `POST /api/v1/auth/register` 和 `POST /api/v1/auth/login` 接收 `{"username":"learner","password":"your-long-password"}`。注册成功 201，登录成功 200，均签发原有 HttpOnly 会话 Cookie；需要合法 Origin。
- 用户名为 3–32 位英文字母、数字、下划线，统一小写。密码至少 12 个 Unicode 字符，最多 72 字节，不裁剪、不静默截断。
- bcrypt cost 12 加盐哈希；凭据不进入用户响应或日志。本地账号和 GitHub 账号独立，不因同名合并。
- 重复用户名 409；错误密码和不存在的账号统一 401。按当前要求暂时关闭请求限流，包括注册与登录；生产环境应另行配置防暴力尝试措施。
- 注册自动登录；再次登录轮换会话，退出立即失效。当前没有密码找回、邮箱验证或账号合并功能。
- 迁移回滚会删除密码凭据但保留用户及学习数据；上线前应备份，生产优先前向迁移。

- Go 1.26、Gin、GORM + PostgreSQL 17、Goose SQL 迁移、`golang.org/x/oauth2`。
- 标准库 `slog` JSON 日志、HTTP 超时、优雅停机；进程内限流暂不启用。
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
- 当前未挂载请求限流中间件。默认不信任代理头；后续重新启用按 IP 限流时需正确配置受信任代理，不能直接相信客户端的 X-Forwarded-For。
- 尚未提供评论审核后台、举报、反刷或验证码；公开社区上线前应补齐运营能力。没有引入 Redis 集群限流或异步分析管道，规模扩大时再增加。
- 过期会话与 OAuth state 每小时清理。不要记录请求 Cookie、OAuth 回调查询串或认证头；网关日志也要脱敏。

## 取消打卡

`GET /api/v1/chapters/:chapter/learners`：公开已打卡用户的 ID、用户名、头像，返回 `items`（最近 40 位，时间相同按用户 ID）和 `total`。取消打卡后移出名单，不采集或公开浏览记录。

`DELETE /api/v1/chapters/:chapter/check-in`：需要登录和合法 Origin，仅取消当前用户的该章节记录，重复取消返回 204。章节不存在返回 404；进度和排行榜按剩余记录实时计算。

## Rust 执行沙箱

可选接口（均要求登录，写操作仍验证 Origin）：`POST /api/v1/sandbox/jobs` 提交 `{source,key}`，`GET /api/v1/sandbox/jobs/:id` 查询本人任务，`DELETE /api/v1/sandbox/jobs/:id` 取消。没有配置 `RUST_SANDBOX_SOCKET` 时返回 503，默认不开启。执行限流独立于已移除的网站通用限流。

实际编译由独立 `cmd/rust-worker` 在 gVisor 容器执行，API 不拥有 Docker 权限。安装、安全边界及验收见 [沙箱说明](../deploy/rust-sandbox/README.md)。

执行镜像 `learn-rust-sandbox:deps-v2` 预编译锁定的 reqwest、tokio、serde_json；任务继续使用固定 rustc 命令，不允许 Cargo 配置或下载依赖。容器内部受限代理适配标准 HTTPS 示例，不改写源码；真实 Key 仍只由宿主 relay 添加。relay 只接受 DeepSeek Responses API 的 `POST /responses`，不维护模型协议字段白名单，会透传 `tools` 等请求字段；每个任务最多允许 3 次 `deepseek-flash` 非流式请求，以支持一次有界的工具调用闭环，并对每次请求继续强制请求大小、输入项数量和输出 token 预算。工具仍由沙箱中的用户程序执行，不由 relay 执行。升级需先导入镜像再替换 worker，网络隔离与 Key 转发边界保持不变。

## 天赋测试（独立娱乐模块）

先执行 `go run ./cmd/server migrate`，迁移 `004_talent_tests.sql` 新建 `talent_attempts` 与 `talent_results`；不修改章节打卡数据。前端入口为 `/talent`，所有测试与榜单接口都要求现有登录 Cookie，写请求继续验证 Origin。

| 方法与路径 | 请求或响应 |
| --- | --- |
| `POST /api/v1/talent/:game/attempts` | 请求 `{}`，返回 `{id, game, challenge}`；只返回展示题目，不返回独立答案数组 |
| `POST /api/v1/talent/:game/attempts/:id/result` | 反应力提交 `{samples_ms:[...]}`，其余提交 `{answers:[...]}`；返回 `{id, attempt_id, game, score, correct, wrong, created_at}` |
| `GET /api/v1/talent/:game/leaderboard` | 返回 `{items:[...], own:...}`；本人未上榜时 `own:null`，超出前 100 位也返回个人名次 |

`:game` 只接受 `reaction`、`memory`、`reasoning`、`focus`。挑战归当前账号所有，跨账号或跨项目提交返回 404；未登录返回 401。未完成挑战在 10 分钟后返回 410 `attempt_expired`，一天前仍未完成的挑战由每小时清理任务删除，之后返回 404。每个挑战最多保存一份不可变结果，同 ID 的网络重试或并发提交均返回首次保存的成绩，完成后的重试不受挑战过期影响。

- 反应力：5 个整数毫秒样本，范围 80–5000 ms，服务器计算四舍五入的平均耗时；个人最佳取最小值。
- 顺序记忆：挑战返回 `challenge.sequences`，包含 20 组独立随机的九宫格位置（0–8），第 1–20 关分别为 1–20 个位置。每关重新出题，不沿用上一关的顺序；格子可以重复。提交各关点击拼接后的原始位置数组，服务端按每关题目逐项验证，通过关数为成绩；错误或未完成的关卡不加分。数据库 JSON 中升级前的 `sequence` 前缀挑战仍按原规则结算，已有成绩不变；发布时前后端需要一起更新，旧页面刷新后使用新玩法。
- 思考速度：256 道数字序列题，四选一，覆盖等差、倍增、差值每次 +1、相邻两项求和。提交顺序对应的选项索引（0–3）。
- 专注度：256 道颜色文字干扰题，选显示颜色；索引顺序为红、蓝、绿、黄。文字与显示颜色分别随机。
- 两项限时测试：60 秒，答对 +1、答错 −1、最低 0；除答完全部题目外，服务端拒绝 60 秒前提交。每项独立取个人最高分，同分并列（dense rank），同分按账号 ID 稳定展示。

耗时由浏览器测量，后台校验挑战、样本与答案并计算分数；未实现严格反脚本作弊，设备与输入方式也会影响耗时。排行榜属于娱乐记录，不作为医学测评、智力或能力认证。学习排行榜继续只统计章节打卡。

验证：`TEST_DATABASE_URL=... go test -race ./...`，`TestTalentPostgresFlow` 覆盖迁移、登录拦截、挑战归属、服务端计分、同分排名、各榜隔离、重复提交与过期重试。
