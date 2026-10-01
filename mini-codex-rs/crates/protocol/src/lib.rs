//! mini-codex 前端和 core 之间传递的类型。
//!
//! 对应真实仓库的 `codex-rs/protocol`：本 crate 不承载业务逻辑。

pub mod error;
pub mod models;
pub mod openai_models;
mod tool_name;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use tool_name::ToolName;
pub const DEFAULT_FUNCTION_NAMESPACE: &str = "functions";

#[derive(Clone, Debug, PartialEq)]
pub enum Op {
    UserTurn {
        text: String,
    },
    /// 更新会话级设置（例如模型），对后续回合生效。
    ThreadSettings {
        thread_settings: ThreadSettingsOverrides,
    },
    Shutdown,
}

/// 会话设置的可选覆盖；`None` 表示保持当前值。
///
/// 源项目还有 approval、sandbox、cwd、reasoning effort 等字段，本项目只保留模型。
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ThreadSettingsOverrides {
    /// 新模型 slug。
    pub model: Option<String>,
}

/// 设置更新生效后的会话快照。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ThreadSettingsSnapshot {
    pub model: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Submission {
    pub id: String,
    pub op: Op,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Event {
    pub submission_id: String,
    pub msg: EventMsg,
}

#[derive(Clone, Debug, PartialEq)]
pub enum EventMsg {
    TurnStarted,
    AgentMessageDelta(String),
    AgentMessage(String),
    ToolCallStarted {
        call_id: String,
        name: String,
        arguments: Value,
    },
    ToolCallCompleted {
        call_id: String,
        name: String,
        output: String,
        success: bool,
    },
    TurnCompleted {
        last_agent_message: Option<String>,
    },
    /// `Op::ThreadSettings` 应用成功后发出。
    ThreadSettingsApplied(ThreadSettingsSnapshot),
    Error(String),
    ShutdownComplete,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "mode", content = "limit", rename_all = "snake_case")]
pub enum TruncationPolicy {
    Bytes(usize),
    Tokens(usize),
}

impl TruncationPolicy {
    pub fn token_budget(&self) -> usize {
        match self {
            TruncationPolicy::Bytes(bytes) => bytes.saturating_add(3) / 4,
            TruncationPolicy::Tokens(tokens) => *tokens,
        }
    }

    pub fn byte_budget(&self) -> usize {
        match self {
            TruncationPolicy::Bytes(bytes) => *bytes,
            TruncationPolicy::Tokens(tokens) => tokens.saturating_mul(4),
        }
    }
}

impl std::ops::Mul<f64> for TruncationPolicy {
    type Output = Self;

    fn mul(self, multiplier: f64) -> Self::Output {
        match self {
            TruncationPolicy::Bytes(bytes) => {
                TruncationPolicy::Bytes((bytes as f64 * multiplier).ceil() as usize)
            }
            TruncationPolicy::Tokens(tokens) => {
                TruncationPolicy::Tokens((tokens as f64 * multiplier).ceil() as usize)
            }
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, PartialEq, Eq)]
pub struct TokenUsage {
    pub input_tokens: i64,
    pub cached_input_tokens: i64,
    #[serde(default)]
    pub cache_write_input_tokens: i64,
    pub output_tokens: i64,
    pub reasoning_output_tokens: i64,
    pub total_tokens: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct TokenUsageInfo {
    pub total_token_usage: TokenUsage,
    pub last_token_usage: TokenUsage,
    // 模型未声明窗口时沿用上游的缺省语义。
    pub model_context_window: Option<i64>,
}

impl TokenUsageInfo {
    pub fn new_or_append(
        info: &Option<TokenUsageInfo>,
        last: &Option<TokenUsage>,
        model_context_window: Option<i64>,
    ) -> Option<Self> {
        if info.is_none() && last.is_none() {
            return None;
        }

        let mut info = match info {
            Some(info) => info.clone(),
            None => Self {
                total_token_usage: TokenUsage::default(),
                last_token_usage: TokenUsage::default(),
                model_context_window,
            },
        };
        if let Some(last) = last {
            info.append_last_usage(last);
        }
        if let Some(model_context_window) = model_context_window {
            info.model_context_window = Some(model_context_window);
        }
        Some(info)
    }

    pub fn append_last_usage(&mut self, last: &TokenUsage) {
        self.total_token_usage.add_assign(last);
        self.last_token_usage = last.clone();
    }
}

impl TokenUsage {
    pub fn add_assign(&mut self, other: &TokenUsage) {
        self.input_tokens += other.input_tokens;
        self.cached_input_tokens += other.cached_input_tokens;
        self.cache_write_input_tokens += other.cache_write_input_tokens;
        self.output_tokens += other.output_tokens;
        self.reasoning_output_tokens += other.reasoning_output_tokens;
        self.total_tokens += other.total_tokens;
    }
}
