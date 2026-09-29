use std::path::PathBuf;

use pretty_assertions::assert_eq;

use super::Shell;
use super::ShellType;

#[test]
fn derives_posix_shell_arguments() {
    let shell = Shell {
        shell_type: ShellType::Bash,
        shell_path: PathBuf::from("/bin/bash"),
    };
    assert_eq!(
        shell.derive_exec_args("printf ok", false),
        vec!["/bin/bash", "-c", "printf ok"]
    );
    assert_eq!(
        shell.derive_exec_args("printf ok", true),
        vec!["/bin/bash", "-lc", "printf ok"]
    );
}

#[test]
fn derives_powershell_arguments() {
    let shell = Shell {
        shell_type: ShellType::PowerShell,
        shell_path: PathBuf::from("pwsh.exe"),
    };
    assert_eq!(
        shell.derive_exec_args("Get-ChildItem", false),
        vec!["pwsh.exe", "-NoProfile", "-Command", "Get-ChildItem"]
    );
}

#[test]
fn derives_cmd_arguments() {
    let shell = Shell {
        shell_type: ShellType::Cmd,
        shell_path: PathBuf::from("cmd.exe"),
    };
    assert_eq!(
        shell.derive_exec_args("dir", false),
        vec!["cmd.exe", "/c", "dir"]
    );
}
