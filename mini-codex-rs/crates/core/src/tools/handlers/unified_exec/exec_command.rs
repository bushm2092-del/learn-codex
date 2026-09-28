use std::process::Stdio;
use std::time::Duration;

use mini_codex_tools::ResponsesApiTool;
use mini_codex_tools::ToolExecutor;
use mini_codex_tools::ToolExecutorFuture;
use mini_codex_tools::ToolName;
use mini_codex_tools::ToolPayload;
use mini_codex_tools::ToolSpec;
use tokio::process::Command;

use super::ExecCommandArgs;
use crate::function_tool::FunctionCallError;
use crate::tools::context::FunctionToolOutput;
use crate::tools::context::ToolInvocation;
use crate::tools::handlers::parse_arguments;

const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Default)]
pub struct ExecCommandHandler;

impl ToolExecutor<ToolInvocation> for ExecCommandHandler {
    fn tool_name(&self) -> ToolName {
        ToolName::plain("exec_command")
    }

    fn spec(&self) -> ToolSpec {
        ToolSpec::Function(ResponsesApiTool {
            name: "exec_command".to_string(),
            description: "在 thread 工作目录中运行一条 shell 命令。".to_string(),
            strict: true,
            defer_loading: None,
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "cmd": {"type": "string", "description": "要运行的 shell 命令。"}
                },
                "required": ["cmd"],
                "additionalProperties": false
            }),
        })
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

impl ExecCommandHandler {
    async fn handle_call(
        &self,
        invocation: ToolInvocation,
    ) -> Result<Box<dyn mini_codex_tools::ToolOutput>, FunctionCallError> {
        let ToolPayload::Function { arguments } = invocation.payload;
        let args: ExecCommandArgs = parse_arguments(&arguments)?;

        #[cfg(unix)]
        let mut command = {
            let mut command = Command::new("/bin/sh");
            command.args(["-lc", &args.cmd]);
            command
        };
        #[cfg(windows)]
        let mut command = {
            let mut command = Command::new("cmd.exe");
            command.args(["/C", &args.cmd]);
            command
        };
        command
            .current_dir(&invocation.session.cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        let output = match tokio::time::timeout(COMMAND_TIMEOUT, command.output()).await {
            Ok(Ok(output)) => output,
            Ok(Err(error)) => {
                return Ok(Box::new(FunctionToolOutput::from_text(
                    format!("启动命令失败：{error}"),
                    Some(false),
                )));
            }
            Err(_) => {
                return Ok(Box::new(FunctionToolOutput::from_text(
                    format!("命令运行超过 {} 秒，已超时", COMMAND_TIMEOUT.as_secs()),
                    Some(false),
                )));
            }
        };

        let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
        text.push_str(&String::from_utf8_lossy(&output.stderr));
        if text.len() > MAX_OUTPUT_BYTES {
            let mut boundary = MAX_OUTPUT_BYTES;
            while !text.is_char_boundary(boundary) {
                boundary -= 1;
            }
            text.truncate(boundary);
            text.push_str("\n[输出已截断]");
        }
        Ok(Box::new(FunctionToolOutput::from_text(
            format!(
                "进程退出码：{}\n输出：\n{text}",
                output.status.code().unwrap_or(-1)
            ),
            Some(output.status.success()),
        )))
    }
}
