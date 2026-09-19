//! 对应 `codex-rs/protocol/src/error.rs` 中跨层共享的错误类型。
//!
//! 源项目还有统一的 `CodexErr` 枚举；本项目尚未移植，这里只保留 provider 读取
//! API key 时需要的 `EnvVarError`。

/// 缺少环境变量时返回的错误，用于告诉用户如何设置 API key。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnvVarError {
    /// 缺失的环境变量名。
    pub var: String,
    /// 可选说明，帮助用户获取并设置该变量的值。
    pub instructions: Option<String>,
}

impl std::fmt::Display for EnvVarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Missing environment variable: `{}`.", self.var)?;
        if let Some(instructions) = &self.instructions {
            write!(f, " {instructions}")?;
        }
        Ok(())
    }
}

impl std::error::Error for EnvVarError {}
