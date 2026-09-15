# mini-codex Rust 内核

这是 Rust 执行内核，使用 Cargo workspace 管理 `protocol`、`core` 和 `cli` 三个 crate。

## 源码结构

```text
mini-codex-rs/
├── Cargo.toml
├── Cargo.lock
└── crates/
    ├── protocol/src/lib.rs
    ├── core/src/
    │   ├── thread_manager.rs
    │   ├── codex_thread.rs
    │   ├── client_common.rs
    │   ├── client.rs
    │   ├── context_manager.rs
    │   ├── localization.rs
    │   ├── session/{session.rs,handlers.rs,turn.rs}
    │   └── tools/{registry.rs,router.rs,handlers/exec_command.rs}
    ├── core/tests/tool_harness.rs
    └── cli/src/main.rs
```

核心调用链：

```text
ThreadManager
  -> CodexThread
  -> Session / submission_loop
  -> run_turn
  -> ModelClient
  -> ToolRouter
  -> history
```

## 运行

```bash
export DEEPSEEK_API_KEY=你的_deepseek_key
export MINI_CODEX_BASE_URL=https://api.deepseek.com
export MINI_CODEX_MODEL=deepseek-v4-flash
cargo run -p mini-codex-cli
```

默认使用 DeepSeek Responses API。API Key 优先从 `DEEPSEEK_API_KEY` 读取，也兼容
`OPENAI_API_KEY`；密钥不会写入仓库。可通过 `MINI_CODEX_BASE_URL` 和 `MINI_CODEX_MODEL` 覆盖默认配置。

## 验证

```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

当前 `exec_command` 仍然直接执行 shell，尚未实现生产 Codex 的 sandbox、审批、取消、rollout
恢复、context compaction、MCP 和 subagents。不要在不可信 prompt 或敏感目录中运行。
