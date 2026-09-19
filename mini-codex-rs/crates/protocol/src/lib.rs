//! mini-codex 前端和 core 之间传递的类型。
//!
//! 对应真实仓库的 `codex-rs/protocol`：本 crate 不承载业务逻辑。

pub mod error;
pub mod openai_models;

use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;

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

/// Responses API 的函数工具定义。
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ToolSpec {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub name: String,
    pub description: String,
    pub parameters: Value,
    pub strict: bool,
}

/// Harness 所需的 Responses API 函数调用字段。
#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct FunctionCall {
    pub call_id: String,
    pub name: String,
    pub arguments: String,
}
