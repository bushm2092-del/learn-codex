use super::turn_processor::forward_events;
use crate::message_processor::{MessageProcessor, ThreadState};
use mini_codex_app_server_protocol::ThreadStartParams;
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::Mutex;

impl MessageProcessor {
    pub async fn thread_start(&mut self, id: Value, params: Value) {
        let params: ThreadStartParams = match serde_json::from_value(params) {
            Ok(params) => params,
            Err(_) => {
                self.outgoing
                    .error(id, -32602, "Invalid thread/start params")
                    .await;
                return;
            }
        };
        let cwd = params
            .cwd
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let cwd = match std::fs::canonicalize(cwd) {
            Ok(cwd) if cwd.is_dir() => cwd,
            _ => {
                self.outgoing
                    .error(id, -32602, "cwd must be an existing directory")
                    .await;
                return;
            }
        };
        let thread_id = format!("thread-{}", self.next_thread);
        self.next_thread += 1;
        let thread = self.manager.start_thread(cwd.clone());
        let busy = Arc::new(Mutex::new(false));
        let listener = tokio::spawn(forward_events(
            thread.clone(),
            thread_id.clone(),
            cwd.clone(),
            busy.clone(),
            self.outgoing.clone(),
        ));
        self.threads.insert(
            thread_id.clone(),
            ThreadState {
                thread,
                busy,
                listener,
            },
        );
        let result =
            json!({"thread": {"id": thread_id, "cwd": cwd, "turns": [], "ephemeral": true}});
        self.outgoing.response(id, result.clone()).await;
        self.outgoing.notification("thread/started", result).await;
    }
}
