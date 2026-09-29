use crate::{
    LoadableToolSpec, ResponsesApiNamespace, ResponsesApiNamespaceTool, ResponsesApiTool,
    ToolSearchSourceInfo, ToolSpec, default_namespace_description,
};
use mini_codex_protocol::DEFAULT_FUNCTION_NAMESPACE;
use std::sync::Arc;

#[derive(Clone, PartialEq)]
pub struct ToolSearchEntry {
    pub search_text: String,
    spec: Arc<ToolSpec>,
}

impl ToolSearchEntry {
    pub fn to_loadable_spec(&self) -> LoadableToolSpec {
        let Some(output) = normalize_search_spec(self.spec.as_ref().clone()) else {
            unreachable!("search entries contain only loadable tools");
        };
        output
    }
}

#[derive(Clone, PartialEq)]
pub struct ToolSearchInfo {
    pub entry: ToolSearchEntry,
    pub source_info: Option<ToolSearchSourceInfo>,
}

impl ToolSearchInfo {
    pub fn from_tool_spec(
        spec: ToolSpec,
        source_info: Option<ToolSearchSourceInfo>,
    ) -> Option<Self> {
        let search_text = default_tool_search_text(&spec);
        Self::from_spec(search_text, spec, source_info)
    }

    pub fn from_spec(
        search_text: String,
        spec: ToolSpec,
        source_info: Option<ToolSearchSourceInfo>,
    ) -> Option<Self> {
        let output = normalize_search_spec(spec)?;
        Some(Self {
            entry: ToolSearchEntry {
                search_text,
                spec: Arc::new(output.into()),
            },
            source_info,
        })
    }
}

fn normalize_search_spec(spec: ToolSpec) -> Option<LoadableToolSpec> {
    let mut namespace = match spec {
        ToolSpec::Function(tool) => ResponsesApiNamespace {
            name: DEFAULT_FUNCTION_NAMESPACE.to_string(),
            description: default_namespace_description(DEFAULT_FUNCTION_NAMESPACE),
            tools: vec![ResponsesApiNamespaceTool::Function(tool)],
        },
        ToolSpec::Namespace(namespace) => namespace,
        ToolSpec::ToolSearch { .. } => return None,
    };
    if namespace.description.trim().is_empty() {
        namespace.description = default_namespace_description(&namespace.name);
    }
    for tool in &mut namespace.tools {
        let ResponsesApiNamespaceTool::Function(tool) = tool;
        tool.defer_loading = Some(true);
        tool.output_schema = None;
    }
    Some(LoadableToolSpec::Namespace(namespace))
}

fn default_tool_search_text(spec: &ToolSpec) -> String {
    let mut parts = Vec::new();
    match spec {
        ToolSpec::Function(tool) => append_function_search_text(tool, &mut parts),
        ToolSpec::Namespace(namespace) => {
            push_search_part(&mut parts, namespace.name.clone());
            push_search_part(&mut parts, namespace.description.clone());
            for tool in &namespace.tools {
                let ResponsesApiNamespaceTool::Function(tool) = tool;
                append_function_search_text(tool, &mut parts);
            }
        }
        ToolSpec::ToolSearch { description, .. } => {
            push_search_part(&mut parts, description.clone())
        }
    }
    parts.join(" ")
}

fn append_function_search_text(tool: &ResponsesApiTool, parts: &mut Vec<String>) {
    push_search_part(parts, tool.name.clone());
    push_search_part(parts, tool.name.replace('_', " "));
    push_search_part(parts, tool.description.clone());
    append_schema_search_text(&tool.parameters, parts);
}

// 保留上游遍历 description → properties → items → anyOf 的顺序；本项目 schema 使用 Value。
fn append_schema_search_text(schema: &serde_json::Value, parts: &mut Vec<String>) {
    if let Some(description) = schema
        .get("description")
        .and_then(serde_json::Value::as_str)
    {
        push_search_part(parts, description.to_string());
    }
    if let Some(properties) = schema
        .get("properties")
        .and_then(serde_json::Value::as_object)
    {
        for (name, schema) in properties {
            push_search_part(parts, name.clone());
            append_schema_search_text(schema, parts);
        }
    }
    if let Some(items) = schema.get("items") {
        append_schema_search_text(items, parts);
    }
    if let Some(variants) = schema.get("anyOf").and_then(serde_json::Value::as_array) {
        for variant in variants {
            append_schema_search_text(variant, parts);
        }
    }
}

fn push_search_part(parts: &mut Vec<String>, part: String) {
    let part = part.trim();
    if !part.is_empty() {
        parts.push(part.to_string());
    }
}

#[cfg(test)]
#[path = "tool_search_tests.rs"]
mod tests;
