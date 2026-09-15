# 1. Harness 的本质：和 AI 玩数据

<div class="tutorial-goal"><strong>本章目标：</strong>理解Harness的核心就是组织上下文数据然后通过llm api 传递给 模型</div>

## 先建立一个工程认识

不要把 Agent 想象成一个会自动完成任务的黑盒。模型真正做的事情很简单：读取输入数据，然后预测下一段文本或结构化动作。

Harness 负责把数据串联起来：

```text
组织数据 → 通过接口发送给 AI → 解析返回数据 → 执行数据中描述的动作
       ↑                                              ↓
       └──────────── 把结果追加回数据，再次发送 ────────┘
```

下面用一次具体对话模拟完整的数据循环。点击播放，观察左侧对话和右侧 Harness 数据如何同步变化。

<HarnessFlow />

## 动手测试 Responses 接口

下面的测试台直接向你填写的 `response-url` 发起流式请求，并把响应体原样显示出来。不会省略事件、字段或数据；API Key 只在当前浏览器页面内存中使用，不会保存。

<ResponseTester />

如果目标 endpoint 不允许浏览器跨域，请使用同样的字段通过 curl 或 Rust CLI 请求。浏览器的 CORS 限制不代表接口本身不可用。

## 模拟一个最简单的agent

Prompt 不只是一段写给模型看的文字。一次请求通常包含：

```text
instructions  全局行为约束
input         用户任务和历史上下文
tools         模型可以请求的能力
schema        工具参数的结构约束
```

例如 mini-codex 向 Responses API 发送的请求可以抽象为：

```json
{
  "model": "deepseek-v4-flash",
  "instructions": "你是一个小型编程代理……",
  "input": [
    {
      "role": "user",
      "content": [
        {"type": "input_text", "text": "列出当前目录的文件"}
      ]
    }
  ],
  "tools": [
    {
      "type": "function",
      "name": "exec_command",
      "parameters": {
        "type": "object",
        "properties": {"cmd": {"type": "string"}}
      }
    }
  ],
  "tool_choice": "auto",
  "stream": true
}
```

`input` 告诉模型“已经发生了什么”，`tools` 告诉模型“可以要求我做什么”。好的提示词工程，本质上是在设计一组清晰、相关、可控的数据。

## Context Engineering 其实是在管理数据

上下文工程要解决的不是“历史越多越好”，而是：

```text
哪些数据必须保留？
哪些数据可以压缩？
哪些数据应该删除？
数据如何排序？
数据如何标记来源？
```

如果把所有内容拼成一段大字符串，模型难以区分用户消息、工具调用和工具结果。结构化数据则可以明确表达：

```text
role       谁产生了这条消息
type       这是什么数据
call_id    这次工具调用的身份
arguments  工具需要什么输入
output     工具返回了什么
```

## Responses 返回的也是数据

开启流式响应后，模型不是一次性返回一个字符串，而是返回一系列事件：

```text
response.output_text.delta  → 文本增量
response.output_item.done  → 完整输出项
response.completed          → 本次响应结束
```

`response.output_item.done` 可能表示普通 `message`，也可能表示 `function_call`。Harness 必须先判断数据类型，再决定是展示还是执行。

## Agent Loop 如何产生

模型返回工具调用时，它只是返回了一段结构化数据：

```json
{
  "type": "function_call",
  "call_id": "call-1",
  "name": "exec_command",
  "arguments": "{\"cmd\":\"ls\"}"
}
```

Harness 会执行四步：

1. 解析工具名称、调用 ID 和参数。
2. 查找并执行本地工具。
3. 收集 stdout、stderr、退出码等结果数据。
4. 将结果使用相同的 `call_id` 追加到下一次请求：

```json
{
  "type": "function_call_output",
  "call_id": "call-1",
  "output": "命令执行结果"
}
```

然后，Harness 再次发送完整上下文。Agent 的连续行动来自这个数据闭环，而不是模型真的“记住”了命令。

## 如何更好地把数据传给 AI

### 1. 使用结构化数据

优先使用 `role`、`type`、`call_id` 和 JSON Schema，不要把所有信息拼成无边界文本。

### 2. 保持完整但有界

提供模型做决定所需的上下文，同时限制历史长度、工具输出大小和最大循环次数。

### 3. 保持稳定可追踪

每次提交有 `submission_id`，每次工具调用有 `call_id`，异步事件才能准确配对。

### 4. 让结果可回放

工具输入和输出都进入 history。这样日志、测试和问题排查都可以还原“当时到底给模型传了什么”。

## 对应 mini-codex 源码

| 概念 | 文件 |
| --- | --- |
| 请求和 SSE 解析 | `mini-codex-rs/crates/core/src/client.rs` |
| Prompt 类型 | `mini-codex-rs/crates/core/src/client_common.rs` |
| 历史记录 | `mini-codex-rs/crates/core/src/context_manager.rs` |
| 工具输出回灌 | `mini-codex-rs/crates/core/src/session/turn.rs` |
| 协议类型 | `mini-codex-rs/crates/protocol/src/lib.rs` |

## 本章结论

```text
Prompt Engineering = 设计输入数据
Context Engineering = 管理历史数据
Agent Harness = 驱动数据循环
```

下一章再把这些 JSON 数据映射成 Rust 的 `Op`、`Submission`、`Event` 和 `FunctionCall` 类型。
