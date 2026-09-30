# 实现源码级别的 Codex Function Calling

草稿**查看源码**

实现 Codex Function Calling 的源码，理解其工作原理。

*上一章用一个 while 循环实现工具闭环。这一章沿着Codex的源码，实现一个和 Codex 一样的工具调用，不开玩笑，实现版本绝对和Codex源码保真，每行代码都能在Codex源码中找到出处。*

## 一个tools 模块要做什么

### 1. 能把可用的工具告诉 LLM

每次请求 LLM 时，都要带上当前可用工具的清单：工具叫什么、能做什么、参数怎么填。LLM 只能在这份清单里挑选工具。

### 2. 能根据 LLM 返回的工具名执行对应的工具

LLM 在响应里给出工具名和参数，tools 模块按名字找到对应的工具，然后根据参数执行工具。

### 3. 支持不同类型的工具

response协议支持的工具不只有一种，工具需要有类型。

- **普通函数工具**：比如执行命令的 `exec_command`，参数是一段 JSON。
- **按命名空间分组的工具**：同一类工具归到一个分组名下，一起提供给 LLM。
- **工具搜索（**`tool_search`**）**：也是response官方定义的支持的工具类型。

### 4. 支持并行调用

LLM 一次可能返回好几个工具调用，互不影响的调用应该同时执行，不必一个一个等。

不是所有工具都适合并行，所以每个工具要能声明自己是否支持：支持的可以同时跑，不支持的就独占执行。不管哪个调用先完成，结果都按调用顺序返回给 LLM。

### 5. 新增工具不需要改主流程

加一个新工具，只需要写好它的实现并注册进来，请求 LLM、执行工具、回传结果这条主流程不用改，实现最大程度解耦。

### 6. 能按配置和模型能力决定提供哪些工具

同一个工具，在不同情况下不一定要提供。比如某个功能开关没打开，就不注册对应的工具；服务商不支持命名空间分组，就不把分组工具发给 LLM。

### 7. 工具很多时支持按需加载

工具数量很多时，不必每次都把所有工具的描述发给 LLM，可以先只给一个搜索工具，LLM 需要什么再加载什么。

### 8. 工具出错时该让AI感知到

参数写错、命令执行失败这类错误，要作为结果回传给 LLM，让它调整后重试，对话继续进行。只有程序自身出了故障，才终止这一轮。

---

## 基于上诉需求codex是怎么设计这个系统的

### 1. 总体分层

工具相关的代码分为两层：

- **工具相关类型定义**（`crates/tools/`）：定义工具的说明、调用参数、执行接口、执行结果和错误类型。
- **工具调用具体实现**（`crates/core/src/tools/`）：负责工具的组装、注册、路由和调度，以及具体工具的实现。

#### 第一层：工具定义 描述工具的能力状态 `crates/tools/`

这一层只定义工具的通用结构，不涉及具体实现，其实就是 **llm api的tools入参定义**

##### 1. `ToolSpec`：请求里 `tools` 参数的一项（`crates/tools/src/tool_spec.rs`）

```rust
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type")] // 序列化时用 type 字段区分工具类型
pub enum ToolSpec {
    // 普通函数工具， 最终response协议的type字段名： "function"
    #[serde(rename = "function")]
    Function(ResponsesApiTool),
    // 一组归在同一命名空间下的函数工具， 最终response协议的type字段名： "namespace"
    #[serde(rename = "namespace")]
    Namespace(crate::ResponsesApiNamespace),
    // 最终response协议的type字段名："tool_search"
    #[serde(rename = "tool_search")]
    ToolSearch {
        execution: String,   // 执行方，mini-codex 固定为 "client"
        description: String, // 搜索工具的说明
        parameters: Value,   // 搜索参数的 JSON Schema
    },
}

impl ToolSpec {
    // 返回工具名；ToolSearch 固定返回 "tool_search"
    pub fn name(&self) -> &str {
        match self {
            Self::Function(tool) => &tool.name,
            Self::Namespace(namespace) => &namespace.name,
            Self::ToolSearch { .. } => "tool_search",
        }
    }
}
```

`#[serde(tag = "type")]` 把变体名写成 JSON 里的 `type` 字段，这正是 Responses API 区分工具类型的方式。所以一个 `ToolSpec` 序列化后，就是请求 `tools` 数组里的一项。

##### 2. Spec中的具体类型描述`ResponsesApiTool` 与 `ResponsesApiNamespace`：函数工具的说明（`crates/tools/src/responses_api.rs`）

```rust
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ResponsesApiTool {
    pub name: String,        // 工具名，LLM 调用时用它指定工具
    pub description: String, // 工具用途说明
    pub strict: bool,        // 是否要求 LLM 严格按 parameters 生成参数；当前内置工具都是 false
    // 是否延迟加载；这个工具不必一开始就把完整定义放进模型上下文，等模型通过 tool_search 搜到它时再加载。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub defer_loading: Option<bool>,
    pub parameters: serde_json::Value, // 参数的 JSON Schema
    /// 宿主元数据，不进入模型请求；延迟发现的规格会移除此字段。
    #[serde(skip)]
    pub output_schema: Option<serde_json::Value>, // 工具执行结果类型，不发送给模型，程序自己用的
}

// 把多个函数工具归到一个命名空间下
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ResponsesApiNamespace {
    pub name: String,                        // 命名空间名
    pub description: String,                 // 这组工具的说明
    pub tools: Vec<ResponsesApiNamespaceTool>, // 组内工具
}

// 命名空间内的工具类型，目前只有函数工具一种
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type")]
pub enum ResponsesApiNamespaceTool {
    #[serde(rename = "function")]
    Function(ResponsesApiTool),
}
```

