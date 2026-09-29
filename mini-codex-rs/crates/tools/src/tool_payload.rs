use std::borrow::Cow;

#[derive(Clone, Debug, PartialEq)]
pub enum ToolPayload {
    Function {
        arguments: String,
    },
    ToolSearch {
        arguments: mini_codex_protocol::models::SearchToolCallParams,
    },
}

impl ToolPayload {
    pub fn log_payload(&self) -> Cow<'_, str> {
        match self {
            Self::Function { arguments } => Cow::Borrowed(arguments),
            Self::ToolSearch { arguments } => Cow::Owned(arguments.query.clone()),
        }
    }
}
