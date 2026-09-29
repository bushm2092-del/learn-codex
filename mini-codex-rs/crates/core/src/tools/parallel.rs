use std::sync::Arc;

use mini_codex_protocol::Event;
use mini_codex_protocol::EventMsg;
use mini_codex_protocol::models::FunctionCallOutputBody;
use mini_codex_protocol::models::FunctionCallOutputPayload;
use mini_codex_protocol::models::ResponseInputItem;
use serde_json::Value;
use tokio::sync::RwLock;

use crate::function_tool::FunctionCallError;
use crate::session::Session;
use crate::tools::context::ToolInvocation;
use crate::tools::context::ToolPayload;
use crate::tools::router::ToolCall;

#[derive(Clone)]
pub(crate) struct ToolCallRuntime {
    session: Arc<Session>,
    submission_id: String,
    parallel_execution: Arc<RwLock<()>>,
}

impl ToolCallRuntime {
    pub(crate) fn new(session: Arc<Session>, submission_id: String) -> Self {
        Self {
            session,
            submission_id,
            parallel_execution: Arc::new(RwLock::new(())),
        }
    }

    pub(crate) async fn handle_tool_call(
        self,
        call: ToolCall,
    ) -> Result<ResponseInputItem, FunctionCallError> {
        let supports_parallel = self.session.tool_router.tool_supports_parallel(&call);
        let arguments = match &call.payload {
            ToolPayload::ToolSearch { arguments } => {
                serde_json::to_value(arguments).expect("search arguments serialize")
            }
            ToolPayload::Function { arguments } => {
                serde_json::from_str(arguments).unwrap_or_else(|_| Value::String(arguments.clone()))
            }
        };
        self.session
            .send_event(Event {
                submission_id: self.submission_id.clone(),
                msg: EventMsg::ToolCallStarted {
                    call_id: call.call_id.clone(),
                    name: call.tool_name.to_string(),
                    arguments,
                },
            })
            .await;

        let invocation = ToolInvocation {
            session: Arc::clone(&self.session),
            call_id: call.call_id.clone(),
            tool_name: call.tool_name.clone(),
            payload: call.payload.clone(),
        };
        let result = if supports_parallel {
            let _guard = self.parallel_execution.read().await;
            self.session
                .tool_router
                .dispatch_tool_call_with_state(invocation)
                .await
        } else {
            let _guard = self.parallel_execution.write().await;
            self.session
                .tool_router
                .dispatch_tool_call_with_state(invocation)
                .await
        };

        let (item, output, success) = match result {
            Ok(result) => {
                let output = result.result.log_output();
                let success = result.result.success_for_logging();
                (
                    result
                        .result
                        .to_response_item(&result.call_id, &result.payload),
                    output,
                    success,
                )
            }
            Err(FunctionCallError::RespondToModel(message)) => (
                Self::failure_response(&call, message.clone()),
                message,
                false,
            ),
            Err(error @ FunctionCallError::Fatal(_)) => return Err(error),
        };
        self.session
            .send_event(Event {
                submission_id: self.submission_id,
                msg: EventMsg::ToolCallCompleted {
                    call_id: call.call_id,
                    name: call.tool_name.to_string(),
                    output,
                    success,
                },
            })
            .await;
        Ok(item)
    }

    fn failure_response(call: &ToolCall, message: String) -> ResponseInputItem {
        if matches!(call.payload, ToolPayload::ToolSearch { .. }) {
            return ResponseInputItem::ToolSearchOutput {
                call_id: call.call_id.clone(),
                status: "completed".to_string(),
                execution: "client".to_string(),
                tools: Vec::new(),
            };
        }
        ResponseInputItem::FunctionCallOutput {
            call_id: call.call_id.clone(),
            output: FunctionCallOutputPayload {
                body: FunctionCallOutputBody::Text(message),
                success: Some(false),
            },
        }
    }
}
