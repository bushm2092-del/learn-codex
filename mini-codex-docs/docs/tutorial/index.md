# mini-codex 教程总纲

这套教程不从“如何调用一个模型 SDK”开始，而是从一个更重要的工程事实开始：

> Harness 的核心工作，是围绕模型接口组织数据。

Prompt Engineering 和 Context Engineering 看起来是在写提示词、拼接上下文，实际上处理的是同一个问题：

```text
什么数据
以什么结构
在什么时机
通过什么接口
传给 AI
```

## 学习目标

完成这套教程后，你应该能够看懂并实现一个最小 Agent Loop：

```text
用户输入
  ↓
组织请求数据
  ↓
调用 Responses API
  ↓
解析文本或结构化动作
  ↓
执行工具
  ↓
把结果追加到上下文
  ↓
再次调用模型
  ↓
得到最终回答
```

## 课程路线

| 阶段 | 主题 | 要回答的问题 |
| --- | --- | --- |
| 1 | [Harness 的本质：和 AI 玩数据](./01-responses-protocol) | 模型接口到底传递什么数据？ |
| 2 | 用 Rust 表达协议 | 如何用类型表达请求、事件和工具调用？ |
| 3 | Thread 与 Session | 如何让调用方和后台 Agent 解耦？ |
| 4 | 模型与工具循环 | 如何把工具结果送回下一轮模型请求？ |
| 5 | CLI 与集成测试 | 如何验证数据确实穿过完整闭环？ |
| 6 | [App-server 与 Ink TUI](./06-app-server-ink) | 如何让 React 终端界面连接 Rust 内核？ |
| 7 | [config.toml：模型与 provider](./07-config) | 模型、provider 和密钥来源如何按 Codex 方式配置？ |
| 8 | [/model：运行中切换模型](./08-model-selection) | 模型为什么是会话设置？如何在不丢注释的前提下写回 config.toml？ |
| 9 | 继续扩展 | 如何加入审批、sandbox、持久化、MCP 和 subagents？ |

## 阅读方法

每一节都按四个层次阅读：

1. **先看数据**：请求、响应、事件、工具参数和执行结果是什么。
2. **再看边界**：数据在哪个模块产生，经过哪个接口传递。
3. **然后看循环**：一次数据如何变成下一次数据。
4. **最后看测试**：如何证明数据没有在中途丢失或变形。

## 对应代码

Rust 实现位于 `/Users/hfh/Desktop/github/mini-codex/mini-codex-rs`：

```text
protocol  → 跨模块的数据类型
core      → 数据流和 Agent Loop
cli       → 用户输入与事件展示
```

先阅读[第一节](./01-responses-protocol)，暂时不要跳到工具实现。理解数据流之后，再看 Rust 代码会更容易。
