# mini-codex TUI

<!-- impeccable:product-schema 1 -->

## Platform

终端应用（不是浏览器页面）。

## Stack

用户指定 Ink + React，位于 `frontends/tui/`。Rust app-server 通过 stdio JSONL 提供会话能力。

## Product Purpose

为 mini-codex 教学内核提供可实际使用的终端交互入口。

## Capabilities and Constraints

用户确认：现有内核支持的交互严格对齐本地 Codex TUI，其余明确标注未支持。
内核、工具执行和模型请求继续由 Rust 负责。仅有 DeepSeek env_key provider，不移植官方登录。

## Brand Commitments

复用 Codex 的终端信息层级、快捷键和命令语义，不另设计视觉体系。产品名称使用 mini-codex，避免冒充官方客户端。

## Evidence on Hand

`/Users/hfh/Desktop/github/codex/codex-rs/tui/src/` 的实现及快照；本仓库 app-server 的协议与集成测试。
