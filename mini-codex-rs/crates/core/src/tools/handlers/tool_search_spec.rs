use mini_codex_tools::{TOOL_SEARCH_TOOL_NAME, ToolSearchSourceInfo, ToolSpec};
use serde_json::json;

/// 当前没有 MCP 来源列表，只保留上游 Omit 分支。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ToolSearchSourceListing {
    Omit,
}

pub(crate) fn create_tool_search_tool(
    _searchable_sources: &[ToolSearchSourceInfo],
    default_limit: usize,
    source_listing: ToolSearchSourceListing,
) -> ToolSpec {
    let source_section = match source_listing {
        ToolSearchSourceListing::Omit => "\n\n",
    };
    let description = format!(
        "# Tool discovery\n\nSearches over deferred tool metadata with BM25 and exposes matching tools for the next model call.{source_section}Some of the tools may not have been provided to you upfront, and you should use this tool (`{TOOL_SEARCH_TOOL_NAME}`) to search for the required tools. For MCP tool discovery, always use `{TOOL_SEARCH_TOOL_NAME}` instead of `list_mcp_resources` or `list_mcp_resource_templates`."
    );
    ToolSpec::ToolSearch {
        execution: "client".to_string(),
        description,
        parameters: json!({
            "type": "object", "properties": {
                "query": {"type": "string", "description": "Search query for deferred tools."},
                "limit": {"type": "number", "description": format!("Maximum number of tools to return. Defaults to {default_limit}.")}
            }, "required": ["query"], "additionalProperties": false
        }),
    }
}
