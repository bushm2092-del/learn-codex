//! 对应 `codex-rs/models-manager/src/manager.rs`：把目录条目整理成选择器预设。
//!
//! 源项目是一个 trait，带在线刷新、缓存与按登录方式过滤；本项目只保留静态目录实现。

use mini_codex_protocol::openai_models::ModelInfo;
use mini_codex_protocol::openai_models::ModelPreset;
use mini_codex_protocol::openai_models::ModelVisibility;
use mini_codex_protocol::openai_models::ModelsResponse;

/// 持有当前模型目录并提供选择器所需的查询。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelsManager {
    remote_models: Vec<ModelInfo>,
}

impl ModelsManager {
    pub fn new(model_catalog: ModelsResponse) -> Self {
        Self {
            remote_models: model_catalog.models,
        }
    }

    /// 列出所有可用模型，按优先级排序并标记默认项。
    pub fn list_models(&self) -> Vec<ModelPreset> {
        self.build_available_models(self.remote_models.clone())
    }

    /// 返回默认模型 slug：优先标记为默认的预设，否则退回第一个。
    pub fn get_default_model(&self) -> String {
        default_model_from_available(self.list_models())
    }

    /// 从目录快照构建选择器预设。
    fn build_available_models(&self, mut remote_models: Vec<ModelInfo>) -> Vec<ModelPreset> {
        remote_models.sort_by_key(|model| model.priority);

        let mut presets: Vec<ModelPreset> = remote_models
            .into_iter()
            .filter(|model| model.supported_in_api && model.visibility != ModelVisibility::None)
            .map(Into::into)
            .collect();

        ModelPreset::mark_default_by_picker_visibility(&mut presets);

        presets
    }
}

fn default_model_from_available(available: Vec<ModelPreset>) -> String {
    available
        .iter()
        .find(|model| model.is_default)
        .or_else(|| available.first())
        .map(|model| model.model.clone())
        .unwrap_or_default()
}

#[cfg(test)]
#[path = "manager_tests.rs"]
mod tests;
