# 教学站后台规范

- 独立业务后台，不移植或改写 Codex 内核。Go + Gin + GORM + PostgreSQL。
- `cmd/` 只组装和启动；`internal/config` 管配置；`internal/model` 管持久化实体；`internal/repository` 管数据库；`internal/service` 管业务规则；`internal/httpapi` 管 HTTP、身份和输入输出；`internal/oauth` 管 GitHub 协议。
- 使用构造函数注入依赖。业务不依赖 Gin，不为每个结构体机械增加接口。
- 数据库结构使用版本化 SQL 迁移，禁止启动时 AutoMigrate。外键、唯一约束、事务是并发正确性的保障。
- Cookie 登录：随机会话令牌，数据库仅存哈希，HttpOnly、SameSite=Lax，生产 Secure。写接口验证 Origin，OAuth state 一次性消费并使用 PKCE。
- 不记录 cookie、OAuth code、密钥或令牌。所有 SQL 参数绑定；不拼接客户端排序或条件。
- 评论纯文本；打卡按用户与章节唯一；排行榜依据数据库打卡数量，不接收客户端积分。
- 新接口同步 README 和测试。执行 `go fmt ./...`、`go vet ./...`、`go test ./...`，涉及数据库执行 PostgreSQL 集成测试。不得声称未运行的验证已通过。
