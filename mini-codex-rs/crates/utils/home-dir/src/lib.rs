//! 对应 `codex-rs/utils/home-dir`：定位 Codex 配置目录。
//!
//! 与源项目的唯一差异是目录名：源项目使用 `CODEX_HOME` / `~/.codex`，本项目使用
//! `MINI_CODEX_HOME` / `~/.mini-codex`，避免覆盖同一台机器上真实 Codex 的配置。

use dirs::home_dir;
use std::path::PathBuf;

/// 指定配置目录的环境变量名。
pub const CODEX_HOME_ENV: &str = "MINI_CODEX_HOME";
/// 未设置环境变量时，位于用户主目录下的默认目录名。
const DEFAULT_CODEX_HOME_DIR_NAME: &str = ".mini-codex";

/// 返回 Codex 配置目录。可以通过 `MINI_CODEX_HOME` 环境变量指定，未设置时默认为
/// `~/.mini-codex`。
///
/// - 设置了 `MINI_CODEX_HOME` 时，该值必须存在且是目录；路径会被规范化，否则返回 Err。
/// - 未设置时，不会检查目录是否存在。
pub fn find_codex_home() -> std::io::Result<PathBuf> {
    let codex_home_env = std::env::var(CODEX_HOME_ENV)
        .ok()
        .filter(|val| !val.is_empty());
    find_codex_home_from_env(codex_home_env.as_deref())
}

fn find_codex_home_from_env(codex_home_env: Option<&str>) -> std::io::Result<PathBuf> {
    // 尊重显式设置的环境变量，方便用户和测试覆盖默认位置。
    match codex_home_env {
        Some(val) => {
            let path = PathBuf::from(val);
            let metadata = std::fs::metadata(&path).map_err(|err| match err.kind() {
                std::io::ErrorKind::NotFound => std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("{CODEX_HOME_ENV} points to {val:?}, but that path does not exist"),
                ),
                _ => std::io::Error::new(
                    err.kind(),
                    format!("failed to read {CODEX_HOME_ENV} {val:?}: {err}"),
                ),
            })?;

            if !metadata.is_dir() {
                Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    format!("{CODEX_HOME_ENV} points to {val:?}, but that path is not a directory"),
                ))
            } else {
                path.canonicalize().map_err(|err| {
                    std::io::Error::new(
                        err.kind(),
                        format!("failed to canonicalize {CODEX_HOME_ENV} {val:?}: {err}"),
                    )
                })
            }
        }
        None => {
            let mut p = home_dir().ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Could not find home directory",
                )
            })?;
            p.push(DEFAULT_CODEX_HOME_DIR_NAME);
            Ok(p)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::find_codex_home_from_env;
    use dirs::home_dir;
    use pretty_assertions::assert_eq;
    use std::fs;
    use std::io::ErrorKind;
    use tempfile::TempDir;

    #[test]
    fn find_codex_home_env_missing_path_is_fatal() {
        let temp_home = TempDir::new().expect("temp home");
        let missing = temp_home.path().join("missing-codex-home");
        let missing_str = missing.to_str().expect("utf8 path");

        let err = find_codex_home_from_env(Some(missing_str)).expect_err("missing path");
        assert_eq!(err.kind(), ErrorKind::NotFound);
    }

    #[test]
    fn find_codex_home_env_file_is_fatal() {
        let temp_home = TempDir::new().expect("temp home");
        let file = temp_home.path().join("config-file");
        fs::write(&file, "not a directory").expect("write file");
        let file_str = file.to_str().expect("utf8 path");

        let err = find_codex_home_from_env(Some(file_str)).expect_err("file path");
        assert_eq!(err.kind(), ErrorKind::InvalidInput);
    }

    #[test]
    fn find_codex_home_env_directory_is_canonicalized() {
        let temp_home = TempDir::new().expect("temp home");
        let dir_str = temp_home.path().to_str().expect("utf8 path");

        let resolved = find_codex_home_from_env(Some(dir_str)).expect("existing directory");
        assert_eq!(
            resolved,
            temp_home.path().canonicalize().expect("canonical path")
        );
    }

    #[test]
    fn find_codex_home_defaults_to_home_directory() {
        let resolved = find_codex_home_from_env(None).expect("default home");
        let mut expected = home_dir().expect("home dir");
        expected.push(".mini-codex");
        assert_eq!(resolved, expected);
    }
}
