use crate::{message_processor::MessageProcessor, outgoing_message::OutgoingMessage};
use mini_codex_app_server_protocol::{
    ThreadSettingsUpdateParams, ThreadSettingsUpdateResponse, TurnStartParams, UserInput,
};
use mini_codex_core::CodexThread;
use mini_codex_protocol::{EventMsg, ThreadSettingsOverrides};
use serde_json::{Value, json};
use std::{collections::HashMap, path::PathBuf, sync::Arc};
use tokio::sync::Mutex;

impl MessageProcessor {
    pub async fn turn_start(&mut self, id: Value, params: Value) {
        let params: TurnStartParams = match serde_json::from_value(params) {
            Ok(params) => params,
            Err(_) => {
                self.outgoing
                    .error(id, -32602, "Invalid turn/start params")
                    .await;
                return;
            }
        };
        let text = params
            .input
            .into_iter()
            .map(|input| match input {
                UserInput::Text { text } => text,
            })
            .collect::<Vec<_>>()
            .join("\n");
        if text.trim().is_empty() {
            self.outgoing
                .error(id, -32602, "Input must not be empty")
                .await;
            return;
        }
        let Some(state) = self.threads.get(&params.thread_id) else {
            self.outgoing.error(id, -32602, "Thread not found").await;
            return;
        };
        // 持锁直到响应入队，确保客户端先收到 turn id，再收到该回合事件。
        let mut busy = state.busy.lock().await;
        if *busy {
            self.outgoing
                .error(id, -32600, "Thread already has an active turn")
                .await;
            return;
        }
        match state.thread.start_turn(text).await {
            Ok(turn_id) => {
                *busy = true;
                self.outgoing.response(id, json!({"turn": {"id": turn_id, "items": [], "status": "inProgress", "error": null}})).await;
            }
            Err(_) => self.outgoing.error(id, -32603, "Session stopped").await,
        }
    }

    /// `thread/settings/update`：把模型等会话设置提交给 core，对后续回合生效。
    pub async fn thread_settings_update(&mut self, id: Value, params: Value) {
        let params: ThreadSettingsUpdateParams = match serde_json::from_value(params) {
            Ok(params) => params,
            Err(_) => {
                self.outgoing
                    .error(id, -32602, "Invalid thread/settings/update params")
                    .await;
                return;
            }
        };
        let Some(state) = self.threads.get(&params.thread_id) else {
            self.outgoing.error(id, -32602, "Thread not found").await;
            return;
        };
        let thread_settings = ThreadSettingsOverrides {
            model: params.model,
        };
        if thread_settings != ThreadSettingsOverrides::default()
            && state
                .thread
                .update_thread_settings(thread_settings)
                .await
                .is_err()
        {
            self.outgoing.error(id, -32603, "Session stopped").await;
            return;
        }
        self.outgoing
            .response(
                id,
                serde_json::to_value(ThreadSettingsUpdateResponse::default())
                    .expect("response is serializable"),
            )
            .await;
    }
}

pub(super) async fn forward_events(
    thread: Arc<CodexThread>,
    thread_id: String,
    cwd: PathBuf,
    busy: Arc<Mutex<bool>>,
    outgoing: OutgoingMessage,
) {
    let mut commands: HashMap<String, Value> = HashMap::new();
    let mut message_index = 0;
    let mut message_started = false;
    while let Some(event) = thread.next_event().await {
        let mut active = busy.lock().await;
        let turn_id = event.submission_id;
        let item_id = format!("{turn_id}-message-{message_index}");
        let mut params = json!({"threadId": thread_id, "turnId": turn_id});
        let method = match event.msg {
            EventMsg::TurnStarted => {
                message_index = 0;
                message_started = false;
                commands.clear();
                params["turn"] =
                    json!({"id": turn_id, "items": [], "status": "inProgress", "error": null});
                "turn/started"
            }
            EventMsg::AgentMessageDelta(delta) => {
                if !message_started {
                    outgoing.notification("item/started", json!({"threadId": thread_id, "turnId": turn_id, "item": {"type": "agentMessage", "id": item_id, "text": ""}})).await;
                    message_started = true;
                }
                params["itemId"] = json!(item_id);
                params["delta"] = json!(delta);
                "item/agentMessage/delta"
            }
            EventMsg::AgentMessage(text) => {
                if !message_started {
                    outgoing.notification("item/started", json!({"threadId": thread_id, "turnId": turn_id, "item": {"type": "agentMessage", "id": item_id, "text": ""}})).await;
                }
                params["item"] = json!({"type": "agentMessage", "id": item_id, "text": text});
                message_index += 1;
                message_started = false;
                "item/completed"
            }
            EventMsg::ToolCallStarted {
                call_id,
                name,
                arguments,
            } => {
                let item = json!({"type": "commandExecution", "id": call_id, "command": arguments.get("cmd").and_then(Value::as_str).unwrap_or(&name), "cwd": cwd, "status": "inProgress", "aggregatedOutput": null, "exitCode": null});
                commands.insert(call_id, item.clone());
                params["item"] = item;
                "item/started"
            }
            EventMsg::ToolCallCompleted {
                call_id,
                name,
                output,
                success,
            } => {
                let mut item = commands.remove(&call_id).unwrap_or_else(|| json!({"type": "commandExecution", "id": call_id, "command": name, "cwd": cwd, "exitCode": null}));
                item["status"] = json!(if success { "completed" } else { "failed" });
                item["aggregatedOutput"] = json!(output);
                params["item"] = item;
                "item/completed"
            }
            EventMsg::TurnCompleted { .. } => {
                *active = false;
                params["turn"] =
                    json!({"id": turn_id, "items": [], "status": "completed", "error": null});
                "turn/completed"
            }
            EventMsg::Error(_) => {
                // 不把底层 HTTP 错误直接发往前端，避免远端错误正文包含凭据。
                *active = false;
                params["turn"] = json!({"id": turn_id, "items": [], "status": "failed", "error": {"message": "模型或工具执行失败，请检查服务配置与网络"}});
                "turn/completed"
            }
            EventMsg::ThreadSettingsApplied(snapshot) => {
                // 源项目会把它映射为 thread/settings/applied 类通知；本项目只把新模型告知客户端。
                params["settings"] = json!({"model": snapshot.model});
                params.as_object_mut().map(|object| object.remove("turnId"));
                "thread/settings/applied"
            }
            EventMsg::ShutdownComplete => break,
        };
        outgoing.notification(method, params).await;
    }
}
