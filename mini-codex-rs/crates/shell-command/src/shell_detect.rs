use std::path::Path;
use std::path::PathBuf;

use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize, Deserialize)]
pub enum ShellType {
    Zsh,
    Bash,
    PowerShell,
    Sh,
    Cmd,
}

impl ShellType {
    pub fn name(self) -> &'static str {
        match self {
            Self::Zsh => "zsh",
            Self::Bash => "bash",
            Self::PowerShell => "powershell",
            Self::Sh => "sh",
            Self::Cmd => "cmd",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectedShell {
    pub shell_type: ShellType,
    pub shell_path: PathBuf,
}

impl DetectedShell {
    pub fn name(&self) -> &'static str {
        self.shell_type.name()
    }
}

pub fn detect_shell_type(shell_path: impl AsRef<Path>) -> Option<ShellType> {
    let shell_path = shell_path.as_ref();
    match shell_path.as_os_str().to_str() {
        Some("zsh") => Some(ShellType::Zsh),
        Some("sh") => Some(ShellType::Sh),
        Some("cmd") => Some(ShellType::Cmd),
        Some("bash") => Some(ShellType::Bash),
        Some("pwsh") => Some(ShellType::PowerShell),
        Some("powershell") => Some(ShellType::PowerShell),
        _ => {
            let shell_name = shell_path.file_stem()?;
            let shell_name_path = Path::new(shell_name);
            (shell_name_path != shell_path)
                .then(|| detect_shell_type(shell_name_path))
                .flatten()
        }
    }
}

#[cfg(unix)]
fn get_user_shell_path() -> Option<PathBuf> {
    use std::ffi::CStr;
    use std::mem::MaybeUninit;
    use std::ptr;

    let uid = unsafe { libc::getuid() };
    let mut passwd = MaybeUninit::<libc::passwd>::uninit();
    let suggested_buffer_len = unsafe { libc::sysconf(libc::_SC_GETPW_R_SIZE_MAX) };
    let buffer_len = usize::try_from(suggested_buffer_len)
        .ok()
        .filter(|len| *len > 0)
        .unwrap_or(1024);
    let mut buffer = vec![0; buffer_len];

    loop {
        let mut result = ptr::null_mut();
        let status = unsafe {
            libc::getpwuid_r(
                uid,
                passwd.as_mut_ptr(),
                buffer.as_mut_ptr().cast(),
                buffer.len(),
                &mut result,
            )
        };
        if status == 0 {
            if result.is_null() {
                return None;
            }
            let passwd = unsafe { passwd.assume_init_ref() };
            if passwd.pw_shell.is_null() {
                return None;
            }
            return Some(PathBuf::from(
                unsafe { CStr::from_ptr(passwd.pw_shell) }
                    .to_string_lossy()
                    .into_owned(),
            ));
        }
        if status != libc::ERANGE {
            return None;
        }
        let new_len = buffer.len().checked_mul(2)?;
        if new_len > 1024 * 1024 {
            return None;
        }
        buffer.resize(new_len, 0);
    }
}

#[cfg(not(unix))]
fn get_user_shell_path() -> Option<PathBuf> {
    None
}

fn file_exists(path: &Path) -> Option<PathBuf> {
    std::fs::metadata(path)
        .is_ok_and(|metadata| metadata.is_file())
        .then(|| path.to_path_buf())
}

fn get_shell_path(
    shell_type: ShellType,
    binary_name: &str,
    fallback_paths: &[&str],
) -> Option<PathBuf> {
    let default_shell_path = get_user_shell_path();
    if let Some(default_shell_path) = default_shell_path
        && detect_shell_type(&default_shell_path) == Some(shell_type)
        && file_exists(&default_shell_path).is_some()
    {
        return Some(default_shell_path);
    }
    if let Ok(path) = which::which(binary_name) {
        return Some(path);
    }
    fallback_paths
        .iter()
        .find_map(|path| file_exists(Path::new(path)))
}

fn detected(
    shell_type: ShellType,
    binary_name: &str,
    fallback_paths: &[&str],
) -> Option<DetectedShell> {
    get_shell_path(shell_type, binary_name, fallback_paths).map(|shell_path| DetectedShell {
        shell_type,
        shell_path,
    })
}

fn get_zsh_shell() -> Option<DetectedShell> {
    detected(ShellType::Zsh, "zsh", &["/bin/zsh"])
}

fn get_bash_shell() -> Option<DetectedShell> {
    detected(ShellType::Bash, "bash", &["/bin/bash", "/usr/bin/bash"])
}

fn get_sh_shell() -> Option<DetectedShell> {
    detected(ShellType::Sh, "sh", &["/bin/sh"])
}

#[cfg(windows)]
const PWSH_FALLBACK_PATHS: &[&str] = &[r#"C:\Program Files\PowerShell\7\pwsh.exe"#];
#[cfg(not(windows))]
const PWSH_FALLBACK_PATHS: &[&str] = &["/usr/local/bin/pwsh"];

#[cfg(windows)]
const POWERSHELL_FALLBACK_PATHS: &[&str] =
    &[r#"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"#];
#[cfg(not(windows))]
const POWERSHELL_FALLBACK_PATHS: &[&str] = &[];

fn get_powershell_shell() -> Option<DetectedShell> {
    detected(ShellType::PowerShell, "pwsh", PWSH_FALLBACK_PATHS).or_else(|| {
        detected(
            ShellType::PowerShell,
            "powershell",
            POWERSHELL_FALLBACK_PATHS,
        )
    })
}

fn get_cmd_shell() -> Option<DetectedShell> {
    detected(ShellType::Cmd, "cmd", &[])
}

pub fn ultimate_fallback_shell() -> DetectedShell {
    if cfg!(windows) {
        DetectedShell {
            shell_type: ShellType::Cmd,
            shell_path: PathBuf::from("cmd.exe"),
        }
    } else {
        DetectedShell {
            shell_type: ShellType::Sh,
            shell_path: PathBuf::from("/bin/sh"),
        }
    }
}

/// 模型提供的路径只用于选择 shell 类型；可执行文件仍由 Codex 自行发现。
pub fn get_shell_by_model_provided_path(shell_path: &PathBuf) -> DetectedShell {
    detect_shell_type(shell_path)
        .and_then(get_shell)
        .unwrap_or_else(ultimate_fallback_shell)
}

pub fn get_shell(shell_type: ShellType) -> Option<DetectedShell> {
    match shell_type {
        ShellType::Zsh => get_zsh_shell(),
        ShellType::Bash => get_bash_shell(),
        ShellType::PowerShell => get_powershell_shell(),
        ShellType::Sh => get_sh_shell(),
        ShellType::Cmd => get_cmd_shell(),
    }
}

pub fn default_user_shell() -> DetectedShell {
    default_user_shell_from_path(get_user_shell_path())
}

pub fn default_user_shell_from_path(user_shell_path: Option<PathBuf>) -> DetectedShell {
    if cfg!(windows) {
        get_shell(ShellType::PowerShell).unwrap_or_else(ultimate_fallback_shell)
    } else {
        let user_default_shell: Option<DetectedShell> = user_shell_path
            .and_then(|shell| detect_shell_type(&shell))
            .and_then(get_shell);
        let shell_with_fallback = if cfg!(target_os = "macos") {
            user_default_shell
                .or_else(get_zsh_shell)
                .or_else(get_bash_shell)
        } else {
            user_default_shell
                .or_else(get_bash_shell)
                .or_else(get_zsh_shell)
        };
        shell_with_fallback.unwrap_or_else(ultimate_fallback_shell)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn detects_supported_shell_names_and_paths() {
        assert_eq!(detect_shell_type("bash"), Some(ShellType::Bash));
        assert_eq!(detect_shell_type("/bin/zsh"), Some(ShellType::Zsh));
        assert_eq!(detect_shell_type("pwsh.exe"), Some(ShellType::PowerShell));
        assert_eq!(detect_shell_type("cmd.exe"), Some(ShellType::Cmd));
        assert_eq!(detect_shell_type("fish"), None);
    }

    #[cfg(unix)]
    #[test]
    fn unix_fallback_is_sh() {
        assert_eq!(ultimate_fallback_shell().shell_type, ShellType::Sh);
        assert_eq!(
            ultimate_fallback_shell().shell_path,
            PathBuf::from("/bin/sh")
        );
    }
}
