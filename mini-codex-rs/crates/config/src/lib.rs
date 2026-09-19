//! 对应 `codex-rs/config`：`config.toml` 的数据形状与分层加载。
//!
//! 源项目在这里维护 packaged defaults、system、MDM、enterprise、user、project、
//! runtime 多层配置以及 requirements 约束；本项目只保留 user 层
//! （`$MINI_CODEX_HOME/config.toml`），但沿用同名的 `ConfigLayerStack` 与 loader 结构，
//! 便于后续按源项目补回其他层。

mod config_layer_source;
mod config_toml;
mod fingerprint;
pub mod loader;
mod merge;
mod overrides;
mod state;

pub const CONFIG_TOML_FILE: &str = "config.toml";

pub use config_layer_source::ConfigLayerSource;
pub use config_toml::ConfigToml;
pub use fingerprint::version_for_toml;
pub use merge::merge_toml_values;
pub use overrides::build_cli_overrides_layer;
pub use state::ConfigLayerEntry;
pub use state::ConfigLayerStack;
