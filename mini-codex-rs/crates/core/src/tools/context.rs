use std::sync::Arc;
use std::time::Duration;

use mini_codex_tools::ToolName;

use crate::session::Session;

pub use mini_codex_tools::ToolOutput;
pub use mini_codex_tools::ToolPayload;

use std::num::NonZeroUsize;

/// 一次工具调用拥有的最小运行时上下文。
///
/// 源项目还包含 turn/step、取消令牌和 diff tracker；本项目尚未支持这些能力，
/// 因而删除对应字段，但保留相同类型名与已支持字段的含义。
#[derive(Clone)]
pub(crate) struct ToolInvocation {
    pub(crate) session: Arc<Session>,
    pub(crate) call_id: String,
    pub(crate) tool_name: ToolName,
    pub(crate) payload: ToolPayload,
}

/// `exec_command`/`write_stdin` 共用的模型可见输出。
///
/// 字段和响应头顺序与源项目 `ExecCommandToolOutput` 保持一致；事件、hook 与
/// history 二次截断依赖尚未移植，因此这里只保留当前内核能够观察到的部分。
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ExecCommandToolOutput {
    pub(crate) chunk_id: String,
    pub(crate) wall_time: Duration,
    pub(crate) raw_output: Vec<u8>,
    pub(crate) max_output_tokens: Option<usize>,
    pub(crate) process_id: Option<i32>,
    pub(crate) exit_code: Option<i32>,
    pub(crate) original_token_count: Option<usize>,
    pub(crate) output_omitted_bytes: Option<NonZeroUsize>,
}

impl ExecCommandToolOutput {
    fn response_header(&self) -> String {
        let mut sections = Vec::new();
        if !self.chunk_id.is_empty() {
            sections.push(format!("Chunk ID: {}", self.chunk_id));
        }
        sections.push(format!(
            "Wall time: {:.4} seconds",
            self.wall_time.as_secs_f64()
        ));
        if let Some(exit_code) = self.exit_code {
            sections.push(format!("Process exited with code {exit_code}"));
        }
        if let Some(process_id) = self.process_id {
            sections.push(format!("Process running with session ID {process_id}"));
        }
        if let Some(original_token_count) = self.original_token_count {
            sections.push(format!("Original token count: {original_token_count}"));
        }
        sections.push("Output:".to_string());
        sections.join("\n")
    }

    fn response_text(&self) -> String {
        let header = self.response_header();
        let max_tokens = self
            .max_output_tokens
            .unwrap_or(crate::unified_exec::DEFAULT_MAX_OUTPUT_TOKENS);
        let byte_budget = max_tokens
            .saturating_mul(4)
            .saturating_sub(header.len() + 1);
        let text = String::from_utf8_lossy(&self.raw_output);
        let output = truncate_middle(&text, byte_budget);
        format!("{header}\n{output}")
    }
}

impl mini_codex_tools::ToolOutput for ExecCommandToolOutput {
    fn log_output(&self) -> String {
        self.response_text()
    }

    fn success_for_logging(&self) -> bool {
        true
    }

    fn to_response_item(
        &self,
        call_id: &str,
        _payload: &ToolPayload,
    ) -> mini_codex_protocol::models::ResponseInputItem {
        mini_codex_protocol::models::ResponseInputItem::FunctionCallOutput {
            call_id: call_id.to_string(),
            output: mini_codex_protocol::models::FunctionCallOutputPayload {
                body: mini_codex_protocol::models::FunctionCallOutputBody::Text(
                    self.response_text(),
                ),
                success: Some(true),
            },
        }
    }
}

fn truncate_middle(text: &str, byte_budget: usize) -> String {
    if text.len() <= byte_budget {
        return text.to_string();
    }
    let original_token_count = text.len().div_ceil(4);
    let marker = format!("\n…{original_token_count} tokens truncated…\n");
    if byte_budget <= marker.len() {
        return marker.chars().take(byte_budget).collect();
    }
    let content_budget = byte_budget - marker.len();
    let mut head_end = content_budget / 2;
    while head_end > 0 && !text.is_char_boundary(head_end) {
        head_end -= 1;
    }
    let mut tail_start = text.len().saturating_sub(content_budget - head_end);
    while tail_start < text.len() && !text.is_char_boundary(tail_start) {
        tail_start += 1;
    }
    format!("{}{}{}", &text[..head_end], marker, &text[tail_start..])
}