两个 serde 标注决定了哪些字段会出现在请求里：

- `defer_loading` 上的 `skip_serializing_if = "Option::is_none"`：值为 `None` 时整个字段不输出，只有按需加载的工具才会带上 `"defer_loading": true`。
- `output_schema` 上的 `#[serde(skip)]`：永远不输出。它描述工具的输出结构，只供宿主使用，LLM 不需要看到。

**例子：codex中的**`exec_command` **就是执行cmd命令的工具**

`exec_command` 的说明在 `crates/core/src/tools/handlers/shell_spec.rs` 的 `create_exec_command_tool` 中构造

```rust
ToolSpec::Function(ResponsesApiTool {
    name: "exec_command".to_string(),
    description: "Runs a command in a PTY, returning output or a session ID for ongoing interaction."
        .to_string(),
    strict: false,
    defer_loading: None,
    // 源码用 serde_json::Map 逐项构造，这里用 json! 简写
    parameters: json!({
        "type": "object",
        "properties": {
            // 要执行的 shell 命令
            "cmd": { "type": "string", "description": "Shell command to execute." },
            // 命令的工作目录，默认为当前轮次的工作目录
            "workdir": { "type": "string", "description": "Working directory for the command. Defaults to the turn cwd." },
            // ...
        },
        "required": ["cmd"],
        "additionalProperties": false
    }),
    output_schema: Some(unified_exec_output_schema()),
})
```

它在请求的 `tools` 中是这样的（`description` 保留实际发送的英文原文，注释为中文翻译）：

```jsonc
{
  "type": "function",
  "name": "exec_command",
  // 在 PTY 中运行命令，返回输出；命令仍在运行时返回会话 ID，供后续交互
  "description": "Runs a command in a PTY, returning output or a session ID for ongoing interaction.",
  "strict": false,
  "parameters": {
    "type": "object",
    "properties": {
      // 要执行的 shell 命令
      "cmd": { "type": "string", "description": "Shell command to execute." },
      // 命令的工作目录，默认为当前轮次的工作目录
      "workdir": { "type": "string", "description": "Working directory for the command. Defaults to the turn cwd." },
      // 要启动的 shell 程序，默认为用户的默认 shell
      "shell": { "type": "string", "description": "Shell binary to launch. Defaults to the user's default shell." },
      // 为 true 时为命令分配 PTY；为 false 或不传时使用普通管道
      "tty": { "type": "boolean", "description": "True allocates a PTY for the command; false or omitted uses plain pipes." },
      // 等待多久后返回输出，默认 10000 毫秒，有效范围 250–30000 毫秒
      "yield_time_ms": { "type": "number", "description": "Wait before yielding output. Defaults to 10000 ms; effective range is 250-30000 ms." },
      // 输出的 token 上限，默认 10000；更大的值可能被策略限制
      "max_output_tokens": { "type": "number", "description": "Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy." }
    },
    "required": ["cmd"],
    "additionalProperties": false
  }
}
```

**例子：命名空间最终发送给模型的结构：GitHub 工具组**

下面是一个示意例子 github 的一组工具

```jsonc
{
  "type": "namespace",
  "name": "github",
  "description": "查询 GitHub 仓库、issue 和 pull request 的工具",
  "tools": [
    {
      "type": "function",
      "name": "get_issue",
      "description": "按仓库和编号获取一个 issue",
      "strict": false,
      "parameters": {
        "type": "object",
        "properties": {
          "repo": { "type": "string", "description": "仓库，格式为 owner/name" },
          "number": { "type": "number", "description": "issue 编号" }
        },
        "required": ["repo", "number"],
        "additionalProperties": false
      }
    },
    {
      "type": "function",
      "name": "list_pull_requests",
      "description": "列出仓库的 pull request",
      "strict": false,
      "defer_loading": true, // 延迟加载：需要时通过工具搜索加载
      "parameters": {
        "type": "object",
        "properties": {
          "repo": { "type": "string", "description": "仓库，格式为 owner/name" },
          "state": { "type": "string", "enum": ["open", "closed", "all"], "description": "按状态筛选" }
        },
        "required": ["repo"],
        "additionalProperties": false
      }
    }
  ]
}
```

几点说明：

- 组内每个工具都是一个完整的 `ResponsesApiTool`，外层用 `name` 和 `description` 说明这一组工具是做什么的。
- LLM 调用组内工具时，响应里的 `function_call` 会同时带上 `namespace: "github"` 和 `name: "get_issue"`。

##### 3. `ToolPayload`：LLM 这次调用传进来的参数（`crates/tools/src/tool_payload.rs`）

前面是llm api的tools入参定义，这里是**llm api的返回值定义**

```rust
#[derive(Clone, Debug, PartialEq)]
pub enum ToolPayload {
    // 函数调用：LLM 原样给出的 JSON 字符串，此时还没有解析
    Function {
        arguments: String,
    },
    // 工具搜索：query 为搜索词，limit 为最多返回几个
    ToolSearch {
        arguments: mini_codex_protocol::models::SearchToolCallParams,
    },
}
```

这个也比较好理解，每种type的函数调用，肯定有每种的模型返回值

**例子：LLM 调用 `exec_command`**

LLM 在响应中返回一个 `function_call`（`call_id` 为示意值）：

```json
{
  "type": "function_call",
  "call_id": "call_abc123",
  "name": "exec_command",
  "arguments": "{\"cmd\":\"ls\"}"
}
```

