use std::path::PathBuf;

use mini_codex_shell_command::shell_detect::DetectedShell;
use serde::Deserialize;
use serde::Serialize;

pub use mini_codex_shell_command::shell_detect::ShellType;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Shell {
    pub(crate) shell_type: ShellType,
    pub(crate) shell_path: PathBuf,
}

impl Shell {
    pub fn name(&self) -> &'static str {
        self.shell_type.name()
    }

    /// 把一段 shell 文本转换成真正交给进程执行器的 argv。
    pub fn derive_exec_args(&self, command: &str, use_login_shell: bool) -> Vec<String> {
        match self.shell_type {
            ShellType::Zsh | ShellType::Bash | ShellType::Sh => {
                let arg = if use_login_shell { "-lc" } else { "-c" };
                vec![
                    self.shell_path.to_string_lossy().to_string(),
                    arg.to_string(),
                    command.to_string(),
                ]
            }
            ShellType::PowerShell => {
                let mut args = vec![self.shell_path.to_string_lossy().to_string()];
                if !use_login_shell {
                    args.push("-NoProfile".to_string());
                }
                args.push("-Command".to_string());
                args.push(command.to_string());
                args
            }
            ShellType::Cmd => vec![
                self.shell_path.to_string_lossy().to_string(),
                "/c".to_string(),
                command.to_string(),
            ],
        }
    }
}

impl From<DetectedShell> for Shell {
    fn from(detected: DetectedShell) -> Self {
        Self {
            shell_type: detected.shell_type,
            shell_path: detected.shell_path,
        }
    }
}

pub fn get_shell_by_model_provided_path(shell_path: &PathBuf) -> Shell {
    mini_codex_shell_command::shell_detect::get_shell_by_model_provided_path(shell_path).into()
}

pub fn default_user_shell() -> Shell {
    mini_codex_shell_command::shell_detect::default_user_shell().into()
}

#[cfg(test)]
#[path = "shell_tests.rs"]
mod tests;
