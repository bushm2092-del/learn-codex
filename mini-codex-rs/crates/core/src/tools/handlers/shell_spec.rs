use mini_codex_tools::ResponsesApiTool;
use mini_codex_tools::ToolSpec;
use serde_json::Value;
use serde_json::json;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CommandToolOptions {
    pub(crate) allow_login_shell: bool,
    pub(crate) include_windows_shell_guidance: bool,
}

pub(crate) fn create_exec_command_tool(options: CommandToolOptions) -> ToolSpec {
    let yield_time_ms_description = if cfg!(windows) {
        "Maximum time to wait before returning a session ID for a still-running command. Commands that finish sooner return immediately. For ordinary commands, omit this parameter to use the 10000 ms default. Effective range on Windows is 10000-30000 ms."
    } else {
        "Wait before yielding output. Defaults to 10000 ms; effective range is 250-30000 ms."
    };
    let mut properties = serde_json::Map::from_iter([
        (
            "cmd".to_string(),
            json!({"type": "string", "description": "Shell command to execute."}),
        ),
        (
            "workdir".to_string(),
            json!({"type": "string", "description": "Working directory for the command. Defaults to the turn cwd."}),
        ),
        (
            "shell".to_string(),
            json!({"type": "string", "description": "Shell binary to launch. Defaults to the user's default shell."}),
        ),
        (
            "tty".to_string(),
            json!({"type": "boolean", "description": "True allocates a PTY for the command; false or omitted uses plain pipes."}),
        ),
        (
            "yield_time_ms".to_string(),
            json!({"type": "number", "description": yield_time_ms_description}),
        ),
        (
            "max_output_tokens".to_string(),
            json!({"type": "number", "description": "Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy."}),
        ),
    ]);
    if options.allow_login_shell {
        properties.insert(
            "login".to_string(),
            json!({"type": "boolean", "description": "True runs the shell with -l/-i semantics; false disables them. Defaults to true."}),
        );
    }
    ToolSpec::Function(ResponsesApiTool {
        name: "exec_command".to_string(),
        description: if options.include_windows_shell_guidance {
            format!(
                "Runs a command in a PTY, returning output or a session ID for ongoing interaction.\n\n{}",
                windows_shell_guidance()
            )
        } else {
            "Runs a command in a PTY, returning output or a session ID for ongoing interaction."
                .to_string()
        },
        strict: false,
        defer_loading: None,
        parameters: Value::Object(serde_json::Map::from_iter([
            ("type".to_string(), json!("object")),
            ("properties".to_string(), Value::Object(properties)),
            ("required".to_string(), json!(["cmd"])),
            ("additionalProperties".to_string(), json!(false)),
        ])),
        output_schema: Some(unified_exec_output_schema()),
    })
}

pub(crate) fn create_write_stdin_tool() -> ToolSpec {
    ToolSpec::Function(ResponsesApiTool {
        name: "write_stdin".to_string(),
        description:
            "Writes characters to an existing unified exec session and returns recent output."
                .to_string(),
        strict: false,
        defer_loading: None,
        parameters: json!({
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "number",
                    "description": "Identifier of the running unified exec session."
                },
                "chars": {
                    "type": "string",
                    "description": "Bytes to write to stdin. Defaults to empty, which polls without writing."
                },
                "yield_time_ms": {
                    "type": "number",
                    "description": "Wait before yielding output. Non-empty writes default to 250 ms and cap at 30000 ms; empty polls wait 5000-300000 ms by default."
                },
                "max_output_tokens": {
                    "type": "number",
                    "description": "Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy."
                }
            },
            "required": ["session_id"],
            "additionalProperties": false
        }),
        output_schema: Some(unified_exec_output_schema()),
    })
}

pub(crate) fn unified_exec_output_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "chunk_id": {"type": "string", "description": "Chunk identifier included when the response reports one."},
            "wall_time_seconds": {"type": "number", "description": "Elapsed wall time spent waiting for output in seconds."},
            "exit_code": {"type": "number", "description": "Process exit code when the command finished during this call."},
            "session_id": {"type": "number", "description": "Session identifier to pass to write_stdin when the process is still running."},
            "original_token_count": {"type": "number", "description": "Approximate token count before output truncation."},
            "output": {"type": "string", "description": "Command output text, possibly truncated."}
        },
        "required": ["wall_time_seconds", "output"],
        "additionalProperties": false
    })
}

fn windows_shell_guidance() -> &'static str {
    r#"Windows safety rules:
- Do not compose destructive filesystem commands across shells. Do not enumerate paths in PowerShell and then pass them to `cmd /c`, batch builtins, or another shell for deletion or moving. Use one shell end-to-end, prefer native PowerShell cmdlets such as `Remove-Item` / `Move-Item` with `-LiteralPath`, and avoid string-built shell commands for file operations.
- Before any recursive delete or move on Windows, verify the resolved absolute target paths stay within the intended workspace or explicitly named target directory. Never issue a recursive delete or move against a computed path if the final target has not been checked.
- When using `Start-Process` to launch a background helper or service, pass `-WindowStyle Hidden` unless the user explicitly asked for a visible interactive window. Use visible windows only for interactive tools the user needs to see or control."#
}

#[cfg(test)]
#[path = "shell_spec_tests.rs"]
mod tests;