`arguments` 被原样放进 `ToolPayload::Function { arguments: "{\"cmd\":\"ls\"}".to_string() }`，仍然是字符串。等到 `exec_command` 执行时，才用 `parse_arguments` 解析成它自己的参数结构 `ExecCommandArgs`。这样每个工具可以各自定义参数结构，`ToolPayload` 不需要知道。

##### 4. `ToolExecutor<Invocation>`：可执行工具的接口（`crates/tools/src/tool_executor.rs`）

```rust
// 执行结果：成功是 Box<dyn ToolOutput>，失败是 FunctionCallError
pub type ToolExecutorFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Box<dyn ToolOutput>, FunctionCallError>> + Send + 'a>>;

// Invocation：执行时收到的上下文，具体类型由第二层决定
pub trait ToolExecutor<Invocation>: Send + Sync {
    // 工具名，由 name 和 namespace 组成
    fn tool_name(&self) -> ToolName;
    // 给 LLM 看的说明
    fn spec(&self) -> ToolSpec;

    // 曝光方式，默认直接出现在请求里
    fn exposure(&self) -> ToolExposure {
        ToolExposure::Direct
    }

    // 参与工具搜索时的索引信息，默认从 spec() 生成
    fn search_info(&self) -> Option<ToolSearchInfo> {
        ToolSearchInfo::from_tool_spec(self.spec(), None)
    }

    // 是否支持和其他调用并行，默认不支持
    fn supports_parallel_tool_calls(&self) -> bool {
        false
    }

    // 执行工具
    fn handle<'a>(&'a self, invocation: Invocation) -> ToolExecutorFuture<'a>
    where
        Invocation: 'a;
}
```

实现一个工具需要`tool_name`、`spec`、`handle` 三个方法，其余方法都有默认值。

泛型参数 `Invocation` 让这一层不必知道“会话”是什么：执行时需要的会话等对象，由第二层把 `Invocation` 填成具体类型后提供。`handle` 返回的是装箱的异步结果，因此不同工具可以返回不同的 `ToolOutput` 实现，都能放进同一个注册表里统一调用。

**例子：`exec_command` 的实现**（`crates/core/src/tools/handlers/unified_exec/exec_command.rs`）

```rust
impl ToolExecutor<ToolInvocation> for ExecCommandHandler {
    fn tool_name(&self) -> ToolName {
        ToolName::plain("exec_command")
    }

    fn spec(&self) -> ToolSpec {
        // 调用 create_exec_command_tool，再按配置调整参数说明
    }

    fn supports_parallel_tool_calls(&self) -> bool {
        true
    }

    fn handle<'a>(&'a self, invocation: ToolInvocation) -> ToolExecutorFuture<'a>
    where
        ToolInvocation: 'a,
    {
        Box::pin(self.handle_call(invocation))
    }
}
```

它覆盖了 `supports_parallel_tool_calls`，声明可以并行；没有覆盖 `exposure`，所以是默认的 `Direct`。

##### 5. `ToolExposure`：工具的曝光方式（`crates/tools/src/tool_executor.rs`）

```rust
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ToolExposure {
    Direct,   // 直接出现在发给 LLM 的工具列表里
    Deferred, // 已注册，但不直接出现；通过工具搜索按需加载
    Hidden,   // 已注册，但既不出现在工具列表里，也不参与工具搜索
}
```

`exec_command` 使用默认的 `Direct`，所以它的说明会出现在每次请求的 `tools` 中。

##### 6. `ToolOutput`：执行结果（`crates/tools/src/tool_output.rs`）

```rust
// 每种执行结果都要实现这三个方法
pub trait ToolOutput: Send {
    // 给日志和界面事件用的文本（不重要）
    fn log_output(&self) -> String;
    // 给日志和界面事件用的成功标记（不重要）
    fn success_for_logging(&self) -> bool;
    // 把结果转换成response协议里的输入项，放进下一次请求
    fn to_response_item(&self, call_id: &str, payload: &ToolPayload) -> ResponseInputItem;
}
```

契约层提供了一个通用实现 `FunctionToolOutput`：

```rust
pub struct FunctionToolOutput {
    pub body: Vec<FunctionCallOutputContentItem>, // 结果内容，可以是多段
    pub success: Option<bool>,                     // 是否执行成功；只在宿主内部使用，不写进请求
    pub post_tool_use_response: Option<JsonValue>, // 保留字段，当前没有使用，始终为 None
}
```

当前内置工具使用各自的实现：`exec_command`、`write_stdin` 使用 `ExecCommandToolOutput`，`tool_search` 使用 `ToolSearchOutput`，均定义在 `crates/core/src/tools/context.rs`。

**例子：`exec_command` 的结果**

`ExecCommandToolOutput` 的 `to_response_item` 把命令输出整理成一段文本，生成 `function_call_output`。放进下一次请求时是这样的（`Chunk ID` 为随机值，耗时和输出为示意）：

```json
{
  "type": "function_call_output",
  "call_id": "call_abc123",
  "output": "XXXXXXXXXX"
}
```

`call_id` 与 LLM 发起调用时的 `call_id` 相同，LLM 靠它把结果和调用对上。

##### 7. `FunctionCallError`：执行错误（`crates/tools/src/function_call_error.rs`）

```rust
/// 执行模型可见工具时的错误；可恢复错误必须回送模型，不能直接终止 turn。
#[derive(Debug, Error, PartialEq)]
pub enum FunctionCallError {
    // 把错误文本作为工具结果回传给 LLM，对话继续
    #[error("{0}")]
    RespondToModel(String),
    // 宿主自身故障，终止这一轮
    #[error("Fatal error: {0}")]
    Fatal(String),
}
```

