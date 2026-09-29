// 源码节选以 Codex 53446f90a5 为基准；只省略注释、派生宏与辅助成员，不作为独立可运行程序。
export const toolTypeExcerpts = {
  call: `pub struct ToolCall {
    pub tool_name: ToolName,
    pub call_id: String,
    pub payload: ToolPayload,
    pub encrypted_function_args: Option<Vec<String>>,
}

pub enum ToolPayload {
    Function { arguments: String },
    ToolSearch { arguments: SearchToolCallParams },
    Custom { input: String },
}`,
  invocation: `pub struct ToolInvocation {
    pub session: Arc<Session>,
    pub turn: Arc<TurnContext>,
    pub(crate) step_context: Arc<StepContext>,
    pub cancellation_token: CancellationToken,
    pub tracker: SharedTurnDiffTracker,
    pub call_id: String,
    pub tool_name: ToolName,
    pub source: ToolCallSource,
    pub payload: ToolPayload,
}`,
  executor: `// ToolExecutor 的关键方法节选，省略默认实现及其他方法。
pub trait ToolExecutor<Invocation>: Send + Sync {
    fn tool_name(&self) -> ToolName;
    fn spec(&self) -> ToolSpec;
    fn handle<'a>(&'a self, invocation: Invocation) -> ToolExecutorFuture<'a>
    where
        Invocation: 'a;
}

pub type ToolExecutorFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Box<dyn ToolOutput>, FunctionCallError>> + Send + 'a>>;`,
  result: `pub(crate) struct AnyToolResult {
    pub(crate) call_id: String,
    pub(crate) payload: ToolPayload,
    pub(crate) result: Box<dyn ToolOutput>,
    pub(crate) post_tool_use_payload: Option<PostToolUsePayload>,
}`,
};

