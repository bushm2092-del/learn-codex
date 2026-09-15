# mini-codex

这是一个围绕真实 Codex Rust 代码组织方式搭建的教学 monorepo。Rust 执行内核和 VitePress
静态文档保持平级，便于一边读代码、一边看架构说明。

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

## 项目结构

```text
mini-codex/
├── mini-codex-rs/          # Rust workspace：协议、核心循环、工具和 CLI
│   ├── Cargo.toml
│   └── crates/
├── mini-codex-docs/        # VitePress：中文架构与源码导读
│   ├── docs/
│   └── package.json
├── Makefile                 # 跨项目开发命令
├── README.md
└── README.zh-CN.md
```

Rust 目录的详细模块说明见 [mini-codex-rs/README.md](mini-codex-rs/README.md)，文档站源码在
[mini-codex-docs/docs](mini-codex-docs/docs)。

## 中文提示词和注释

所有用户可见文案和 system prompt 都集中在
[localization.rs](mini-codex-rs/crates/core/src/localization.rs) 的 `PromptCatalog` 中；CLI 和 turn loop
不再散落硬编码文案。源码注释只对架构边界、生命周期和安全约束写中文，Rust 标识符、JSON
字段和 Responses API 事件名保持英文，以便与真实代码对应。

## 运行

```bash
cd /Users/hfh/Desktop/github/mini-codex/mini-codex-rs
export DEEPSEEK_API_KEY=你的_deepseek_key
export MINI_CODEX_BASE_URL=https://api.deepseek.com
export MINI_CODEX_MODEL=deepseek-v4-flash
cargo run -p mini-codex-cli
```

默认使用 DeepSeek Responses API。API Key 优先从 `DEEPSEEK_API_KEY` 读取，也兼容
`OPENAI_API_KEY`；密钥不会写入仓库。可通过 `MINI_CODEX_BASE_URL` 和 `MINI_CODEX_MODEL` 覆盖默认配置。

输入例如：

```text
列出当前目录的文件，并总结这个项目的结构。
```

## 验证

```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
```

## 文档站

```bash
cd /Users/hfh/Desktop/github/mini-codex/mini-codex-docs
pnpm install
pnpm docs:dev
```

也可以在仓库根目录使用 Makefile：

```bash
make install
make docs-dev
make docs-build
make rust-test
make test
```

离线集成测试会让假模型先返回 `exec_command`，执行真实命令，再验证第二次 prompt 携带
`function_call_output`。

Responses API 当前的工具定义、流式响应和函数调用形状见
[官方 API 文档](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)。

## 当前限制

`exec_command` 目前直接执行 shell，尚未实现生产 Codex 的 sandbox、审批、取消、rollout 恢复、
context compaction、MCP 和 subagents。因此不要在不可信 prompt 或敏感目录中运行。

建议后续按以下顺序扩展：

1. `Interrupt` 和 cancellation
2. 工具并行执行
3. approval policy 和 sandbox
4. rollout 持久化与恢复
5. context window 和 compaction
6. pending input 与 turn steering
7. MCP
8. subagents
