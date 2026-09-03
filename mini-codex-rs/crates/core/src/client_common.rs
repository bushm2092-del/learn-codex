use std::future::Future;
use std::pin::Pin;

use anyhow::Result;
use futures::Stream;
use mini_codex_protocol::ToolSpec;
use serde_json::Value;

#[derive(Clone, Debug, PartialEq)]
pub struct Prompt {
    pub input: Vec<Value>,
    pub tools: Vec<ToolSpec>,
    pub instructions: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ResponseEvent {
    OutputTextDelta(String),
    OutputItemDone(Value),
    Completed,
}

pub type ResponseStream = Pin<Box<dyn Stream<Item = Result<ResponseEvent>> + Send>>;

/// Turn loop 使用的传输契约。
///
/// 实现负责把一次完整、模型可见的 prompt 转为标准化响应事件流；测试可以完全绕过 HTTP。
pub trait ModelClient: Send + Sync {
    fn stream(
        &self,
        prompt: Prompt,
    ) -> Pin<Box<dyn Future<Output = Result<ResponseStream>> + Send + '_>>;
}
