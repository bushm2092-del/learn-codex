//! 对应 `codex-rs/config/src/loader/mod.rs`：从磁盘装配配置层。
//!
//! 源项目按 packaged defaults → system → MDM → enterprise → user → project → runtime
//! 的顺序装配多层，并读取 requirements 约束；本项目只装配 user 层，其他层是尚未支持的分支。
//! 源项目通过 `ExecutorFileSystem` 抽象异步读文件，本项目直接使用 `std::fs`，因此为同步函数。

mod layer_io;

use crate::CONFIG_TOML_FILE;
use crate::ConfigLayerEntry;
use crate::ConfigLayerSource;
use crate::ConfigLayerStack;
use crate::build_cli_overrides_layer;
use std::io;
use std::path::Path;
use std::path::PathBuf;
use toml::Value as TomlValue;

/// 加载 `codex_home` 下的配置层，返回可以求合并视图的层栈。
///
/// `cli_overrides` 是 `-c key.path=value` 形式的运行期覆盖，非空时作为最高优先级层压入。
pub fn load_config_layers_state(
    codex_home: &Path,
    cli_overrides: &[(String, TomlValue)],
) -> io::Result<ConfigLayerStack> {
    let base_user_file = codex_home.join(CONFIG_TOML_FILE);
    let base_user_layer = load_user_config_layer(&base_user_file)?;
    let mut layers = vec![base_user_layer];

    // 为来自 CLI 或 UI 的运行期覆盖增加一层（若存在）。
    if !cli_overrides.is_empty() {
        layers.push(ConfigLayerEntry::new(
            ConfigLayerSource::SessionFlags,
            build_cli_overrides_layer(cli_overrides),
        ));
    }

    Ok(ConfigLayerStack::new(layers))
}

/// 读取 user 层；文件不存在时视为空表，保证首次运行无需手工创建 config.toml。
fn load_user_config_layer(user_file: &PathBuf) -> io::Result<ConfigLayerEntry> {
    let config_toml =
        layer_io::read_config_from_path(user_file, /*log_missing_as_info*/ true)?
            .unwrap_or_else(|| TomlValue::Table(toml::map::Map::new()));
    Ok(ConfigLayerEntry::new(
        ConfigLayerSource::User {
            file: user_file.clone(),
        },
        config_toml,
    ))
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