**例子：**`exec_command` **的错误**

- LLM 给出的参数不是合法 JSON，比如 `{cmd:"ls"}`。`parse_arguments` 解析失败，返回 `RespondToModel`，LLM 会收到：
  ```json
  {
    "type": "function_call_output",
    "call_id": "call_abc123",
    "output": "failed to parse function arguments: key must be a string at line 1 column 2"
  }
  ```
  LLM 看到错误后可以修正参数重新调用。

#### 第二层：具体实现 `crates/core/src/tools/`

各文件职责：


| 文件             | 职责                                              |
| -------------- | ----------------------------------------------- |
| `spec_plan.rs` | 组装：从已注册的工具里算出这次要发给 LLM 的工具列表                    |
| `registry.rs`  | 注册表：工具名到执行实现的映射                                 |
| `router.rs`    | 路由：把 LLM 返回的调用转成内部对象，交给注册表                      |
| `parallel.rs`  | 调度：决定调用能否并行，发出执行事件，处理结果和错误                      |
| `context.rs`   | 执行上下文：工具执行时能拿到的会话等对象                            |
| `handlers/`    | 具体工具：`exec_command`、`write_stdin`、`tool_search` |


下面按一次**工具调用**的执行顺序介绍各个类型：注册工具 → 组装工具列表 → 认出调用 → 构造执行上下文 → 调度执行 → 返回结果。

##### 1. `ToolRegistry`：工具注册表（`crates/core/src/tools/registry.rs`，节选）

```rust
// 第一层 ToolExecutor 的泛型参数 Invocation，在这里被填成 ToolInvocation
pub(crate) trait CoreToolRuntime: ToolExecutor<ToolInvocation> { /* ... */ }

// 任何实现了 ToolExecutor<ToolInvocation> 的类型，都自动是 CoreToolRuntime
impl<T> CoreToolRuntime for T where T: ToolExecutor<ToolInvocation> {}

#[derive(Default)]
pub(crate) struct ToolRegistry {
    // 工具名 → 已注册的工具；IndexMap 保留注册顺序
    tools: IndexMap<ToolName, RegisteredTool>,
}

pub(crate) struct RegisteredTool {
    pub(crate) runtime: Arc<dyn CoreToolRuntime>,       // 工具的执行实现
    pub(crate) exposure: mini_codex_tools::ToolExposure, // 当前生效的曝光方式
}

impl ToolRegistry {
    // 注册一个工具，曝光方式取工具自己声明的 exposure()
    pub(crate) fn add<T>(&mut self, handler: T)
    where
        T: CoreToolRuntime + 'static,
    {
        self.register_trusted(Arc::new(handler));
    }

    pub(crate) fn register_trusted_with_exposure(
        &mut self,
        runtime: Arc<dyn CoreToolRuntime>,
        exposure: mini_codex_tools::ToolExposure,
    ) {
        // 没有命名空间的工具名，补成默认命名空间 functions
        let tool_name = runtime.tool_name().with_default_namespace();
        // 同名工具重复注册会 panic
        assert!(
            self.tools
                .insert(tool_name.clone(), RegisteredTool { runtime, exposure })
                .is_none(),
            "tool {tool_name} already registered"
        );
    }

    // 按工具名查找执行实现，查找前同样补上默认命名空间
    pub(crate) fn tool(&self, name: &ToolName) -> Option<Arc<dyn CoreToolRuntime>> {
        self.tools
            .get(&name.clone().with_default_namespace())
            .map(|tool| Arc::clone(&tool.runtime))
    }
}
```

- 不同工具是不同的 Rust 类型，存成 `Arc<dyn CoreToolRuntime>` 才能放进同一个 map；`Arc` 让注册表和正在执行的任务共享同一份实现。
- 注册和查找都会调用 `with_default_namespace()`。LLM 返回的普通函数调用不带命名空间，补上默认值后，就能和注册时的名字对上。

**例子：注册 `exec_command`**（`crates/core/src/thread_manager.rs`，节选并简写）

```rust
let mut tool_registry = ToolRegistry::default();
if config.features.enabled(Feature::UnifiedExec) {
    // 默认开启：注册可交互的 exec_command，以及配套的 write_stdin
    tool_registry.add(ExecCommandHandler::new(exec_options));
    tool_registry.add(WriteStdinHandler);
} else {
    // 关闭时只注册一次性执行的 exec_command
    tool_registry.add(ExecCommandHandler::one_shot(exec_options));
}
```

默认配置下，注册表里有两项：`exec_command` 和 `write_stdin`，命名空间都是 `functions`，曝光方式都是默认的 `Direct`。

##### 2. `ToolRouter`：组装发给 LLM 的工具列表（`crates/core/src/tools/router.rs`、`spec_plan.rs`，节选）

```rust
pub(crate) struct ToolRouter {
    registry: ToolRegistry,              // 注册表，执行时按名字查找实现
    model_visible_specs: Arc<[ToolSpec]>, // 组装好的、要发给 LLM 的工具说明
}

impl ToolRouter {
    // 每次请求 LLM 时取出工具列表
    pub(crate) fn model_visible_specs(&self) -> Arc<[ToolSpec]> {
        Arc::clone(&self.model_visible_specs)
    }

    // 查询某次调用对应的工具是否支持并行；找不到工具时按不支持处理
    pub(crate) fn tool_supports_parallel(&self, call: &ToolCall) -> bool {
        self.registry
            .supports_parallel_tool_calls(&call.tool_name)
            .unwrap_or(false)
    }
}
```

