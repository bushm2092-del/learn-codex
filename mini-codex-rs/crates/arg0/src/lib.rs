//! 对应 `codex-rs/arg0`：进程入口最早执行的准备工作。
//!
//! 源项目在这里还根据 argv[0] 分派 `apply_patch`/sandbox 子命令并调整 PATH；
//! 本项目只保留 `.env` 加载。它必须在创建任何线程或 Tokio 运行时之前调用，
//! 因为 `std::env::set_var` 在多线程下不安全。

use mini_codex_utils_home_dir::find_codex_home;
use std::path::Path;

/// `.env` 不允许创建或修改以此前缀开头的变量，避免配置文件劫持 `MINI_CODEX_HOME` 等控制项。
const ILLEGAL_ENV_VAR_PREFIX: &str = "MINI_CODEX_";

/// 从 `$MINI_CODEX_HOME/.env`（默认 `~/.mini-codex/.env`）加载环境变量。
///
/// 只读配置目录下的 `.env`，不读当前工作目录，避免在不可信仓库里被注入变量。
/// 文件不存在时静默跳过。
pub fn load_dotenv() {
    if let Ok(codex_home) = find_codex_home() {
        load_dotenv_from(&codex_home.join(".env"));
    }
}

fn load_dotenv_from(path: &Path) {
    if let Ok(iter) = dotenvy::from_path_iter(path) {
        set_filtered(iter);
    }
}

/// 逐项写入环境变量，同时过滤掉 `MINI_CODEX_` 前缀的键。
fn set_filtered<I>(iter: I)
where
    I: IntoIterator<Item = Result<(String, String), dotenvy::Error>>,
{
    for (key, value) in iter.into_iter().flatten() {
        if !key.to_ascii_uppercase().starts_with(ILLEGAL_ENV_VAR_PREFIX) {
            // 调用方保证此时进程仍是单线程，因此 set_var 是安全的。
            unsafe { std::env::set_var(&key, &value) };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::load_dotenv_from;
    use pretty_assertions::assert_eq;
    use tempfile::TempDir;

    #[test]
    fn loads_plain_keys_and_filters_mini_codex_prefix() {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join(".env");
        // 用不带保留前缀的键验证写入；带前缀的键（含小写）必须被忽略。
        std::fs::write(
            &path,
            "ARG0_TEST_PLAIN=from-dotenv\nmini_codex_home=/tmp/hijack\nMINI_CODEX_MODEL=hijack\n",
        )
        .expect("write");
        unsafe {
            std::env::remove_var("ARG0_TEST_PLAIN");
            std::env::remove_var("mini_codex_home");
            std::env::remove_var("MINI_CODEX_MODEL");
        }

        load_dotenv_from(&path);

        assert_eq!(
            std::env::var("ARG0_TEST_PLAIN").ok(),
            Some("from-dotenv".to_string())
        );
        assert_eq!(std::env::var("mini_codex_home").ok(), None);
        assert_eq!(std::env::var("MINI_CODEX_MODEL").ok(), None);
        unsafe { std::env::remove_var("ARG0_TEST_PLAIN") };
    }

    #[test]
    fn missing_file_is_ignored() {
        let dir = TempDir::new().expect("temp dir");
        load_dotenv_from(&dir.path().join(".env"));
    }
}
