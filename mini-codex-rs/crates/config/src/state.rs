//! 对应 `codex-rs/config/src/state.rs`：已加载的配置层及其合并视图。

use crate::ConfigLayerSource;
use crate::merge_toml_values;
use toml::Value as TomlValue;

/// 一层已加载的配置。源项目还记录版本号、禁用原因和原始 TOML 文本，用于诊断与
/// `config/read` 的来源标注；本项目当前只保留来源和解析后的值。
#[derive(Debug, Clone, PartialEq)]
pub struct ConfigLayerEntry {
    pub name: ConfigLayerSource,
    pub config: TomlValue,
}

impl ConfigLayerEntry {
    pub fn new(name: ConfigLayerSource, config: TomlValue) -> Self {
        Self { name, config }
    }
}

/// 从低优先级到高优先级排列的配置层。
///
/// 源项目还在这里持有 requirements（管理员强制约束）；本项目尚未移植 requirements。
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ConfigLayerStack {
    /// 排列顺序为 base 在前、top 在后，因此后面的层覆盖前面的层。
    layers: Vec<ConfigLayerEntry>,
}

impl ConfigLayerStack {
    pub fn new(layers: Vec<ConfigLayerEntry>) -> Self {
        Self { layers }
    }

    /// 返回从低到高排列的所有层。
    pub fn layers_low_to_high(&self) -> impl Iterator<Item = &ConfigLayerEntry> {
        self.layers.iter()
    }

    /// 返回合并后的配置视图。
    pub fn effective_config(&self) -> TomlValue {
        let mut merged = TomlValue::Table(toml::map::Map::new());
        for layer in self.layers_low_to_high() {
            merge_toml_values(&mut merged, &layer.config);
        }
        merged
    }
}
