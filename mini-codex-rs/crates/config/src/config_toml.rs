//! 对应 `codex-rs/config/src/config_toml.rs`：`config.toml` 反序列化后的原始形状。

use mini_codex_features::FeaturesToml;
use mini_codex_model_provider_info::ModelProviderInfo;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;

/// 从 `$MINI_CODEX_HOME/config.toml` 反序列化出的基础配置。
///
/// 这是“用户写了什么”，尚未与默认值、覆盖项合并；合并后的结果是 core 中的 `Config`。
/// 源项目还有数十个字段；本项目保留模型选择和当前工具链使用的 feature 子集。
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct ConfigToml {
    /// 可选的模型选择覆盖。
    pub model: Option<String>,

    /// 从 `model_providers` 表中选用的 provider。
    pub model_provider: Option<String>,

    /// 集中式 feature flags；当前只识别 unified exec 相关键。
    #[serde(default)]
    pub features: Option<FeaturesToml>,

    /// 用户自定义的 provider，键为 provider id，会与内建 provider 合并。
    #[serde(default)]
    pub model_providers: HashMap<String, ModelProviderInfo>,
}
