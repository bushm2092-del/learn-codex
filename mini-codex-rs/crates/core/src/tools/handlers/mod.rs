mod shell_spec;
pub(crate) mod tool_search;
pub(crate) mod tool_search_spec;
mod unified_exec;

pub use unified_exec::ExecCommandHandler;
pub(crate) use unified_exec::ExecCommandHandlerOptions;
pub use unified_exec::WriteStdinHandler;

use serde::Deserialize;

use crate::function_tool::FunctionCallError;

pub(crate) fn parse_arguments<T>(arguments: &str) -> Result<T, FunctionCallError>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_str(arguments).map_err(|err| {
        FunctionCallError::RespondToModel(format!("failed to parse function arguments: {err}"))
    })
}
