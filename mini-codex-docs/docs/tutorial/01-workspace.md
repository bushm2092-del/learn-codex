# 1. 建立 Rust workspace

<div class="tutorial-goal"><strong>本章目标：</strong>建立 protocol、core、cli 三层边界，并让 Cargo 能统一检查整个项目。</div>

## 为什么拆成三个 crate

```text
cli → core → protocol
```

- `protocol` 只定义跨边界传输的数据，不执行任务。
- `core` 持有 Agent 生命周期、模型调用和工具执行。
- `cli` 负责读取配置、提交用户输入和展示事件。

这与真实 Codex 将 `codex-rs/protocol`、`codex-rs/core` 和命令入口分开的思路一致。

## 创建目录

```bash
mkdir -p mini-codex-rs/crates/{protocol,core,cli}/src
cd mini-codex-rs
```

根 `Cargo.toml` 只负责 workspace：

```toml
[workspace]
members = ["crates/cli", "crates/core", "crates/protocol"]
resolver = "2"

[workspace.package]
edition = "2024"
license = "MIT"
version = "0.1.0"
```

## 建立依赖方向

`core` 依赖 `protocol`，`cli` 同时依赖 `core` 与 `protocol`。不要让 `protocol` 反向引用业务实现，否则协议层会失去独立性。

## 验证

```bash
cargo check --workspace
```

下一章将先定义三个 crate 共享的输入、输出和工具调用协议。