`ToolRouter` 由 `spec_plan.rs` 的 `finalize_tool_router` 创建，工具列表也在这里算好：

```rust
pub(crate) fn finalize_tool_router(
    model_info: &ModelInfo,             // 模型能力，比如是否支持工具搜索
    provider: &ProviderCapabilities,    // 服务商能力，比如是否支持命名空间
    mut registry: ToolRegistry,
    tool_search_handler_cache: &ToolSearchHandlerCache,
) -> ToolRouter {
    let search_tool_name = ToolName::plain(TOOL_SEARCH_TOOL_NAME);
    // 模型和服务商都支持工具搜索，并且存在 Deferred 工具时，才注册 tool_search
    if search_tool_enabled(model_info, provider)
        && registry.entries().any(|tool| {
            tool.runtime.tool_name() != search_tool_name
                && tool.exposure.is_deferred()
                && tool.runtime.search_info().is_some()
        })
    {
        let handler =
            tool_search_handler_cache.get_or_build(&registry, ToolSearchSourceListing::Omit);
        registry.register_trusted(handler);
    }
    let specs = build_model_visible_specs(&registry, provider);
    ToolRouter::from_parts(registry, specs)
}

fn build_model_visible_specs(
    registry: &ToolRegistry,
    provider: &ProviderCapabilities,
) -> Vec<ToolSpec> {
    let mut specs = Vec::new();
    for tool in registry.entries() {
        // 只有 Direct 的工具进入列表
        if !tool.exposure.is_direct() {
            continue;
        }
        specs.push(tool.runtime.spec());
    }
    // 同名命名空间合并成一项；服务商不支持命名空间时，过滤掉命名空间工具
    merge_into_namespaces(specs)
        .into_iter()
        .filter(|spec| provider.namespace_tools || !matches!(spec, ToolSpec::Namespace(_)))
        .collect()
}
```

工具列表只在创建 `ToolRouter` 时计算一次，保存在 `Arc<[ToolSpec]>` 里。之后每次请求 LLM，`turn.rs` 都直接取用：

```rust
// crates/core/src/session/turn.rs（节选）
let prompt = Prompt {
    input: session.history.lock().await.for_prompt(),
    tools: session.tool_router.model_visible_specs().to_vec(), // 放进请求的 tools
    // ...
};
```

**例子：默认 DeepSeek 配置下的工具列表**

`thread_manager.rs` 传入的服务商能力是 `namespace_tools: false`，所以 `search_tool_enabled` 返回 `false`，不注册 `tool_search`。`exec_command` 和 `write_stdin` 都是 `Direct`，最终的工具列表就是这两个工具的 `ToolSpec`，即第一层例子中的 JSON。

##### 3. `ToolCall`：从 LLM 响应里认出一次调用（`crates/core/src/tools/router.rs`）

```rust
#[derive(Clone, Debug, PartialEq)]
pub struct ToolCall {
    pub tool_name: ToolName,   // 要调用的工具
    pub call_id: String,       // 这次调用的编号，结果要用它和调用配对
    pub payload: ToolPayload,  // 调用参数
    pub encrypted_function_args: Option<Vec<String>>, // 从 LLM 响应里原样带过来；当前执行路径不读取
}

impl ToolRouter {
    // 把 LLM 响应里的一项转换成 ToolCall；不是工具调用时返回 Ok(None)
    pub(crate) fn build_tool_call(
        item: ResponseItem,
    ) -> Result<Option<ToolCall>, FunctionCallError> {
        match item {
            // 客户端执行的工具搜索调用
            ResponseItem::ToolSearchCall {
                call_id: Some(call_id),
                execution,
                arguments,
                ..
            } if execution == "client" => {
                // 搜索参数解析失败时，把错误告诉 LLM
                let arguments = serde_json::from_value(arguments).map_err(|err| {
                    FunctionCallError::RespondToModel(format!(
                        "failed to parse tool_search arguments: {err}"
                    ))
                })?;
                Ok(Some(ToolCall {
                    tool_name: ToolName::plain("tool_search"),
                    call_id,
                    payload: ToolPayload::ToolSearch { arguments },
                    encrypted_function_args: None,
                }))
            }
            // 其他工具搜索调用（比如由服务端执行的）不需要本地处理
            ResponseItem::ToolSearchCall { .. } => Ok(None),
            // 普通函数调用：参数原样放进 ToolPayload::Function
            ResponseItem::FunctionCall {
                name,
                namespace,
                arguments,
                encrypted_function_args,
                call_id,
                ..
            } => Ok(Some(ToolCall {
                tool_name: ToolName::new(namespace, name).with_default_namespace(),
                call_id,
                payload: ToolPayload::Function { arguments },
                encrypted_function_args,
            })),
            // 普通文本消息等，不是工具调用
            _ => Ok(None),
        }
    }
}
```

`build_tool_call` 是一个不依赖会话的关联函数，只负责“认出调用”，不执行任何东西。`turn.rs` 每收到一项完整的输出就调用它一次，返回 `Ok(None)` 时按普通消息处理。

**例子：LLM 调用 `exec_command`**

对第一层例子中的 `function_call`，`build_tool_call` 得到：

```rust
ToolCall {
    tool_name: ToolName { name: "exec_command".into(), namespace: Some("functions".into()) },
    call_id: "call_abc123".into(),
    payload: ToolPayload::Function { arguments: "{\"cmd\":\"ls\"}".into() },
    encrypted_function_args: None,
}
```

