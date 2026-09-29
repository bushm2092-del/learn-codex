use super::*;
use mini_codex_tools::ResponsesApiTool;
use pretty_assertions::assert_eq;

#[test]
fn bm25_limits_results_before_namespace_coalescing() {
    let infos = ["calendar_read", "calendar_write"]
        .into_iter()
        .map(|name| {
            ToolSearchInfo::from_tool_spec(
                ToolSpec::Function(ResponsesApiTool {
                    name: name.to_string(),
                    description: "calendar appointment".to_string(),
                    strict: false,
                    defer_loading: None,
                    output_schema: None,
                    parameters: serde_json::json!({"type":"object"}),
                }),
                None,
            )
            .unwrap()
        })
        .collect();
    let handler = ToolSearchHandler::new(infos, ToolSearchSourceListing::Omit);
    for limit in [1, 2] {
        let tools = handler.search("calendar", limit).unwrap();
        assert_eq!(tools.len(), 1);
        let LoadableToolSpec::Namespace(namespace) = &tools[0] else {
            panic!("namespace")
        };
        assert_eq!(namespace.tools.len(), limit);
    }
    assert_eq!(handler.search("zzzznonexistent", 8).unwrap(), Vec::new());
}
