//! 对应 `codex-rs/app-server/src/request_processors/catalog_processor.rs`：`model/list`。

use crate::message_processor::MessageProcessor;
use mini_codex_app_server_protocol::{Model, ModelListParams, ModelListResponse};
use mini_codex_protocol::openai_models::ModelPreset;
use serde_json::Value;

impl MessageProcessor {
    pub async fn model_list(&mut self, id: Value, params: Value) {
        let params: ModelListParams = match serde_json::from_value(params) {
            Ok(params) => params,
            Err(_) => {
                self.outgoing
                    .error(id, -32602, "Invalid model/list params")
                    .await;
                return;
            }
        };
        match list_models(self.manager.list_models(), params) {
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

/// 过滤隐藏模型并按游标分页；逐段对照源项目 `list_models`。
fn list_models(
    presets: Vec<ModelPreset>,
    params: ModelListParams,
) -> Result<ModelListResponse, String> {
    let ModelListParams {
        limit,
        cursor,
        include_hidden,
    } = params;
    let include_hidden = include_hidden.unwrap_or(false);
    let models: Vec<Model> = presets
        .into_iter()
        .filter(|preset| include_hidden || preset.show_in_picker)
        .map(model_from_preset)
        .collect();
    let total = models.len();

    if total == 0 {
        return Ok(ModelListResponse {
            data: Vec::new(),
            next_cursor: None,
        });
    }

    let effective_limit = limit.unwrap_or(total as u32).max(1) as usize;
    let effective_limit = effective_limit.min(total);
    let start = match cursor {
        Some(cursor) => cursor
            .parse::<usize>()
            .map_err(|_| format!("invalid cursor: {cursor}"))?,
        None => 0,
    };

    if start > total {
        return Err(format!("cursor {start} exceeds total models {total}"));
    }

    let end = start.saturating_add(effective_limit).min(total);
    let items = models[start..end].to_vec();
    let next_cursor = if end < total {
        Some(end.to_string())
    } else {
        None
    };
    Ok(ModelListResponse {
        data: items,
        next_cursor,
    })
}

fn model_from_preset(preset: ModelPreset) -> Model {
    Model {
        id: preset.id,
        model: preset.model,
        display_name: preset.display_name,
        description: preset.description,
        hidden: !preset.show_in_picker,
        is_default: preset.is_default,
    }
}
