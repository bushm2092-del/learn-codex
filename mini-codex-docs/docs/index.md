---
layout: home

hero:
  name: mini-codex
  text: 从零读懂 Agent Harness
  tagline: 对照真实 Codex 的职责边界，用一个可运行的 Rust 项目理解线程、模型、工具与上下文循环。
  actions:
    - theme: brand
      text: 开始搭建
      link: /tutorial/01-workspace
    - theme: alt
      text: 查看核心循环
      link: /guide/harness-core

features:
  - title: 真实代码对应
    details: 每章都指向 mini-codex-rs 中可以运行和测试的 Rust 文件，而不是孤立的伪代码。
  - title: 逐层搭建
    details: 从 Cargo workspace 和协议层开始，逐步连接 Thread、Session、ModelClient 与工具执行。
  - title: 测试驱动理解
    details: 最终使用脚本化模型验证 function_call、工具输出回灌和第二次模型采样。
---

## 一次回合如何运行

下面的 Vue 组件展示一次用户回合穿过 harness 的过程。点击步骤查看负责模块和关键数据。

<HarnessFlow />

## 你最终会得到什么

完成五章后，你会拥有一个支持以下流程的最小实现：

```text
用户输入 → 模型流式响应 → 工具调用 → 命令执行 → 输出回灌 → 模型最终回答
```

它刻意不隐藏生产级能力的边界：sandbox、审批、取消、持久化、上下文压缩和 MCP 会作为后续阶段继续增加。
