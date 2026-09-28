use std::pin::Pin;

use anyhow::Context;
use anyhow::Result;
use eventsource_stream::Eventsource;
use futures::StreamExt;
use mini_codex_protocol::models::ResponseItem;
use serde::Deserialize;
use serde_json::Value;

use crate::client_common::ModelClient;
use crate::client_common::Prompt;
use crate::client_common::ResponseEvent;
use crate::client_common::ResponseStream;
use crate::config::Config;

/// 基于 OpenAI Responses API 的模型客户端。
///
/// 它只负责传输层工作：把 [`Prompt`] 发送到 `/responses`，并把服务端返回的
/// SSE 事件转换成 core 层统一使用的 [`ResponseEvent`]。模型名由会话在每次
/// `stream` 时传入，不在客户端中固定。
pub struct OpenAiResponsesClient {
    /// 可复用的 HTTP 客户端；reqwest 会在内部维护连接池。
    http: reqwest::Client,
    /// 调用 API 时放入 `Authorization: Bearer ...` 的密钥。
    api_key: String,
    /// API 根地址，来自 provider 的 `base_url`。
    base_url: String,
}

impl OpenAiResponsesClient {
    /// 使用自定义 API 根地址创建客户端。
    ///
    /// 去掉末尾的 `/`，避免拼接 `/responses` 时出现双斜杠。
    pub fn with_base_url(api_key: String, base_url: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            api_key,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// 按 `Config` 中选中的 provider 创建客户端。
    ///
    /// 对应源项目 `ModelClient::new(config, auth_manager, provider, ...)` 的装配职责：
    /// API key 由 provider 的 `env_key` 环境变量提供。
    pub fn from_config(config: &Config) -> Result<Self> {
        let provider = &config.model_provider;
        let api_key = provider.api_key()?.with_context(|| {
            format!(
                "provider `{}` 未配置 env_key，无法读取 API key",
                config.model_provider_id
            )
        })?;
        let base_url = provider
            .base_url
            .clone()
            .with_context(|| format!("provider `{}` 未配置 base_url", config.model_provider_id))?;
        Ok(Self::with_base_url(api_key, base_url))
    }
}

impl ModelClient for OpenAiResponsesClient {
    /// 发送一次模型请求，并返回可以逐项消费的响应事件流。
    ///
    /// 返回值外层的 Future 表示“建立请求并取得响应”，内层的 ResponseStream
    /// 表示“随后持续读取模型生成的 SSE 事件”。
    fn stream(
        &self,
        prompt: Prompt,
        model: String,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>> {
        Box::pin(async move {
            // Responses API 的流式接口仍然使用普通 HTTP POST 发起请求，
            // 服务端通过 SSE 持续返回生成过程中的事件。
            let response = self
                .http
                .post(format!("{}/responses", self.base_url))
                // 设置 Authorization: Bearer <api_key>。
                .bearer_auth(&self.api_key)
                // 将 core 层 Prompt 转换为 Responses API 请求体。
                .json(&serde_json::json!({
                    "model": model,
                    "instructions": prompt.instructions,
                    "input": prompt.input,
                    "tools": prompt.tools,
                    "tool_choice": "auto",
                    "parallel_tool_calls": prompt.parallel_tool_calls,
                    "include": ["reasoning.encrypted_content"],
                    "store": false,
                    "stream": true
                }))
                .send()
                .await
                .context("调用 Responses API 失败")?
                .error_for_status()
                .context("Responses API 返回了错误")?;

            // bytes_stream() 提供原始响应字节流，eventsource() 再按照 SSE 协议
            // 将字节解析成一帧一帧的事件。
            let stream = response
                .bytes_stream()
                .eventsource()
                .map(|event| {
                    let event = event.context("SSE 数据帧无效")?;
                    // 将 Responses API 的原始事件统一为 core 层事件。
                    normalize_event(&event.data)
                })
                .filter_map(|result| async move {
                    match result {
                        // 能识别的业务事件继续传给 turn loop。
                        Ok(Some(event)) => Some(Ok(event)),
                        // `[DONE]` 或暂不关心的事件直接过滤掉。
                        Ok(None) => None,
                        // 解析错误和服务端失败事件保留在流中交给上层处理。
                        Err(error) => Some(Err(error)),
                    }
                });
            Ok(Box::pin(stream) as ResponseStream)
        })
    }
}

/// Responses API SSE 数据帧的最小反序列化结构。
///
/// 不同事件只会携带其中一部分字段，因此除 `type` 外均为可选字段。
#[derive(Deserialize)]
struct WireEvent {
    /// JSON 中字段名是 `type`；使用 kind 避免和 Rust 关键字混淆。
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    delta: Option<String>,
    #[serde(default)]
    item: Option<ResponseItem>,
    #[serde(default)]
    response: Option<WireResponse>,
}

/// complete、failed 和 incomplete 事件中携带的 response 信息。
#[derive(Deserialize)]
struct WireResponse {
    #[serde(default)]
    error: Option<WireError>,
    #[serde(default)]
    incomplete_details: Option<Value>,
}

/// 服务端失败事件中的错误信息。
#[derive(Deserialize)]
struct WireError {
    message: String,
}

/// 把一条 Responses API SSE 数据转换为 core 层统一事件。
///
/// - `Ok(Some(...))`：上层需要处理的事件；
/// - `Ok(None)`：流结束标记或当前实现不关心的事件；
/// - `Err(...)`：API 明确报告请求失败或事件格式非法。
fn normalize_event(data: &str) -> Result<Option<ResponseEvent>> {
    // 兼容常见的 SSE 流结束标记，它本身不需要转成业务事件。
    if data == "[DONE]" {
        return Ok(None);
    }

    // 先只解析事件分派所需的公共字段，再按 type 提取对应载荷。
    let event: WireEvent = serde_json::from_str(data).context("Responses API 事件无效")?;
    Ok(match event.kind.as_str() {
        // 文本增量：供 UI 边生成边显示。
        "response.output_text.delta" => event.delta.map(ResponseEvent::OutputTextDelta),
        // 一个完整输出项结束，例如最终完成的工具调用项。
        "response.output_item.done" => event.item.map(ResponseEvent::OutputItemDone),
        // 整个 response 正常结束。
        "response.completed" => Some(ResponseEvent::Completed),
        // 服务端明确判定请求失败，将错误消息转成 anyhow::Error。
        "response.failed" => {
            let message = event
                .response
                .and_then(|response| response.error)
                .map(|error| error.message)
                .unwrap_or_else(|| "Responses API 请求失败".to_string());
            anyhow::bail!(message);
        }
        // 请求只完成了一部分，同样按错误返回，避免上层误判为正常完成。
        "response.incomplete" => {
            let details = event
                .response
                .and_then(|response| response.incomplete_details)
                .unwrap_or(Value::Null);
            anyhow::bail!("Responses API 请求未完成：{details}");
        }
        // Responses API 还会产生 created、in_progress 等事件；当前 turn loop
        // 不需要它们，因此忽略，便于客户端兼容新增事件类型。
        _ => None,
    })
}

#[cfg(test)]
#[path = "client_tests.rs"]
mod tests;
