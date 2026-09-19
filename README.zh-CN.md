# mini-codex 中文说明

Rust 执行代码位于 [mini-codex-rs](mini-codex-rs/README.md)，中文架构导读位于
[mini-codex-docs](mini-codex-docs/)。

当前仓库固定使用中文用户文案和 system prompt；Rust 标识符、JSON 字段、Responses API 事件名
和工具名称保持英文，以便与真实 Codex 代码及 API 对应。

```bash
cd /Users/hfh/Desktop/github/mini-codex/mini-codex-rs
cargo test --workspace
```

密钥写在 `~/.mini-codex/.env`（`DEEPSEEK_API_KEY=...`，启动时自动加载），模型与 provider 可选地
在 `~/.mini-codex/config.toml` 中覆盖；目录可用 `MINI_CODEX_HOME` 更换。详见根目录
[README.md](README.md) 的“配置：config.toml 与模型选择”一节。

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
