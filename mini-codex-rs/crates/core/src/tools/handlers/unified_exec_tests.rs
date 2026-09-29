use std::path::PathBuf;
use std::sync::Arc;

use pretty_assertions::assert_eq;

use super::ExecCommandArgs;
use super::get_command;
use crate::shell::Shell;
use crate::shell::ShellType;

#[test]
fn command_uses_session_shell_when_shell_is_omitted() {
    let args: ExecCommandArgs = serde_json::from_str(r#"{"cmd":"printf ok"}"#).unwrap();
    let resolved = get_command(
        &args,
        Arc::new(Shell {
            shell_type: ShellType::Bash,
            shell_path: PathBuf::from("/bin/bash"),
        }),
        false,
    )
    .unwrap();
    assert_eq!(resolved.command, vec!["/bin/bash", "-c", "printf ok"]);
}

#[test]
fn model_shell_path_only_selects_a_known_shell_type() {
    let args: ExecCommandArgs =
        serde_json::from_str(r#"{"cmd":"printf ok","shell":"/bin/sh"}"#).unwrap();
    let resolved = get_command(
        &args,
        Arc::new(Shell {
            shell_type: ShellType::Bash,
            shell_path: PathBuf::from("/bin/bash"),
        }),
        false,
    )
    .unwrap();
    assert_eq!(resolved.shell_type, ShellType::Sh);
    assert_eq!(resolved.command[1], "-c");
}
