use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use mini_codex_protocol::ToolSpec;
use serde::Deserialize;
use serde_json::Value;
use tokio::process::Command;

use crate::tools::Tool;
use crate::tools::ToolFuture;
use crate::tools::ToolResult;

const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_OUTPUT_BYTES: usize = 64 * 1024;

pub struct ExecCommandTool;

#[derive(Deserialize)]
struct ExecCommandArgs {
    cmd: String,
}

impl Tool for ExecCommandTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            kind: "function",
            name: "exec_command".to_string(),
            description: "在 thread 工作目录中运行一条 shell 命令。".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "cmd": {"type": "string", "description": "要运行的 shell 命令。"}
                },
                "required": ["cmd"],
                "additionalProperties": false
            }),
            strict: true,
        }
    }

    fn execute<'a>(&'a self, arguments: Value, cwd: &'a Path) -> ToolFuture<'a> {
        Box::pin(async move {
            let args: ExecCommandArgs = match serde_json::from_value(arguments) {
                Ok(args) => args,
                Err(error) => {
                    return ToolResult {
                        output: format!("exec_command 参数无效：{error}"),
                        success: false,
                    };
                }
            };

            let mut command = shell_command(&args.cmd);
            command
                .current_dir(cwd)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            let output = match tokio::time::timeout(COMMAND_TIMEOUT, command.output()).await {
                Ok(Ok(output)) => output,
                Ok(Err(error)) => {
                    return ToolResult {
                        output: format!("启动命令失败：{error}"),
                        success: false,
                    };
                }
                Err(_) => {
                    return ToolResult {
                        output: format!("命令运行超过 {} 秒，已超时", COMMAND_TIMEOUT.as_secs()),
                        success: false,
                    };
                }
            };

            let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
            text.push_str(&String::from_utf8_lossy(&output.stderr));
            if text.len() > MAX_OUTPUT_BYTES {
                text.truncate(MAX_OUTPUT_BYTES);
                text.push_str("\n[输出已截断]");
            }
            ToolResult {
                output: format!(
                    "进程退出码：{}\n输出：\n{text}",
                    output.status.code().unwrap_or(-1)
                ),
                success: output.status.success(),
            }
        })
    }
}

#[cfg(unix)]
fn shell_command(script: &str) -> Command {
    let mut command = Command::new("/bin/sh");
    command.args(["-lc", script]);
    command
}

#[cfg(windows)]
fn shell_command(script: &str) -> Command {
    let mut command = Command::new("cmd.exe");
    command.args(["/C", script]);
    command
}
