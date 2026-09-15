# mini-codex 中文说明

Rust 执行代码位于 [mini-codex-rs](mini-codex-rs/README.md)，中文架构导读位于
[mini-codex-docs](mini-codex-docs/)。

当前仓库固定使用中文用户文案和 system prompt；Rust 标识符、JSON 字段、Responses API 事件名
和工具名称保持英文，以便与真实 Codex 代码及 API 对应。

```bash
cd /Users/hfh/Desktop/github/mini-codex/mini-codex-rs
cargo test --workspace
```

运行时设置 `DEEPSEEK_API_KEY` 使用 DeepSeek；默认 endpoint 是 `https://api.deepseek.com`，
路由为 `/responses`，模型为 `deepseek-v4-flash`。也可以通过 `MINI_CODEX_BASE_URL` 和
`MINI_CODEX_MODEL` 覆盖。

启动 VitePress 文档：

```bash
cd /Users/hfh/Desktop/github/mini-codex/mini-codex-docs
pnpm install
pnpm docs:dev
```

根目录的 `Makefile` 只负责跨项目编排：

```bash
make install
make docs-dev
make docs-build
make rust-test
make test
```