##### 4. `ToolInvocation`：执行时交给工具的上下文（`crates/core/src/tools/context.rs`）

```rust
/// 一次工具调用拥有的最小运行时上下文。
#[derive(Clone)]
pub(crate) struct ToolInvocation {
    pub(crate) session: Arc<Session>, // 当前会话：shell、工作目录、进程管理等运行环境
    pub(crate) call_id: String,       // 调用编号
    pub(crate) tool_name: ToolName,   // 工具名
    pub(crate) payload: ToolPayload,  // 调用参数
}
```

`ToolCall` 只包含 LLM 给出的信息；`ToolInvocation` 在此基础上加入了宿主提供的 `session`。LLM 能影响的只有 `payload`，没有办法通过参数拿到会话对象。

**例子：`exec_command` 从上下文里取什么**

`exec_command` 的 `handle_call` 通过 `invocation.session` 拿到执行命令需要的环境（`crates/core/src/tools/handlers/unified_exec/exec_command.rs`，节选）：

```rust
let resolved = get_command(&args, invocation.session.user_shell(), /* ... */)?; // 用户的 shell
let cwd = resolve_workdir(&invocation.session.cwd, args.workdir.take());      // 会话的工作目录
let manager = &invocation.session.unified_exec_manager;                       // 进程管理器
```

##### 5. `ToolCallRuntime`：调度一次调用（`crates/core/src/tools/parallel.rs`，节选）

```rust
#[derive(Clone)]
pub(crate) struct ToolCallRuntime {
    session: Arc<Session>,                 // 当前会话
    submission_id: String,                 // 这一轮用户请求的编号，发事件时带上
    parallel_execution: Arc<RwLock<()>>,   // 控制并行的读写锁
}

impl ToolCallRuntime {
    pub(crate) async fn handle_tool_call(
        self,
        call: ToolCall,
    ) -> Result<ResponseInputItem, FunctionCallError> {
        // 1. 查询这个工具是否支持并行
        let supports_parallel = self.session.tool_router.tool_supports_parallel(&call);
        // 2. 通知界面：工具开始执行（参数转换省略）
        self.session.send_event(Event { msg: EventMsg::ToolCallStarted { /* ... */ }, /* ... */ }).await;

        // 3. 在 ToolCall 的基础上加入会话，构造执行上下文
        let invocation = ToolInvocation {
            session: Arc::clone(&self.session),
            call_id: call.call_id.clone(),
            tool_name: call.tool_name.clone(),
            payload: call.payload.clone(),
        };
        // 4. 支持并行的拿读锁，可以和其他读锁同时持有；不支持的拿写锁，独占执行
        let result = if supports_parallel {
            let _guard = self.parallel_execution.read().await;
            self.session.tool_router.dispatch_tool_call_with_state(invocation).await
        } else {
            let _guard = self.parallel_execution.write().await;
            self.session.tool_router.dispatch_tool_call_with_state(invocation).await
        };

        // 5. 把结果统一转换成协议输入项
        let (item, output, success) = match result {
            Ok(result) => {
                let output = result.result.log_output();
                let success = result.result.success_for_logging();
                (result.result.to_response_item(&result.call_id, &result.payload), output, success)
            }
            // 可恢复错误：生成一个失败的工具结果交给 LLM
            Err(FunctionCallError::RespondToModel(message)) => (
                Self::failure_response(&call, message.clone()),
                message,
                false,
            ),
            // 致命错误：直接向上返回，终止这一轮
            Err(error @ FunctionCallError::Fatal(_)) => return Err(error),
        };
        // 6. 通知界面：工具执行结束
        self.session.send_event(Event { msg: EventMsg::ToolCallCompleted { /* ... */ }, /* ... */ }).await;
        Ok(item)
    }
}
```

- `RwLock<()>` 里没有要保护的数据，只借用读写锁“读锁可以同时持有、写锁必须独占”的规则来控制并行。
- `turn.rs` 每次请求 LLM 时新建一个 `ToolCallRuntime`，这次响应里的每个调用都用它的克隆执行。克隆共享同一个 `Arc<RwLock<()>>`，所以并行规则作用于同一次响应里的所有调用。
- 成功的结果和可恢复的错误最终都变成 `ResponseInputItem`，写进历史、交给 LLM；只有 `Fatal` 会中断这一轮。

**例子：一次响应里有两个 `exec_command` 调用**

`exec_command` 声明了支持并行，两个调用都拿读锁，可以同时执行。如果其中一个工具不支持并行，它会拿写锁，等其他调用释放锁后才执行，执行期间别的调用也要等它。

##### 6. `AnyToolResult`：执行并收集结果（`crates/core/src/tools/registry.rs`）

```rust
pub(crate) struct AnyToolResult {
    pub(crate) call_id: String,             // 调用编号
    pub(crate) payload: ToolPayload,        // 原调用参数
    pub(crate) result: Box<dyn ToolOutput>, // 工具返回的结果
}

impl ToolRegistry {
    pub(crate) async fn dispatch_any_with_state(
        &self,
        invocation: ToolInvocation,
    ) -> Result<AnyToolResult, FunctionCallError> {
        // 按工具名查找实现；找不到时把错误告诉 LLM
        let tool = self.tool(&invocation.tool_name).ok_or_else(|| {
            FunctionCallError::RespondToModel(format!("unsupported call: {}", invocation.tool_name))
        })?;
        // handle 会拿走 invocation，先把 call_id 和 payload 复制出来
        let call_id = invocation.call_id.clone();
        let payload = invocation.payload.clone();
        let result = tool.handle(invocation).await?;
        Ok(AnyToolResult {
            call_id,
            payload,
            result,
        })
    }
}
```

