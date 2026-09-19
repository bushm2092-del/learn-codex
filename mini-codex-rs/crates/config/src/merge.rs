//! 对应 `codex-rs/config/src/merge.rs`：TOML 值的分层合并规则。
//!
//! 源项目在递归过程中还处理 features、key alias、network domains 等特殊路径；
//! 本项目只保留通用规则：表递归合并，其他类型由高优先级层整体替换。

use toml::Value as TomlValue;

/// 把 `overlay` 合并进 `base`：两边都是表时逐键递归，否则用 `overlay` 覆盖。
pub fn merge_toml_values(base: &mut TomlValue, overlay: &TomlValue) {
    if let TomlValue::Table(overlay_table) = overlay
        && let TomlValue::Table(base_table) = base
    {
        for (key, value) in overlay_table {
            if let Some(existing) = base_table.get_mut(key) {
                merge_toml_values(existing, value);
            } else {
                base_table.insert(key.clone(), value.clone());
            }
        }
    } else {
        *base = overlay.clone();
    }
}

#[cfg(test)]
#[path = "merge_tests.rs"]
mod tests;
