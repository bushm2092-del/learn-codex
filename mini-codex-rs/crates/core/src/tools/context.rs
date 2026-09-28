use std::sync::Arc;

use mini_codex_tools::ToolName;

use crate::session::Session;

pub use mini_codex_tools::FunctionToolOutput;
pub use mini_codex_tools::ToolOutput;
pub use mini_codex_tools::ToolPayload;

/// 一次工具调用拥有的最小运行时上下文。
///
/// 源项目还包含 turn/step、取消令牌和 diff tracker；本项目尚未支持这些能力，
/// 因而删除对应字段，但保留相同类型名与已支持字段的含义。
#[derive(Clone)]
pub(crate) struct ToolInvocation {
    pub(crate) session: Arc<Session>,
    pub(crate) call_id: String,
    pub(crate) tool_name: ToolName,
    pub(crate) payload: ToolPayload,
}