`ToolOutput::to_response_item` 需要 `call_id` 和 `payload` 才能生成协议输入项，所以 `AnyToolResult` 把它们和结果放在一起返回。

**例子：LLM 调用了不存在的工具**

如果 LLM 调用了一个没有注册的工具，比如 `read_file`，注册表找不到实现，返回 `RespondToModel("unsupported call: read_file")`。`ToolCallRuntime` 用 `failure_response` 把它转换成工具结果交给 LLM：

```json
{
  "type": "function_call_output",
  "call_id": "call_def456",
  "output": "unsupported call: read_file"
}
```

`ToolName` 显示时省略默认命名空间 `functions`，所以错误信息里只有 `read_file`。

#### 两层之间的衔接

契约层的 `ToolExecutor` 以执行上下文 `Invocation` 为泛型参数，不依赖具体的会话类型：

```rust
// crates/tools/src/tool_executor.rs
pub trait ToolExecutor<Invocation>: Send + Sync {
    fn tool_name(&self) -> ToolName;
    fn spec(&self) -> ToolSpec;
    // ...
    fn handle<'a>(&'a self, invocation: Invocation) -> ToolExecutorFuture<'a>
    where
        Invocation: 'a;
}
```

宿主层再把这个泛型参数填成自己的执行上下文 `ToolInvocation`，里面带着会话：

```rust
// crates/core/src/tools/registry.rs
pub(crate) trait CoreToolRuntime: ToolExecutor<ToolInvocation> { /* ... */ }
```

契约层因此不引用 `Session`，工具执行时仍能通过 `ToolInvocation` 拿到会话。

#### 为什么要这样拆

- **依赖方向清楚**：`protocol → tools → core`，契约层不会反过来依赖会话实现，也就不会出现循环依赖。
- **工具定义可以脱离 core 复用**：其他 crate 只要依赖 `mini-codex-tools`，就能描述和实现工具，不必依赖整个 `core`。
- **支撑“新增工具不改主流程”**（需求 5）：主流程只和契约层的接口打交道，新工具只要实现同一个接口即可。

#### 需求和设计的对照

每条需求由以下类型和文件负责：


| 需求                  | 负责的类型 / 函数                                                                                   | 文件                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 把可用工具告诉 LLM      | `ToolSpec`、`ResponsesApiTool`、`ToolRouter::model_visible_specs`                              | `crates/tools/src/tool_spec.rs`、`crates/tools/src/responses_api.rs`、`crates/core/src/tools/router.rs`、`crates/core/src/session/turn.rs` |
| 2. 按工具名执行           | `ToolRouter::build_tool_call`、`ToolRegistry::dispatch_any_with_state`、`ToolExecutor::handle` | `crates/core/src/tools/router.rs`、`crates/core/src/tools/registry.rs`                                                                   |
| 3. 支持不同类型的工具        | `ToolSpec` 的 `Function` / `Namespace` / `ToolSearch` 变体，`ToolPayload`                        | `crates/tools/src/tool_spec.rs`、`crates/tools/src/tool_payload.rs`                                                                      |
| 4. 支持并行调用           | `ToolExecutor::supports_parallel_tool_calls`、`ToolCallRuntime`、`FuturesOrdered`              | `crates/core/src/tools/parallel.rs`、`crates/core/src/session/turn.rs`                                                                   |
| 5. 新增工具不改主流程        | `ToolExecutor`、`ToolRegistry::add`                                                           | `crates/tools/src/tool_executor.rs`、`crates/core/src/tools/registry.rs`、`crates/core/src/thread_manager.rs`                             |
| 6. 按配置和模型能力决定提供哪些工具 | 功能开关、`ToolExposure`、`finalize_tool_router`、`ProviderCapabilities`                            | `crates/core/src/thread_manager.rs`、`crates/core/src/tools/spec_plan.rs`                                                                |
| 7. 工具很多时按需加载        | `ToolExposure::Deferred`、`ToolSearchHandler`                                                 | `crates/core/src/tools/handlers/tool_search.rs`、`crates/tools/src/tool_search.rs`                                                       |
| 8. 工具出错让 AI 感知      | `FunctionCallError`、`ToolCallRuntime::failure_response`                                      | `crates/tools/src/function_call_error.rs`、`crates/core/src/tools/parallel.rs`                                                           |


### 2. 串起来：一次 `exec_command`

前面按类型拆开讲。这一节顺着 `crates/core/src/session/turn.rs` 的 `run_turn`，看一次真实调用怎么把这些类型串起来。

例子：用户输入「列出当前目录」。注册表里已有 `exec_command`，曝光方式是 `Direct`，发给模型的 `tools` 就是上一节默认配置下的那份列表。

#### 1. 记下用户消息

```rust
// crates/core/src/session/turn.rs
session.send_event(Event { msg: EventMsg::TurnStarted, /* ... */ }).await;
session.history.lock().await.record(ResponseItem::Message {
    role: "user".to_string(),
    content: vec![ContentItem::InputText { text: user_text }],
    // ...
});
```

历史里现在只有这一条用户消息。`ContextManager::record` 只是把条目追加进去，`for_prompt` 再把整段历史原样取出。

#### 2. 组请求，带上工具列表

`loop` 每开始一轮，都重新组一次 `Prompt`，然后发给模型：

