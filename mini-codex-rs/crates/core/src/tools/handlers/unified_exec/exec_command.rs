use std::path::PathBuf;
use std::time::Duration;

use mini_codex_tools::ToolExecutor;
use mini_codex_tools::ToolExecutorFuture;
use mini_codex_tools::ToolName;
use mini_codex_tools::ToolPayload;
use mini_codex_tools::ToolSpec;

use super::ExecCommandArgs;
use super::get_command;
use crate::function_tool::FunctionCallError;
use crate::tools::context::ToolInvocation;
use crate::tools::handlers::parse_arguments;
use crate::tools::handlers::shell_spec::CommandToolOptions;
use crate::tools::handlers::shell_spec::create_exec_command_tool;
use crate::unified_exec::ExecCommandRequest;

const DEFAULT_EXEC_COMMAND_TIMEOUT_MS: u64 = 10_000;

#[derive(Clone, Copy)]
pub(crate) struct ExecCommandHandlerOptions {
    pub(crate) allow_login_shell: bool,
    pub(crate) allow_tty: bool,
    pub(crate) include_windows_shell_guidance: bool,
}

#[derive(Clone, Copy)]
enum ExecCommandLifetime {
    Interactive,
    OneShot,
}

pub struct ExecCommandHandler {
    options: ExecCommandHandlerOptions,
    lifetime: ExecCommandLifetime,
}

impl Default for ExecCommandHandler {
    fn default() -> Self {
        Self {
            lifetime: ExecCommandLifetime::Interactive,
            options: ExecCommandHandlerOptions {
                allow_login_shell: false,
                allow_tty: true,
                include_windows_shell_guidance: cfg!(windows),
            },
        }
    }
}

impl ExecCommandHandler {
    pub(crate) fn new(options: ExecCommandHandlerOptions) -> Self {
        Self {
            options,
            lifetime: ExecCommandLifetime::Interactive,
        }
    }

    pub(crate) fn one_shot(options: ExecCommandHandlerOptions) -> Self {
        Self {
            options,
            lifetime: ExecCommandLifetime::OneShot,
        }
    }
}

impl ToolExecutor<ToolInvocation> for ExecCommandHandler {
    fn tool_name(&self) -> ToolName {
        ToolName::plain("exec_command")
    }

    fn spec(&self) -> ToolSpec {
        let spec = create_exec_command_tool(CommandToolOptions {
            allow_login_shell: self.options.allow_login_shell,
            include_windows_shell_guidance: self.options.include_windows_shell_guidance,
        });
        let mut spec = match self.lifetime {
            ExecCommandLifetime::Interactive => spec,
            ExecCommandLifetime::OneShot => one_shot_exec_command_spec(spec),
        };
        if !self.options.allow_tty {
            let ToolSpec::Function(tool) = &mut spec else {
                unreachable!("exec_command has a function spec")
            };
            tool.parameters["properties"]
                .as_object_mut()
                .expect("exec_command properties must be an object")
                .remove("tty");
        }
        spec
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
        let ToolPayload::Function { arguments } = invocation.payload else {
            return Err(FunctionCallError::Fatal(
                "exec_command handler received unsupported payload".to_string(),
            ));
        };
        let mut args: ExecCommandArgs = parse_arguments(&arguments)?;
        if args.tty && !self.options.allow_tty {
            return Err(FunctionCallError::RespondToModel(
                "TTY execution is disabled by config; omit `tty` or set it to false.".to_string(),
            ));
        }
        let resolved = get_command(
            &args,
            invocation.session.user_shell(),
            self.options.allow_login_shell,
        )
        .map_err(FunctionCallError::RespondToModel)?;
        let cwd = resolve_workdir(&invocation.session.cwd, args.workdir.take());
        let completion_timeout = match self.lifetime {
            ExecCommandLifetime::Interactive => None,
            ExecCommandLifetime::OneShot => {
                args.tty = false;
                Some(Duration::from_millis(
                    args.timeout_ms.unwrap_or(DEFAULT_EXEC_COMMAND_TIMEOUT_MS),
                ))
            }
        };
        let manager = &invocation.session.unified_exec_manager;
        let process_id = manager.allocate_process_id().await;
        let request = ExecCommandRequest {
            command: resolved.command,
            shell_type: resolved.shell_type,
            process_id,
            yield_time_ms: args.yield_time_ms,
            max_output_tokens: args.max_output_tokens,
            cwd,
            tty: args.tty,
        };
        let result = match completion_timeout {
            Some(timeout) => manager.exec_command_to_completion(request, timeout).await,
            None => manager.exec_command(request).await,
        }
        .map_err(|error| {
            FunctionCallError::RespondToModel(format!("exec_command failed: {error:?}"))
        })?;
        Ok(Box::new(result))
    }
}

fn resolve_workdir(session_cwd: &std::path::Path, workdir: Option<String>) -> PathBuf {
    let Some(workdir) = workdir.filter(|workdir| !workdir.is_empty()) else {
        return session_cwd.to_path_buf();
    };
    let workdir = PathBuf::from(workdir);
    if workdir.is_absolute() {
        workdir
    } else {
        session_cwd.join(workdir)
    }
}

fn one_shot_exec_command_spec(spec: ToolSpec) -> ToolSpec {
    let ToolSpec::Function(mut spec) = spec else {
        unreachable!("exec_command has a function spec")
    };
    spec.description = spec.description.replacen(
        "Runs a command in a PTY, returning output or a session ID for ongoing interaction.",
        "Runs a command to completion and returns its output. The process is terminated on timeout or cancellation and cannot be resumed.",
        1,
    );
    let properties = spec.parameters["properties"]
        .as_object_mut()
        .expect("exec_command properties must be an object");
    properties.remove("tty");
    properties.remove("yield_time_ms");
    properties.insert(
        "timeout_ms".to_string(),
        serde_json::json!({
            "type": "number",
            "description": "Maximum command runtime. Defaults to 10000 ms."
        }),
    );
    spec.output_schema = spec.output_schema.map(|mut schema| {
        schema["properties"]
            .as_object_mut()
            .expect("unified exec output properties must be an object")
            .remove("session_id");
        schema
    });
    ToolSpec::Function(spec)
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn one_shot_schema_replaces_interactive_parameters() {
        let handler = ExecCommandHandler::one_shot(ExecCommandHandlerOptions {
            allow_login_shell: false,
            allow_tty: true,
            include_windows_shell_guidance: false,
        });
        let ToolSpec::Function(spec) = handler.spec() else {
            panic!("expected function")
        };
        assert!(spec.parameters["properties"].get("tty").is_none());
        assert!(spec.parameters["properties"].get("yield_time_ms").is_none());
        assert!(spec.parameters["properties"].get("timeout_ms").is_some());
        assert_eq!(
            spec.output_schema.unwrap()["properties"].get("session_id"),
            None
        );
    }
}
