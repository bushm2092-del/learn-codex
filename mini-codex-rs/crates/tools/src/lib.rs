//! 可脱离 core 复用的工具协议、执行契约与 Responses API 定义。

mod function_call_error;
mod tool_executor;
mod tool_output;
mod tool_payload;
mod tool_spec;

pub use function_call_error::FunctionCallError;
pub use mini_codex_protocol::ToolName;
pub use tool_executor::ToolExecutor;
pub use tool_executor::ToolExecutorFuture;
pub use tool_output::FunctionToolOutput;
pub use tool_output::ToolOutput;
pub use tool_payload::ToolPayload;
pub use tool_spec::ResponsesApiTool;
pub use tool_spec::ToolSpec;