```rust
let prompt = Prompt {
    input: session.history.lock().await.for_prompt(),          // 到目前为止的全部历史
    tools: session.tool_router.model_visible_specs().to_vec(), // 创建 ToolRouter 时算好的工具列表
    parallel_tool_calls: true,                                 // 允许模型一次返回多个调用
    instructions: session.instructions.clone(),
};
let mut stream = session.model_client.stream(prompt, model).await?;
let tool_runtime = ToolCallRuntime::new(Arc::clone(&session), submission_id.to_string());
let mut in_flight = FuturesOrdered::<InFlightFuture>::new(); // 按入队顺序收回工具结果
let mut needs_follow_up = false;
```

`crates/core/src/client.rs` 把 `Prompt` POST 到 `/responses`。请求体里和工具有关的字段是：

```json
{
  "tools": [ /* ToolSpec 序列化后的数组，这里是 exec_command 和 write_stdin */ ],
  "tool_choice": "auto",
  "parallel_tool_calls": true,
  "stream": true
}
```

`stream: true` 表示响应以 SSE 持续返回。`client.rs` 的 `normalize_event` 只保留三种事件，交给 `run_turn`：

- `response.output_text.delta` → `OutputTextDelta`：一段文本增量，只发给界面。
- `response.output_item.done` → `OutputItemDone`：一个完整输出项，例如一条 `function_call`。
- `response.completed` → `Completed`：这次响应结束。

#### 3. 边读流，边开始执行

```rust
while let Some(event) = stream.next().await {
    match event? {
        ResponseEvent::OutputTextDelta(delta) => { /* 发给界面 */ }
        ResponseEvent::OutputItemDone(item) => {
            // 先把模型的原始输出写入历史，再判断它是不是工具调用
            session.history.lock().await.record(item.clone());
            match ToolRouter::build_tool_call(item.clone()) {
                Ok(Some(call)) => {
                    let runtime = tool_runtime.clone();
                    in_flight.push_back(Box::pin(async move {
                        runtime.handle_tool_call(call).await.map_err(Into::into)
                    }));
                    needs_follow_up = true;
                }
                Ok(None) => { /* 普通文本：发给界面，记到 last_agent_message */ }
                Err(error) => return Err(error.into()),
            }
        }
        ResponseEvent::Completed => break,
    }
}
```

模型返回的完整输出项是：

```json
{
  "type": "function_call",
  "call_id": "call_abc123",
  "name": "exec_command",
  "arguments": "{\"cmd\":\"ls\"}"
}
```

这一项先进入历史。`build_tool_call` 得到上一节的 `ToolCall`，`handle_tool_call` 放进 `FuturesOrdered`。流还没结束，工具已经开始执行；这里不取结果。

`FuturesOrdered` 按 `push_back` 的顺序产出结果。两个 `exec_command` 都支持并行，可以同时拿读锁执行。后发出的调用即使先跑完，也要等排在它前面的 future 先被取走。写回历史的顺序和模型给出的调用顺序一致。

`Ok(None)` 表示这项不是工具调用，比如普通文本消息。`Err` 会直接结束这一轮。当前 `build_tool_call` 里会返回 `Err` 的情况，是 `tool_search` 的参数解析失败。

#### 4. 响应结束后，按顺序收回结果

流必须收到 `Completed`。连接提前断开时，`run_turn` 返回错误 `stream closed before response.completed`。

```rust
while let Some(result) = in_flight.next().await {
    let response = result.context("in-flight tool future failed during drain")?;
    session.history.lock().await.record(ResponseItem::from(response));
}
```

`handle_tool_call` 内部仍是上一节的路径：查是否支持并行，发 `ToolCallStarted`，构造 `ToolInvocation`，按名字找到 `ExecCommandHandler`。`handle_call` 把 `"{\"cmd\":\"ls\"}"` 解析成 `ExecCommandArgs`，用 `invocation.session` 里的 shell 和工作目录启动进程。

成功时，结果写成：

```json
{
  "type": "function_call_output",
  "call_id": "call_abc123",
  "output": "..."
}
```

`call_id` 与调用时相同。这条记录追加到历史里那条 `function_call` 的后面。

参数不合法、命令执行失败，走 `RespondToModel`。`failure_response` 同样生成一条 `function_call_output`，`output` 是错误文本，历史照样记下。`needs_follow_up` 在入队时已经设为 `true`。

`Fatal` 从 `handle_tool_call` 返回 `Err`。`in_flight.next()` 得到这个错误后，`run_turn` 在这里返回。错误不写入历史，循环也不再继续。此时历史里已经有那条 `function_call`，因为写入发生在执行之前。

#### 5. 有工具结果，就再请求一次

```rust
if !needs_follow_up {
    session.send_event(Event { msg: EventMsg::TurnCompleted { last_agent_message }, /* ... */ }).await;
    return Ok(());
}
// 否则回到 loop 开头，用更新后的历史再请求一次
```

第二次请求的 `input` 是整段历史：用户消息、`function_call`、`function_call_output`。`tools` 仍是创建 `ToolRouter` 时那一份。

模型这次只返回文本，没有 `function_call`。`needs_follow_up` 保持 `false`，发出 `TurnCompleted`，这一轮结束。

模型如果继续调用工具，`loop` 会再走一遍，直到某次响应里没有工具调用。

#### 当前的执行边界

`exec_command` 在会话工作目录里直接启动 shell。`crates/core/src/unified_exec/` 负责创建进程、等待输出、超时和截断输出。这一层没有 sandbox，执行前也不做审批，用户取消也不会接到正在运行的命令上。命令内容来自模型给出的 `cmd`。

