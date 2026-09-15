# 学习路线

## 第一阶段：看数据

先阅读 Responses 请求和流式事件，理解 harness 如何组织上下文、工具定义和工具结果。记住：harness 的核心工作是把数据可靠地传给 AI，再把 AI 返回的数据变成下一步输入。

## 第二阶段：看 Rust 边界

阅读协议和线程边界：

```text
thread_manager.rs
  -> codex_thread.rs
  -> session/session.rs
  -> session/handlers.rs
```

重点观察 JSON 数据如何被 `Op`、`Submission`、`Event` 和 `EventMsg` 表达。

## 第三阶段：看一轮模型调用

阅读 `session/turn.rs`、`client_common.rs` 和 `client.rs`，回答三个问题：

1. 当前历史如何转换成模型请求？
2. 流式响应如何被解析成事件？
3. 工具输出如何追加回历史并触发下一轮？

## 第四阶段：用测试验证

阅读 `mini-codex-rs/crates/core/tests/tool_harness.rs`，它使用假模型返回 `exec_command`，执行命令
后再检查下一次请求是否携带 `function_call_output`。
