//! 可脱离 core 复用的工具协议、执行契约与 Responses API 定义。

mod function_call_error;
mod responses_api;
mod tool_discovery;
mod tool_executor;
mod tool_output;
mod tool_payload;
mod tool_search;
mod tool_spec;

pub use function_call_error::FunctionCallError;
pub use mini_codex_protocol::ToolName;
pub use responses_api::ResponsesApiTool;
pub use responses_api::{
    LoadableToolSpec, ResponsesApiNamespace, ResponsesApiNamespaceTool,
    coalesce_loadable_tool_specs, default_namespace_description,
};
pub use tool_discovery::{TOOL_SEARCH_DEFAULT_LIMIT, TOOL_SEARCH_TOOL_NAME, ToolSearchSourceInfo};
pub use tool_executor::ToolExecutor;
pub use tool_executor::ToolExecutorFuture;
pub use tool_executor::ToolExposure;
pub use tool_output::FunctionToolOutput;
pub use tool_output::ToolOutput;
pub use tool_payload::ToolPayload;
pub use tool_search::{ToolSearchEntry, ToolSearchInfo};
pub use tool_spec::ToolSpec;
