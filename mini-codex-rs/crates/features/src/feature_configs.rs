use crate::FeatureConfig;
use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TokenBudgetConfigToml {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    /// 是否暴露 history/notes 扩展；当前内核尚未支持。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub use_history_notes_extension: Option<bool>,
    /// 剩余 tokens 达到此阈值时发出收尾提醒。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reminder_threshold_tokens: Option<i64>,
    /// 提醒模板；`{n_remaining}` 替换为自动切换前的剩余 tokens。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reminder_message_template: Option<String>,
    /// 与窗口元数据一起注入的 developer 指导信息。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guidance_message: Option<String>,
    /// 自动切换前供普通采样使用的 developer 收尾提示。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_compact_fallback_prompt: Option<String>,
    /// 自动阈值之后额外允许的收尾 tokens；不能扩大完整窗口上限。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_compact_fallback_buffer_tokens: Option<i64>,
}

impl FeatureConfig for TokenBudgetConfigToml {
    fn enabled(&self) -> Option<bool> {
        self.enabled
    }
}
