use std::pin::Pin;

use anyhow::Context;
use anyhow::Result;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use serde::Deserialize;
use serde_json::Value;

use crate::client_common::ModelClient;
use crate::client_common::Prompt;
use crate::client_common::ResponseEvent;
use crate::client_common::ResponseStream;

pub struct OpenAiResponsesClient {
    http: reqwest::Client,
    api_key: String,
    base_url: String,
    model: String,
}

impl OpenAiResponsesClient {
    pub fn new(api_key: String, model: String) -> Self {
        Self::with_base_url(api_key, model, "https://api.openai.com/v1".to_string())
    }

    pub fn with_base_url(api_key: String, model: String, base_url: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
            model,
        }
    }
}

impl ModelClient for OpenAiResponsesClient {
    fn stream(
        &self,
        prompt: Prompt,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>> {
        Box::pin(async move {
            let response = self
                .http
                .post(format!("{}/responses", self.base_url))
                .bearer_auth(&self.api_key)
                .json(&serde_json::json!({
                    "model": self.model,
                    "instructions": prompt.instructions,
                    "input": prompt.input,
                    "tools": prompt.tools,
                    "tool_choice": "auto",
                    "parallel_tool_calls": false,
                    "include": ["reasoning.encrypted_content"],
                    "store": false,
                    "stream": true
                }))
                .send()
                .await
                .context("调用 Responses API 失败")?
                .error_for_status()
                .context("Responses API 返回了错误")?;

            let stream = response
                .bytes_stream()
                .eventsource()
                .map(|event| {
                    let event = event.context("SSE 数据帧无效")?;
                    normalize_event(&event.data)
                })
                .filter_map(|result| async move {
                    match result {
                        Ok(Some(event)) => Some(Ok(event)),
                        Ok(None) => None,
                        Err(error) => Some(Err(error)),
                    }
                });
            Ok(Box::pin(stream) as ResponseStream)
        })
    }
}

#[derive(Deserialize)]
struct WireEvent {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    delta: Option<String>,
    #[serde(default)]
    item: Option<Value>,
    #[serde(default)]
    response: Option<WireResponse>,
}

#[derive(Deserialize)]
struct WireResponse {
    #[serde(default)]
    error: Option<WireError>,
    #[serde(default)]
    incomplete_details: Option<Value>,
}

#[derive(Deserialize)]
struct WireError {
    message: String,
}

fn normalize_event(data: &str) -> Result<Option<ResponseEvent>> {
    if data == "[DONE]" {
        return Ok(None);
    }
    let event: WireEvent = serde_json::from_str(data).context("Responses API 事件无效")?;
    Ok(match event.kind.as_str() {
        "response.output_text.delta" => event.delta.map(ResponseEvent::OutputTextDelta),
        "response.output_item.done" => event.item.map(ResponseEvent::OutputItemDone),
        "response.completed" => Some(ResponseEvent::Completed),
        "response.failed" => {
            let message = event
                .response
                .and_then(|response| response.error)
                .map(|error| error.message)
                .unwrap_or_else(|| "Responses API 请求失败".to_string());
            anyhow::bail!(message);
        }
        "response.incomplete" => {
            let details = event
                .response
                .and_then(|response| response.incomplete_details)
                .unwrap_or(Value::Null);
            anyhow::bail!("Responses API 请求未完成：{details}");
        }
        _ => None,
    })
}

#[cfg(test)]
#[path = "client_tests.rs"]
mod tests;
