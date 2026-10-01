use mini_codex_protocol::models::{FunctionCallOutputPayload, ResponseItem};
use std::collections::HashSet;
use uuid::Uuid;

const SYNTHETIC_OUTPUT_ID_NAMESPACE: Uuid = Uuid::from_u128(0x90d38d3e_6a5b_4d52_bfe2_2f1e634bfac4);

// 上游 normalize.rs 的文本 function/tool_search 子集；先扫描输出，再逆序补齐。
pub(crate) fn ensure_call_outputs_present(items: &mut Vec<ResponseItem>) {
    let mut function_output_ids = HashSet::new();
    let mut tool_search_output_ids = HashSet::new();
    for item in items.iter() {
        match item {
            ResponseItem::FunctionCallOutput {
                call_id: Some(call_id),
                ..
            } => {
                function_output_ids.insert(call_id.as_str());
            }
            ResponseItem::ToolSearchOutput {
                call_id: Some(call_id),
                ..
            } => {
                tool_search_output_ids.insert(call_id.as_str());
            }
            _ => {}
        }
    }
    let mut missing_outputs_to_insert = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        match item {
            ResponseItem::FunctionCall { id, call_id, .. }
                if !function_output_ids.contains(call_id.as_str()) =>
            {
                missing_outputs_to_insert.push((
                    idx,
                    ResponseItem::FunctionCallOutput {
                        id: synthetic_output_id("fco", id.as_deref()),
                        call_id: Some(call_id.clone()),
                        name: None,
                        namespace: None,
                        output: FunctionCallOutputPayload::from_text("aborted".to_string()),
                    },
                ));
            }
            ResponseItem::ToolSearchCall {
                id,
                call_id: Some(call_id),
                ..
            } if !tool_search_output_ids.contains(call_id.as_str()) => {
                missing_outputs_to_insert.push((
                    idx,
                    ResponseItem::ToolSearchOutput {
                        id: synthetic_output_id("tso", id.as_deref()),
                        call_id: Some(call_id.clone()),
                        status: "completed".to_string(),
                        execution: "client".to_string(),
                        tools: Vec::new(),
                    },
                ));
            }
            _ => {}
        }
    }
    drop((function_output_ids, tool_search_output_ids));
    for (idx, output_item) in missing_outputs_to_insert.into_iter().rev() {
        items.insert(idx + 1, output_item);
    }
}

fn synthetic_output_id(prefix: &str, item_id: Option<&str>) -> Option<String> {
    let source_id = item_id.filter(|id| !id.is_empty())?;
    let name = format!("{prefix}:{source_id}");
    Some(format!(
        "{prefix}_{}",
        Uuid::new_v5(&SYNTHETIC_OUTPUT_ID_NAMESPACE, name.as_bytes())
    ))
}

pub(crate) fn remove_orphan_outputs(items: &mut Vec<ResponseItem>) {
    let mut function_call_ids = HashSet::new();
    let mut tool_search_call_ids = HashSet::new();
    for item in items.iter() {
        match item {
            ResponseItem::FunctionCall { call_id, .. } => {
                function_call_ids.insert(call_id.as_str());
            }
            ResponseItem::ToolSearchCall {
                call_id: Some(call_id),
                ..
            } => {
                tool_search_call_ids.insert(call_id.as_str());
            }
            _ => {}
        }
    }
    let mut orphan_positions = Vec::new();
    for (position, item) in items.iter().enumerate() {
        match item {
            ResponseItem::FunctionCallOutput {
                call_id: Some(call_id),
                ..
            } if !function_call_ids.contains(call_id.as_str()) => orphan_positions.push(position),
            ResponseItem::ToolSearchOutput {
                call_id: Some(call_id),
                execution,
                ..
            } if execution != "server" && !tool_search_call_ids.contains(call_id.as_str()) => {
                orphan_positions.push(position)
            }
            _ => {}
        }
    }
    if !orphan_positions.is_empty() {
        let mut orphan_positions = orphan_positions.into_iter().peekable();
        let mut position = 0;
        items.retain(|_| {
            let retain = orphan_positions.peek() != Some(&position);
            if !retain {
                orphan_positions.next();
            }
            position += 1;
            retain
        });
    }
}
