use crate::config_manager_service::ConfigManagerService;
use crate::outgoing_message::OutgoingMessage;
use mini_codex_app_server_protocol::{InitializeParams, JSONRPCRequest};
use mini_codex_core::{CodexThread, ThreadManager};
use serde_json::{Value, json};
use std::{collections::HashMap, sync::Arc};
use tokio::{sync::Mutex, task::JoinHandle};

pub(crate) struct ThreadState {
    pub thread: Arc<CodexThread>,
    pub busy: Arc<Mutex<bool>>,
    pub listener: JoinHandle<()>,
}

pub(crate) struct MessageProcessor {
    pub manager: ThreadManager,
    pub config_manager: ConfigManagerService,
    pub outgoing: OutgoingMessage,
    pub threads: HashMap<String, ThreadState>,
    initialized: bool,
    ready: bool,
    pub next_thread: u64,
}
impl MessageProcessor {
    pub fn new(manager: ThreadManager, outgoing: OutgoingMessage) -> Self {
        let config_manager = ConfigManagerService::new(manager.config().codex_home.clone());
        Self {
            manager,
            config_manager,
            outgoing,
            threads: HashMap::new(),
            initialized: false,
            ready: false,
            next_thread: 1,
        }
    }
    pub async fn process(&mut self, line: &str) {
        let value: Value = match serde_json::from_str(line) {
            Ok(value) => value,
            Err(_) => {
                self.outgoing
                    .error(Value::Null, -32700, "Parse error")
                    .await;
                return;
            }
        };
        if value.get("id").is_none()
            && value.get("method").and_then(Value::as_str) == Some("initialized")
        {
            if self.initialized {
                self.ready = true;
            }
            return;
        }
        let request: JSONRPCRequest = match serde_json::from_value(value) {
            Ok(request) => request,
            Err(_) => {
                self.outgoing
                    .error(Value::Null, -32600, "Invalid request")
                    .await;
                return;
            }
        };
        let id = serde_json::to_value(&request.id).expect("request id is serializable");
        if request.method == "initialize" {
            if self.initialized {
                self.outgoing.error(id, -32600, "Already initialized").await;
            } else if serde_json::from_value::<InitializeParams>(request.params).is_err() {
                self.outgoing
                    .error(id, -32602, "Invalid initialize params")
                    .await;
            } else {
                self.initialized = true;
                self.outgoing.response(id, json!({"userAgent": "mini-codex-app-server/0.1.0", "platformOs": std::env::consts::OS})).await;
            }
            return;
        }
        if !self.ready {
            self.outgoing.error(id, -32600, "Not initialized").await;
            return;
        }
        match request.method.as_str() {
            "thread/start" => self.thread_start(id, request.params).await,
            "thread/settings/update" => self.thread_settings_update(id, request.params).await,
            "turn/start" => self.turn_start(id, request.params).await,
            "model/list" => self.model_list(id, request.params).await,
            "config/read" => self.config_read(id, request.params).await,
            "config/value/write" => self.config_value_write(id, request.params).await,
            _ => self.outgoing.error(id, -32601, "Method not found").await,
        }
    }
    pub async fn shutdown(self) {
        for state in self.threads.values() {
            let _ = state.thread.shutdown().await;
        }
        for (_, state) in self.threads {
            let _ = state.listener.await;
        }
    }
}
