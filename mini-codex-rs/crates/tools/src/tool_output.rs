use mini_codex_protocol::models::FunctionCallOutputContentItem;
use mini_codex_protocol::models::FunctionCallOutputPayload;
use mini_codex_protocol::models::ResponseInputItem;
use mini_codex_protocol::models::function_call_output_content_items_to_text;
use serde_json::Value as JsonValue;

use crate::ToolPayload;

pub trait ToolOutput: Send {
    fn log_output(&self) -> String;
    fn success_for_logging(&self) -> bool;
    fn to_response_item(&self, call_id: &str, payload: &ToolPayload) -> ResponseInputItem;
}

#[derive(Clone, Debug, PartialEq)]
pub struct FunctionToolOutput {
    pub body: Vec<FunctionCallOutputContentItem>,
    pub success: Option<bool>,
    pub post_tool_use_response: Option<JsonValue>,
}

impl FunctionToolOutput {
    pub fn from_text(text: String, success: Option<bool>) -> Self {
        Self {
            body: vec![FunctionCallOutputContentItem::InputText { text }],
            success,
            post_tool_use_response: None,
        }
    }
}

impl ToolOutput for FunctionToolOutput {
    fn log_output(&self) -> String {
        function_call_output_content_items_to_text(&self.body).unwrap_or_default()
    }

    fn success_for_logging(&self) -> bool {
        self.success.unwrap_or(true)
    }

    fn to_response_item(&self, call_id: &str, _payload: &ToolPayload) -> ResponseInputItem {
        let body = match self.body.as_slice() {
            [FunctionCallOutputContentItem::InputText { text }] => {
                mini_codex_protocol::models::FunctionCallOutputBody::Text(text.clone())
            }
            _ => {
                mini_codex_protocol::models::FunctionCallOutputBody::ContentItems(self.body.clone())
            }
        };
        ResponseInputItem::FunctionCallOutput {
            call_id: call_id.to_string(),
            output: FunctionCallOutputPayload {
                body,
                success: self.success,
            },
        }
    }
}
