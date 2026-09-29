use std::path::PathBuf;
use std::sync::Arc;

use serde::Deserialize;

use crate::shell::Shell;
use crate::shell::ShellType;
use crate::shell::get_shell_by_model_provided_path;

mod exec_command;
mod write_stdin;

pub use exec_command::ExecCommandHandler;
pub(crate) use exec_command::ExecCommandHandlerOptions;
pub use write_stdin::WriteStdinHandler;

#[derive(Debug, Deserialize)]
pub(crate) struct ExecCommandArgs {
    pub(crate) cmd: String,
    #[serde(default)]
    shell: Option<String>,
    #[serde(default)]
    login: Option<bool>,
    #[serde(default = "default_tty")]
    tty: bool,
    #[serde(default = "default_exec_yield_time_ms")]
    yield_time_ms: u64,
    #[serde(default)]
    timeout_ms: Option<u64>,
    #[serde(default)]
    max_output_tokens: Option<usize>,
    #[serde(default)]
    workdir: Option<String>,
}

fn default_exec_yield_time_ms() -> u64 {
    10_000
}

fn default_write_stdin_yield_time_ms() -> u64 {
    250
}

fn default_tty() -> bool {
    false
}

#[derive(Debug)]
pub(crate) struct ResolvedCommand {
    pub(crate) command: Vec<String>,
    pub(crate) shell_type: ShellType,
}

pub(crate) fn get_command(
    args: &ExecCommandArgs,
    session_shell: Arc<Shell>,
    allow_login_shell: bool,
) -> Result<ResolvedCommand, String> {
    let use_login_shell = match args.login {
        Some(true) if !allow_login_shell => {
            return Err(
                "login shell is disabled by config; omit `login` or set it to false.".to_string(),
            );
        }
        Some(use_login_shell) => use_login_shell,
        None => allow_login_shell,
    };
    let model_shell = args
        .shell
        .as_ref()
        .map(|shell| get_shell_by_model_provided_path(&PathBuf::from(shell)));
    let shell = model_shell.as_ref().unwrap_or(session_shell.as_ref());
    Ok(ResolvedCommand {
        command: shell.derive_exec_args(&args.cmd, use_login_shell),
        shell_type: shell.shell_type,
    })
}

#[cfg(test)]
#[path = "unified_exec_tests.rs"]
mod tests;
