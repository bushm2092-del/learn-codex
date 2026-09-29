use super::*;
use pretty_assertions::assert_eq;
use serde_json::json;

#[test]
fn search_metadata_covers_schema_and_normalizes_selected_tools() {
    let info = ToolSearchInfo::from_tool_spec(
        ToolSpec::Function(ResponsesApiTool {
            name: "find_events".to_string(),
            description: "Find appointments".to_string(),
            strict: false,
            defer_loading: None,
            output_schema: Some(json!({"type":"string"})),
            parameters: json!({"type":"object", "description":"query input", "properties":{
                "locations":{"type":"array", "items":{"description":"city"}},
                "time":{"anyOf":[{"description":"today"},{"description":"tomorrow"}]}
            }}),
        }),
        None,
    )
    .unwrap();
    assert_eq!(
        info.entry.search_text,
        "find_events find events Find appointments query input locations city time today tomorrow"
    );
    let first = info.entry.to_loadable_spec();
    let second = info.entry.to_loadable_spec();
    assert_eq!(first, second);
    let LoadableToolSpec::Namespace(namespace) = first else {
        panic!("namespace")
    };
    let ResponsesApiNamespaceTool::Function(tool) = &namespace.tools[0];
    assert_eq!(
        (
            namespace.name.as_str(),
            namespace.description.as_str(),
            tool.defer_loading,
            &tool.output_schema
        ),
        ("functions", "", Some(true), &None)
    );
}

#[test]
fn coalesces_tools_in_the_same_namespace_in_result_order() {
    let make = |name: &str| {
        ToolSearchInfo::from_tool_spec(
            ToolSpec::Function(ResponsesApiTool {
                name: name.to_string(),
                description: String::new(),
                strict: false,
                defer_loading: None,
                output_schema: None,
                parameters: json!({}),
            }),
            None,
        )
        .unwrap()
        .entry
        .to_loadable_spec()
    };
    let combined = crate::coalesce_loadable_tool_specs([make("second"), make("first")]);
    assert_eq!(
        serde_json::to_value(combined).unwrap(),
        json!([{
            "type":"namespace","name":"functions","description":"","tools":[
                {"type":"function","name":"second","description":"","strict":false,"defer_loading":true,"parameters":{}},
                {"type":"function","name":"first","description":"","strict":false,"defer_loading":true,"parameters":{}}
            ]
        }])
    );
}
