use std::path::PathBuf;

use crate::shell_detect::ShellType;
use crate::shell_detect::detect_shell_type;

const POWERSHELL_FLAGS: &[&str] = &["-nologo", "-noprofile", "-command", "-c"];

pub const UTF8_OUTPUT_PREFIX: &str =
    "try { [Console]::OutputEncoding=[System.Text.Encoding]::UTF8 } catch {}\n";

pub fn prefix_powershell_script_with_utf8(command: &[String]) -> Vec<String> {
    let Some((_, script)) = extract_powershell_command(command) else {
        return command.to_vec();
    };
    let trimmed = script.trim_start();
    let script = if trimmed.starts_with(UTF8_OUTPUT_PREFIX) {
        script.to_string()
    } else {
        format!("{UTF8_OUTPUT_PREFIX}{script}")
    };
    let mut command = command[..command.len() - 1].to_vec();
    command.push(script);
    command
}

pub fn extract_powershell_command(command: &[String]) -> Option<(&str, &str)> {
    if command.len() < 3 {
        return None;
    }
    let shell = &command[0];
    if !matches!(
        detect_shell_type(PathBuf::from(shell)),
        Some(ShellType::PowerShell)
    ) {
        return None;
    }
    let mut index = 1;
    while index + 1 < command.len() {
        let flag = &command[index];
        if !POWERSHELL_FLAGS.contains(&flag.to_ascii_lowercase().as_str()) {
            return None;
        }
        if flag.eq_ignore_ascii_case("-Command") || flag.eq_ignore_ascii_case("-c") {
            return Some((shell, &command[index + 1]));
        }
        index += 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_recognized_powershell_script_once() {
        let command = vec![
            "pwsh".to_string(),
            "-NoProfile".to_string(),
            "-Command".to_string(),
            "Write-Output 中文".to_string(),
        ];
        let prefixed = prefix_powershell_script_with_utf8(&command);
        assert!(prefixed.last().unwrap().starts_with(UTF8_OUTPUT_PREFIX));
        assert_eq!(prefix_powershell_script_with_utf8(&prefixed), prefixed);
    }
}
