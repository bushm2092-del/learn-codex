# 学习路线

## 第一阶段：看边界

先阅读 `mini-codex-rs/crates/protocol/src/lib.rs`，理解 Responses API 的请求、事件和工具调用
数据结构。协议字段保持英文，是为了和真实 API 对齐。

## 第二阶段：看线程生命周期

阅读顺序：

```text
thread_manager.rs
  -> codex_thread.rs
  -> session/session.rs
  -> session/handlers.rs
```

重点观察线程如何创建 session，以及输入如何进入 submission loop。

## 第三阶段：看一轮模型调用

阅读 `session/turn.rs`、`client_common.rs` 和 `client.rs`，回答三个问题：

1. 当前历史如何转换成模型请求？
2. 流式响应如何被解析成事件？
3. 工具输出如何追加回历史并触发下一轮？

## 第四阶段：用测试验证

阅读 `mini-codex-rs/crates/core/tests/tool_harness.rs`，它使用假模型返回 `exec_command`，执行命令
后再检查下一次请求是否携带 `function_call_output`。
