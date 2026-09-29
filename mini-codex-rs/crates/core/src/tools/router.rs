use std::sync::Arc;

use mini_codex_protocol::models::ResponseItem;
use mini_codex_tools::ToolName;
use mini_codex_tools::ToolSpec;

use crate::function_tool::FunctionCallError;
use crate::tools::context::ToolInvocation;
use crate::tools::context::ToolPayload;
use crate::tools::registry::AnyToolResult;
use crate::tools::registry::ToolRegistry;

#[derive(Clone, Debug, PartialEq)]
pub struct ToolCall {
    pub tool_name: ToolName,
    pub call_id: String,
    pub payload: ToolPayload,
    pub encrypted_function_args: Option<Vec<String>>,
}

pub(crate) struct ToolRouter {
    registry: ToolRegistry,
    model_visible_specs: Arc<[ToolSpec]>,
}

impl ToolRouter {
    pub(crate) fn from_parts(registry: ToolRegistry, model_visible_specs: Vec<ToolSpec>) -> Self {
        Self {
            registry,
            model_visible_specs: model_visible_specs.into(),
        }
    }

    pub(crate) fn model_visible_specs(&self) -> Arc<[ToolSpec]> {
        Arc::clone(&self.model_visible_specs)
    }

    pub(crate) fn tool_supports_parallel(&self, call: &ToolCall) -> bool {
        self.registry
            .supports_parallel_tool_calls(&call.tool_name)
            .unwrap_or(false)
    }

    pub(crate) fn build_tool_call(
        item: ResponseItem,
    ) -> Result<Option<ToolCall>, FunctionCallError> {
        match item {
            ResponseItem::ToolSearchCall {
                call_id: Some(call_id),
                execution,
                arguments,
                ..
            } if execution == "client" => {
                let arguments = serde_json::from_value(arguments).map_err(|err| {
                    FunctionCallError::RespondToModel(format!(
                        "failed to parse tool_search arguments: {err}"
                    ))
                })?;
                Ok(Some(ToolCall {
                    tool_name: ToolName::plain("tool_search"),
                    call_id,
                    payload: ToolPayload::ToolSearch { arguments },
                    encrypted_function_args: None,
                }))
            }
            ResponseItem::ToolSearchCall { .. } => Ok(None),
            ResponseItem::FunctionCall {
                name,
                namespace,
                arguments,
                encrypted_function_args,
                call_id,
                ..
            } => Ok(Some(ToolCall {
                tool_name: ToolName::new(namespace, name).with_default_namespace(),
                call_id,
                payload: ToolPayload::Function { arguments },
                encrypted_function_args,
            })),
            _ => Ok(None),
        }
    }

    pub(crate) async fn dispatch_tool_call_with_state(
        &self,
        invocation: ToolInvocation,
    ) -> Result<AnyToolResult, FunctionCallError> {
        self.registry.dispatch_any_with_state(invocation).await
    }
}
