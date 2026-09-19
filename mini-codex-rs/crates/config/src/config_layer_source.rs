//! 对应 `codex-rs/config/src/config_layer_source.rs`：每一层配置的来源。

use std::path::PathBuf;

/// 配置层的来源。源项目还有 PackagedDefaults、Mdm、System、EnterpriseManaged、
/// Project 等层；本项目当前只加载 user 层和运行期覆盖层。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigLayerSource {
    /// 用户配置，即 `$MINI_CODEX_HOME/config.toml`。
    User { file: PathBuf },
    /// 来自 CLI 参数或 UI 的运行期覆盖，优先级最高。
    SessionFlags,
}
