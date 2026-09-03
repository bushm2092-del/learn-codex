# Harness 核心循环

mini-codex 的 harness 是一个“模型决定下一步、运行时执行工具、结果回到模型”的循环：

```text
用户输入
  ↓
ThreadManager 创建 CodexThread
  ↓
Session 接收 UserTurn
  ↓
Turn 构造 prompt 并调用 ModelClient
  ↓
模型返回文本或 function_call
  ↓
ToolRouter 路由到 exec_command
  ↓
追加 function_call_output 到 history
  ↓
再次调用 ModelClient，直到模型结束
```

## 代码入口

- `crates/core/src/thread_manager.rs`：创建和持有线程。
- `crates/core/src/codex_thread.rs`：线程级消息提交入口。
- `crates/core/src/session/turn.rs`：执行一轮模型与工具循环。
- `crates/core/src/client.rs`：发起 Responses API 请求并读取流式事件。
- `crates/core/src/tools/router.rs`：按工具名分发调用。
- `crates/core/src/context_manager.rs`：维护发送给模型的历史。

这里最重要的设计是：工具执行结果不是直接展示后就丢弃，而是以协议规定的
`function_call_output` 形式追加进上下文，让模型决定下一步行动。

## 当前边界

这是教学实现，当前只保留 `exec_command` 一个工具，并且直接执行 shell。真实 Codex 还包含
sandbox、审批、取消、rollout 恢复、context compaction、MCP 和 subagents 等更完整的运行时能力。
