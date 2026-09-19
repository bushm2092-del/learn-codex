//! 对应 `codex-rs/protocol/src/openai_models.rs`：模型目录的数据形状。
//!
//! 源项目的 `ModelInfo` 还携带上下文窗口、推理档位、工具类型等数十个字段；
//! 本项目只保留选择模型与展示列表所需的子集，JSON 字段名与源项目一致。

use serde::Deserialize;
use serde::Serialize;

/// 模型在选择器中的可见性。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelVisibility {
    /// 在选择器中列出。
    List,
    /// 可以使用但不在选择器中显示（例如兼容旧名）。
    Hide,
    /// 完全不可用。
    None,
}

/// 目录中一条模型的元数据（`models.json` 的单个条目）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelInfo {
    pub slug: String,
    pub display_name: String,
    pub description: Option<String>,
    pub visibility: ModelVisibility,
    pub supported_in_api: bool,
    pub priority: i32,
}

/// 模型目录文件的顶层形状。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelInfo>,
}

/// 供 UI 选择器使用的模型预设。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelPreset {
    /// 预设的稳定标识。
    pub id: String,
    /// 模型 slug（例如 `deepseek-flash`）。
    pub model: String,
    /// UI 中显示的名称。
    pub display_name: String,
    /// UI 中显示的简短说明。
    pub description: String,
    /// 是否为新用户的默认模型。
    pub is_default: bool,
    /// 是否应出现在选择器中。
    pub show_in_picker: bool,
}

impl From<ModelInfo> for ModelPreset {
    fn from(info: ModelInfo) -> Self {
        ModelPreset {
            id: info.slug.clone(),
            model: info.slug.clone(),
            display_name: info.display_name,
            description: info.description.unwrap_or_default(),
            // 默认模型是优先级最高的可用模型，由 `mark_default_by_picker_visibility` 标记。
            is_default: false,
            show_in_picker: info.visibility == ModelVisibility::List,
        }
    }
}

impl ModelPreset {
    /// 把第一个可见预设标记为默认；若都不可见，则退回第一个。
    pub fn mark_default_by_picker_visibility(models: &mut [ModelPreset]) {
        for preset in models.iter_mut() {
            preset.is_default = false;
        }
        if let Some(default) = models.iter_mut().find(|preset| preset.show_in_picker) {
            default.is_default = true;
        } else if let Some(default) = models.first_mut() {
            default.is_default = true;
        }
    }
}