export const toolArchitecture = {
  zh: {
    title: "tools 不是一组函数，而是一套调用边界",
    intro: "上一章的 get_weather 可以用一个 match 执行。但真实 Codex 还要处理不同工具的参数格式、异步执行、并发、取消、hooks 与历史记录。如果这些都写进 turn loop，每新增一个工具就要修改主循环。下面按源码职责拆开看；“为什么”是结合字段、注释与调用位置作出的设计解读。",
    mapTitle: "先分清两个 tools 目录",
    modules: [
      { name: "tools/src/", text: "通用契约层：ToolSpec、ToolPayload、ToolExecutor、ToolOutput。这里用泛型 Invocation 表示宿主传入的上下文，不直接把 core 的 Session 固定在执行接口里。core/src/tools/context.rs 和 registry.rs 中的部分 pub use 是重导出，不是类型定义所在地。" },
      { name: "core/src/tools/spec_plan.rs", text: "组装层：build_tool_router、build_core_tool_registry、finalize_tool_router 结合当前配置、模型能力和策略，组装注册表与模型可见规格。不是把仓库里所有工具无条件放进请求。" },
      { name: "core/src/tools/router.rs · registry.rs", text: "路由与分派层：router 将协议项转换为调用对象、补齐宿主上下文；registry 按 ToolName 查找运行实现，校验载荷种类，并组织 hooks、日志和执行。路由器不实现每个工具的业务逻辑。" },
      { name: "core/src/tools/parallel.rs · context.rs", text: "调用生命周期与数据：parallel 控制调用任务的并发入口和取消路径；context 定义执行上下文与 core 专用输出类型。不要把 ToolCallRuntime 与某个 shell 工具的底层运行实现混为一谈。" },
      { name: "core/src/tools/handlers/ · runtimes/", text: "具体实现：从被注册的 handler 跟进参数解析和实际操作。涉及审批与沙箱的执行路径继续进入 orchestrator.rs、sandboxing.rs 和相应 runtime；不是所有工具都会启动进程或经过同一条沙箱路径。" },
    ],
    typesTitle: "核心类型：每一个对象解决什么问题",
    excerpt: "源码节选 · 非独立可运行示例",
    types: [
      { name: "ToolSpec：给模型看的使用说明", path: "tools/src/tool_spec.rs · tools/src/responses_api.rs", text: "ToolSpec 是带 type 标签的可序列化枚举；普通函数使用 Function(ResponsesApiTool)，此外还有 Namespace、ToolSearch、WebSearch、Freeform。函数规格包含名称、描述、parameters 等协议数据。它回答“模型能请求什么、参数怎样写”，不包含本地 Rust 函数指针。parameters 也不是这一次调用的真实参数。", why: "为什么单独定义？模型请求要的是可序列化说明，而本地执行需要代码与宿主状态，两者生命周期和用途不同。尤其 WebSearch 这样的托管规格，不能推断为一个由本地 registry 执行的普通函数。" },
      { name: "ToolCall 与 ToolPayload：模型这次想做什么", path: "core/src/tools/router.rs · tools/src/tool_payload.rs", code: "call", text: "ToolCall 是从响应识别出来的一次调用：tool_name 决定找谁，call_id 标识哪一次调用，payload 保存输入。ToolName 是带命名空间的工具标识；不要把相同工具名的多次调用和同一次调用混淆。encrypted_function_args 保留加密参数相关信息，普通路径阅读时先关注前三个字段。", why: "为什么不直接传一个 JSON Value？ToolPayload 用枚举区分 Function、ToolSearch、Custom，防止把自由文本输入当成函数 JSON。Function.arguments 此时仍是字符串；识别为函数调用并不代表参数已经通过具体工具的解析与校验。" },
      { name: "ToolInvocation：给执行代码的工作上下文", path: "core/src/tools/context.rs", code: "invocation", text: "调用名和参数不足以完成真实操作。session 提供会话对象；turn / step_context 提供当前轮次与步骤上下文；cancellation_token 让取消可传递；tracker 共享本轮变更跟踪；source 区分直接调用与 Code Mode 等来源。源码还注明 turn 是兼容字段，等待 handler 改用 step_context.turn。", why: "为什么与 ToolCall 分开？ToolCall 表达模型请求，ToolInvocation 表达宿主批准进入分派时提供的执行环境。模型只生成调用数据，不会通过 JSON 构造 Arc<Session> 或获得任意宿主权限。Arc 用于异步任务间共享对象，不等于复制整个会话。" },
      { name: "ToolExecutor 与 CoreToolRuntime：统一执行接口", path: "tools/src/tool_executor.rs · core/src/tools/registry.rs", code: "executor", text: "ToolExecutor<Invocation> 把 tool_name、spec 与 handle 放在同一个运行实现上，将工具说明与可执行实现关联起来。handle 返回异步结果，成功值是 Box<dyn ToolOutput>；不同工具不必返回同一种具体结构。supports_parallel_tool_calls 默认 false。CoreToolRuntime 继承 ToolExecutor<ToolInvocation>，再补充载荷匹配、hooks 元数据、就绪等待等 core 能力。", why: "为什么要 trait？注册表可以用 Arc<dyn CoreToolRuntime> 保存不同工具，而分派代码通过同一接口调用它们。新增工具的业务逻辑留在工具实现中，不必把一个不断增长的工具名 match 塞入主循环。Send / Sync 支持异步共享要求，但是否并行仍由调度层决定。" },
      { name: "ToolRegistry 与 ToolRouter：注册不等于暴露", path: "core/src/tools/registry.rs · core/src/tools/router.rs · tools/src/tool_executor.rs", text: "ToolRegistry 持有 IndexMap<ToolName, RegisteredTool>；RegisteredTool 包含 runtime 和当前生效的 exposure。ToolRouter 同时保存 registry 与 model_visible_specs。ToolExposure 有 Direct、Deferred、Hidden 等状态：工具可已注册，但不出现在初始模型工具列表里。", why: "为什么拆成两层？注册表回答“这个名字对应哪个运行实现”，路由器关联当前工具方案的可见规格与执行入口。工具搜索、Code Mode 和隐藏工具需要不同可见性；不能用请求 tools 数组直接代替整个注册表。未知工具名会得到 RespondToModel，载荷种类不匹配在当前分派实现中是 Fatal。" },
      { name: "ToolCallRuntime：调度一次调用，不执行全部业务", path: "core/src/tools/parallel.rs", text: "它持有 session、step_context、共享变更跟踪器与执行门，并使用步骤上下文中的工具路由。支持并行的工具获取读锁，不支持并行的工具获取写锁；取消路径也在运行时处理。读锁允许多个并行调用同时进入，写锁与这些调用互斥。", why: "为什么有这一层？异步函数能同时启动，不代表文件修改、会话操作等业务允许并发。并发规则与任务取消应该由宿主统一控制，而不是每个 handler 各自维护一套调度器。" },
      { name: "ToolOutput 与 AnyToolResult：执行结束不等于历史已更新", path: "tools/src/tool_output.rs · core/src/tools/context.rs · core/src/tools/registry.rs", code: "result", text: "ToolOutput 是输出契约，核心方法 to_response_item(call_id, payload) 将本地结果转换为协议输入项；log_output 是可能有损的诊断表示，不能当作模型看到的完整结果。FunctionToolOutput、ExecCommandToolOutput 等提供具体转换。AnyToolResult 再把输出和原 call_id、payload、hook 数据装在一起。", why: "为什么不直接返回 String？不同输出可能包含文本、图片、截断预算或 hooks 信息。AnyToolResult::into_response 生成带元数据的历史条目，随后由 turn 层写入历史；函数调用结果沿原 call_id 与模型请求配对。统一输出接口使调度层不必理解每个工具的内容格式。" },
    ],
    boundaryTitle: "执行接口与沙箱接口不是同一层",
    boundary: "ToolExecutor 是面向工具分派的通用接口；core/src/tools/sandboxing.rs 的 ToolRuntime<Rq, Out> 则面向需要审批、沙箱与尝试执行的路径，ToolOrchestrator 驱动这条流程。它们名字相近，但解决的问题不同：前者是“如何调用一种工具”，后者是“某次实际操作如何在宿主约束下执行”。不要把所有工具都画成无条件进入 shell 的链路。",
    traceTitle: "把这些类型接回上一章",
    trace: "以教学 get_weather 为例（不是声称 Codex 内置了这个工具）：工具规格告诉模型 location 的形状 → 模型生成 FunctionCall → router 转为 ToolCall / ToolPayload → 宿主补齐 ToolInvocation → registry 找到 ToolExecutor 的实现 → 实现解析杭州并取得结果 → ToolOutput 转换为 function_call_output → turn 写入历史，再请求模型。这就是上一章 match + while 被拆分后，每个模块各自承担的工作。",
  },
  en: {
    title: "Tools define execution boundaries, not just functions",
    intro: "A match can dispatch the previous chapter's weather example. Codex also needs asynchronous execution, concurrency, cancellation, hooks, and history. The design rationale below is an interpretation grounded in the checked-out source and its comments.",
    mapTitle: "Two different tools directories",
    modules: [
      { name: "tools/src/", text: "Shared specifications, payloads, executor and output contracts. The generic Invocation avoids hard-coding a core Session into the execution interface." },
      { name: "core/src/tools/spec_plan.rs", text: "Builds the registry and model-visible specifications using configuration, model capabilities, and policy." },
      { name: "core/src/tools/router.rs · registry.rs", text: "Converts protocol calls, supplies host context, resolves implementations, checks payload kinds, and coordinates hooks and execution." },
      { name: "core/src/tools/parallel.rs · context.rs", text: "Owns invocation scheduling and context/output types, separate from individual tool operations." },
      { name: "core/src/tools/handlers/ · runtimes/", text: "Concrete implementations. Operations that require approvals and sandboxing continue into the orchestrator and relevant runtime; not every tool launches a process." },
    ],
    typesTitle: "Core types and the problems they solve",
    excerpt: "Source excerpt · not a standalone runnable example",
    types: [
      { name: "ToolSpec: model-facing instructions", path: "tools/src/tool_spec.rs · tools/src/responses_api.rs", text: "A serializable tagged enum for function, namespace, search, and freeform specifications. Function parameters describe a schema, not this call's arguments.", why: "A model needs serializable documentation, while execution needs host code and state. Hosted specifications do not necessarily correspond to a locally dispatched function." },
      { name: "ToolCall and ToolPayload: a requested operation", path: "core/src/tools/router.rs · tools/src/tool_payload.rs", code: "call", text: "The name identifies the tool, call_id identifies this invocation, and payload holds its input. Function arguments remain a string at this boundary.", why: "An enum distinguishes function JSON, structured tool search, and custom text. Recognizing a call does not validate tool-specific arguments." },
      { name: "ToolInvocation: host execution context", path: "core/src/tools/context.rs", code: "invocation", text: "Adds session, turn and step context, cancellation, shared change tracking, and call source. The turn field is explicitly retained for compatibility in this revision.", why: "Model-generated data and host-provided capabilities are different concerns. Arc shares objects across tasks rather than cloning a whole session." },
      { name: "ToolExecutor and CoreToolRuntime: execution contracts", path: "tools/src/tool_executor.rs · core/src/tools/registry.rs", code: "executor", text: "ToolExecutor ties a specification to an asynchronous implementation. CoreToolRuntime specializes it for ToolInvocation and adds core-owned hooks, readiness and payload checks.", why: "Trait objects let the registry hold heterogeneous tools behind one interface. Parallel support defaults to false; Send and Sync do not alone authorize concurrent execution." },
      { name: "ToolRegistry and ToolRouter: registration versus exposure", path: "core/src/tools/registry.rs · core/src/tools/router.rs · tools/src/tool_executor.rs", text: "The registry maps ToolName to RegisteredTool, which stores runtime and exposure. The router also holds model-visible specifications. Direct, Deferred and Hidden have different visibility.", why: "A registered implementation need not appear in the initial tools list. Unknown names produce RespondToModel; an incompatible payload kind is Fatal in this revision." },
      { name: "ToolCallRuntime: scheduling", path: "core/src/tools/parallel.rs", text: "Coordinates the router, host context, cancellation and execution gate. Parallel-capable calls acquire a read lock; other calls take an exclusive write lock.", why: "Asynchronous execution is not permission to run every operation concurrently. Scheduling belongs to the host rather than each individual implementation." },
      { name: "ToolOutput and AnyToolResult: results before history", path: "tools/src/tool_output.rs · core/src/tools/context.rs · core/src/tools/registry.rs", code: "result", text: "ToolOutput converts a result to a protocol input item. Its diagnostic log is deliberately distinct. AnyToolResult retains call_id, original payload and hook information alongside the output.", why: "Outputs can contain media and truncation metadata, not just strings. into_response creates a history envelope; the turn layer records it, preserving the call/result association." },
    ],
    boundaryTitle: "Dispatch and sandbox contracts are different layers",
    boundary: "ToolExecutor is the general dispatch contract. ToolRuntime<Rq, Out> in core/src/tools/sandboxing.rs participates in approval and sandbox attempts driven by ToolOrchestrator. Not every tool follows that execution path.",
    traceTitle: "Connect the types to the previous example",
    trace: "For the teaching get_weather example, not a claimed Codex built-in: specification → model FunctionCall → ToolCall / ToolPayload → host ToolInvocation → registered executor → ToolOutput → function_call_output → history → next model request. These are the responsibilities previously combined in match and while.",
  },
};
