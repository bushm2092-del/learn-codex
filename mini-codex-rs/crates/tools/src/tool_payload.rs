use std::borrow::Cow;

#[derive(Clone, Debug, PartialEq)]
pub enum ToolPayload {
    Function { arguments: String },
}

impl ToolPayload {
    pub fn log_payload(&self) -> Cow<'_, str> {
        match self {
            Self::Function { arguments } => Cow::Borrowed(arguments),
        }
    }
}
