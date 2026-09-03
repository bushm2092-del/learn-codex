//! mini-codex 前端和 core 之间传递的类型。
//!
//! 对应真实仓库的 `codex-rs/protocol`：本 crate 不承载业务逻辑。

use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;

#[derive(Clone, Debug, PartialEq)]
pub enum Op {
    UserTurn { text: String },
    Shutdown,
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
