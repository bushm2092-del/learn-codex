export const contextLesson = {
  zh: {
    summary: "上一节执行了工具，这一节看工具结果如何进入下一次请求。模型能继续推理，是因为 harness 把更新后的上下文再次发送给了它。",
    sections: [
      { title: "上下文就是这次请求提供给模型的信息", paragraphs: [
        "用户输入、模型已经生成的消息、工具调用和工具结果，都会影响下一次回答。对 harness 来说，关键问题是：保留哪些信息，以什么顺序组织，最终把哪些内容放进请求。",
        "上下文不只是聊天记录。当前 mini-codex 的 Prompt 将 input（历史项）、tools（工具定义）、instructions（入口提供的指令）和 parallel_tool_calls（调用配置）分别保存；客户端再将它们序列化为请求字段。",
      ], code: "pub struct Prompt {\n    pub input: Vec<ResponseItem>,\n    pub tools: Vec<ToolSpec>,\n    pub parallel_tool_calls: bool,\n    pub instructions: String,\n}", label: "crates/core/src/client_common.rs · Prompt" },
      { title: "history 保存什么？", paragraphs: [
        "在 crates/core/src/context_manager.rs 中，ContextManager 保存一个 Vec<ResponseItem>。这里用协议对象而不是一段拼接文本，才能保留 message、function_call 和 function_call_output 各自的结构。",
        "record 将完成的项目追加到末尾；for_prompt 复制当前历史，作为本次请求的输入。它不会因为请求发出就清空历史，也没有在这里生成摘要。下面是当前 mini-codex 的真实实现。",
      ], code: "#[derive(Clone, Debug, Default)]\npub(crate) struct ContextManager {\n    items: Vec<ResponseItem>,\n}\n\nimpl ContextManager {\n    pub(crate) fn record(&mut self, item: ResponseItem) {\n        self.items.push(item);\n    }\n\n    pub(crate) fn for_prompt(&self) -> Vec<ResponseItem> {\n        self.items.clone()\n    }\n}", label: "crates/core/src/context_manager.rs · 节选" },
      { title: "一次工具调用怎样更新历史？", paragraphs: [
        "在 crates/core/src/session/turn.rs 中，run_turn 先记录用户输入。进入模型循环后，用当前历史创建 Prompt；收到 OutputItemDone 时，先记录模型完整输出，再识别并调度工具。流式文字增量用于界面展示，历史记录使用完成后的输出项。",
        "模型响应结束后，循环从 FuturesOrdered 收集工具结果，并将结果写入历史。发生工具调用时 needs_follow_up 为 true，于是下一次循环再次调用 for_prompt，此时历史已经包含用户输入、模型调用和工具结果。多个工具结果按任务入队顺序收集，执行本身是否并行由工具运行时控制。",
        "顺序可以概括为：用户输入 → 模型的 function_call → 同 call_id 的 function_call_output → 再次请求模型。不能只传结果却丢掉对应调用；call_id 让模型知道每一份结果属于哪次调用。",
      ], code: "let prompt = Prompt {\n    input: session.history.lock().await.for_prompt(),\n    tools: session.tool_router.model_visible_specs().to_vec(),\n    parallel_tool_calls: true,\n    instructions: session.instructions.clone(),\n};", label: "crates/core/src/session/turn.rs · 每次循环重新组装请求" },
      { title: "真实 Codex 会先整理历史，再发送", paragraphs: [
        "源项目 codex-rs/core/src/context_manager/history.rs 的 ContextManager 比这个教学版本更完整。for_prompt 经由 for_prompt_annotated 调用 normalize_history，再取出模型输入。原始记录与发给模型的历史不是完全相同的概念。",
        "normalize_history 会补齐缺失的工具结果、移除没有对应调用的孤立结果，并按模型支持的输入模态处理图片和音频。记录工具输出时还会使用截断策略。这些步骤用于维持协议结构和控制内容大小，并不是任意删除聊天消息。",
        "本章第一稿先把历史流向讲清楚。这些整理、截断行为尚未在当前 mini-codex 的 ContextManager 中实现，不能把下面的源码节选当成它已有的能力。",
      ], code: "// Codex：codex-rs/core/src/context_manager/history.rs（节选）\nnormalize::ensure_call_outputs_present(items);\nnormalize::remove_orphan_outputs(items);\nnormalize::strip_images_when_unsupported(input_modalities, items);\nnormalize::strip_audio_when_unsupported(input_modalities, items);", label: "真实 Codex · normalize_history" },
      { title: "历史不能无限增长", paragraphs: [
        "每次追加消息和工具输出，下一次请求的上下文就可能变大。模型的上下文窗口有容量限制，这个限制按 token 衡量，不等于字符串长度、消息数量或界面显示行数。",
        "真实 Codex 的 ContextManager 提供 token 估算，session/turn.rs 在采样前及循环推进时检查上下文状态，按配置和模型能力进入自动压缩或其他已支持的上下文处理分支。工具输出截断与历史压缩是两个不同环节：前者限制单次结果，后者处理累积上下文。",
        "当前 mini-codex 仍复制全部历史，没有自动压缩、token 预算或超长历史恢复机制。接下来将沿 history.rs、context_manager/normalize.rs、session/context_window.rs 和 session/turn.rs 继续拆解这些真实实现。",
      ] },
    ],
    back: "回顾第四节：Codex Function Calling 源码",
  },
  en: {
    summary: "The previous chapter executed a tool. This chapter follows its result into the next request: the harness sends the updated context so the model can continue reasoning.",
    sections: [
      { title: "Context is what this request gives the model", paragraphs: ["User input, assistant messages, tool calls, and tool results can all influence the next answer. The harness decides what to retain, how to order it, and what to send.", "In mini-codex, Prompt keeps input history, tools, instructions, and parallel_tool_calls as separate fields. The client serializes them into the request."], code: "pub struct Prompt {\n    pub input: Vec<ResponseItem>,\n    pub tools: Vec<ToolSpec>,\n    pub parallel_tool_calls: bool,\n    pub instructions: String,\n}", label: "crates/core/src/client_common.rs · Prompt" },
      { title: "What does history store?", paragraphs: ["ContextManager in crates/core/src/context_manager.rs stores Vec<ResponseItem>. Protocol objects preserve the structure of messages, function calls, and their outputs.", "record appends an item; for_prompt clones the current history. Sending a request does not clear it or summarize it. This is the current mini-codex implementation."], code: "#[derive(Clone, Debug, Default)]\npub(crate) struct ContextManager {\n    items: Vec<ResponseItem>,\n}\n\nimpl ContextManager {\n    pub(crate) fn record(&mut self, item: ResponseItem) {\n        self.items.push(item);\n    }\n\n    pub(crate) fn for_prompt(&self) -> Vec<ResponseItem> {\n        self.items.clone()\n    }\n}", label: "crates/core/src/context_manager.rs · excerpt" },
      { title: "How does a tool call update history?", paragraphs: ["run_turn in crates/core/src/session/turn.rs records user input before sampling. OutputItemDone records the complete model output before tool dispatch. Text deltas update the interface; completed items enter history.", "After the model response ends, FuturesOrdered collects tool results in enqueue order and appends them to history. Tool execution may be concurrent. With needs_follow_up set, the next iteration builds a new Prompt from that updated history.", "The order is user input → function_call → function_call_output with the same call_id → another model request. The call identifier connects each result to its call."], code: "let prompt = Prompt {\n    input: session.history.lock().await.for_prompt(),\n    tools: session.tool_router.model_visible_specs().to_vec(),\n    parallel_tool_calls: true,\n    instructions: session.instructions.clone(),\n};", label: "crates/core/src/session/turn.rs · rebuilding the request" },
      { title: "Codex normalizes history before sending it", paragraphs: ["The upstream ContextManager in codex-rs/core/src/context_manager/history.rs is more complete. for_prompt calls for_prompt_annotated, which normalizes history before extracting model input.", "Normalization supplies missing tool outputs, removes orphan outputs, and handles images and audio according to supported input modalities. Tool outputs also pass through a truncation policy during recording.", "These behaviors are not implemented in the current mini-codex ContextManager. This draft first establishes how history flows."], code: "// Codex: codex-rs/core/src/context_manager/history.rs (excerpt)\nnormalize::ensure_call_outputs_present(items);\nnormalize::remove_orphan_outputs(items);\nnormalize::strip_images_when_unsupported(input_modalities, items);\nnormalize::strip_audio_when_unsupported(input_modalities, items);", label: "Upstream Codex · normalize_history" },
      { title: "History cannot grow forever", paragraphs: ["Messages and tool outputs increase the context sent in subsequent requests. Context windows are measured in tokens, not characters, message counts, or displayed lines.", "Codex estimates token usage and checks context state before sampling and during the turn loop. Configuration and model capabilities determine the available compaction or context-management branch. Truncating an individual tool output and compacting accumulated history serve different purposes.", "Current mini-codex copies all history and has no automatic compaction, token budget, or recovery for oversized history. Further sections will follow history.rs, context_manager/normalize.rs, session/context_window.rs, and session/turn.rs." ] },
    ],
    back: "Previous chapter: Codex Function Calling source",
  },
};
