//! 对应 `codex-rs/app-server/src/request_processors/config_processor.rs`：
//! `config/read` 与 `config/value/write` 的 RPC 层，具体读写交给 `ConfigManagerService`。

use crate::message_processor::MessageProcessor;
use mini_codex_app_server_protocol::{
    Config, ConfigReadParams, ConfigReadResponse, ConfigValueWriteParams,
};
use serde_json::Value;

impl MessageProcessor {
    pub async fn config_read(&mut self, id: Value, params: Value) {
        if serde_json::from_value::<ConfigReadParams>(params).is_err() {
            self.outgoing
                .error(id, -32602, "Invalid config/read params")
                .await;
            return;
        }
        // 返回最新磁盘状态而不是启动时的快照，这样 `/model` 写回后再读能看到新值。
        let config = match self.config_manager.user_layer() {
            Ok((user_config, _version)) => {
                let model = user_config
                    .get("model")
                    .and_then(|value| value.as_str())
                    .map(str::to_string)
                    .or_else(|| Some(self.manager.default_model()));
                Config {
                    model,
                    model_provider: self.manager.config().model_provider_id.clone(),
                }
            }
            Err(_) => {
                self.outgoing
                    .error(id, -32603, "failed to load configuration")
                    .await;
                return;
            }
        };
        self.outgoing
            .response(
                id,
                serde_json::to_value(ConfigReadResponse { config })
                    .expect("response is serializable"),
            )
            .await;
    }

    pub async fn config_value_write(&mut self, id: Value, params: Value) {
        let params: ConfigValueWriteParams = match serde_json::from_value(params) {
            Ok(params) => params,
            Err(_) => {
                self.outgoing
                    .error(id, -32602, "Invalid config/value/write params")
                    .await;
                return;
            }
        };
        match self.config_manager.write_value(
            params.file_path,
            params.expected_version,
            params.key_path,
            params.value,
            params.merge_strategy,
        ) {
            Ok(response) => {
                self.outgoing
                    .response(
                        id,
                        serde_json::to_value(response).expect("response is serializable"),
                    )
                    .await
            }
            Err(message) => self.outgoing.error(id, -32602, &message).await,
        }
    }
}
