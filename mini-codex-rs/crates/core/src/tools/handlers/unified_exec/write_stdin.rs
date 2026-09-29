use mini_codex_tools::ToolExecutor;
use mini_codex_tools::ToolExecutorFuture;
use mini_codex_tools::ToolName;
use mini_codex_tools::ToolPayload;
use mini_codex_tools::ToolSpec;
use serde::Deserialize;

use super::default_write_stdin_yield_time_ms;
use crate::function_tool::FunctionCallError;
use crate::tools::context::ToolInvocation;
use crate::tools::handlers::parse_arguments;
use crate::tools::handlers::shell_spec::create_write_stdin_tool;
use crate::unified_exec::WriteStdinRequest;

#[derive(Debug, Deserialize)]
struct WriteStdinArgs {
    session_id: i32,
    #[serde(default)]
    chars: String,
    #[serde(default = "default_write_stdin_yield_time_ms")]
    yield_time_ms: u64,
    #[serde(default)]
    max_output_tokens: Option<usize>,
}

pub struct WriteStdinHandler;

impl ToolExecutor<ToolInvocation> for WriteStdinHandler {
    fn tool_name(&self) -> ToolName {
        ToolName::plain("write_stdin")
    }

    fn spec(&self) -> ToolSpec {
        create_write_stdin_tool()
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

impl WriteStdinHandler {
    async fn handle_call(
        &self,
        invocation: ToolInvocation,
    ) -> Result<Box<dyn mini_codex_tools::ToolOutput>, FunctionCallError> {
        let ToolPayload::Function { arguments } = invocation.payload;
        let args: WriteStdinArgs = parse_arguments(&arguments)?;
        let response = invocation
            .session
            .unified_exec_manager
            .write_stdin(WriteStdinRequest {
                process_id: args.session_id,
                input: &args.chars,
                yield_time_ms: args.yield_time_ms,
                max_output_tokens: args.max_output_tokens,
            })
            .await
            .map_err(|error| {
                FunctionCallError::RespondToModel(format!("write_stdin failed: {error}"))
            })?;
        Ok(Box::new(response))
    }
}
