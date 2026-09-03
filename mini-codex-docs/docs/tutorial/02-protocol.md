# 2. 定义协议层

<div class="tutorial-goal"><strong>本章目标：</strong>用稳定的数据类型隔离 CLI 和 Agent 内核。</div>

源码位置：`mini-codex-rs/crates/protocol/src/lib.rs`。

## 输入：Op 与 Submission

```rust
pub enum Op {
    UserTurn { text: String },
    Shutdown,
}

pub struct Submission {
    pub id: String,
    pub op: Op,
}
```

`Submission` 为每次操作补充唯一标识。事件异步返回时，调用方依靠 `submission_id` 判断每个增量、工具事件和完成事件属于哪次提交。

## 输出：Event 与 EventMsg

一次回合不只返回最终字符串，它会依次产生：

```text
TurnStarted
AgentMessageDelta(...)
ToolCallStarted { ... }
ToolCallCompleted { ... }
AgentMessage(...)
TurnCompleted { ... }
```

CLI、TUI 或未来的 Web 界面都只消费这些事件，不需要知道模型客户端和工具实现的细节。

## 模型可见工具

`ToolSpec` 描述工具名称、说明和 JSON Schema；`FunctionCall` 保留 Responses API 的 `call_id`、`name` 和 JSON 字符串参数。

协议字段保持英文，中文只用于说明、提示词和用户界面。

## 检查点

- 协议类型没有引用 `reqwest`、shell 或 CLI。
- `EventMsg` 能描述模型文本、工具生命周期、错误和关闭。
- 工具调用保留 `call_id`，以便输出可以和调用配对。
