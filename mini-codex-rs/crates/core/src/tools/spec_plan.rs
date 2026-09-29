use super::handlers::tool_search::ToolSearchHandlerCache;
use super::handlers::tool_search_spec::ToolSearchSourceListing;
use super::registry::ToolRegistry;
use super::router::ToolRouter;
use mini_codex_model_provider::ProviderCapabilities;
use mini_codex_protocol::openai_models::ModelInfo;
use mini_codex_tools::{
    ResponsesApiNamespaceTool, TOOL_SEARCH_TOOL_NAME, ToolName, ToolSpec,
    default_namespace_description,
};
use std::collections::BTreeMap;

/// 对照上游 finalize_tool_router：保留普通函数与原生工具搜索分支。
pub(crate) fn finalize_tool_router(
    model_info: &ModelInfo,
    provider: &ProviderCapabilities,
    mut registry: ToolRegistry,
    tool_search_handler_cache: &ToolSearchHandlerCache,
) -> ToolRouter {
    let search_tool_name = ToolName::plain(TOOL_SEARCH_TOOL_NAME);
    if search_tool_enabled(model_info, provider)
        && registry.entries().any(|tool| {
            tool.runtime.tool_name() != search_tool_name
                && tool.exposure.is_deferred()
                && tool.runtime.search_info().is_some()
        })
    {
        let handler =
            tool_search_handler_cache.get_or_build(&registry, ToolSearchSourceListing::Omit);
        registry.register_trusted(handler);
    }
    let specs = build_model_visible_specs(&registry, provider);
    ToolRouter::from_parts(registry, specs)
}

fn build_model_visible_specs(
    registry: &ToolRegistry,
    provider: &ProviderCapabilities,
) -> Vec<ToolSpec> {
    let mut specs = Vec::new();
    for tool in registry.entries() {
        if !tool.exposure.is_direct() {
            continue;
        }
        specs.push(tool.runtime.spec());
    }
    merge_into_namespaces(specs)
        .into_iter()
        .filter(|spec| provider.namespace_tools || !matches!(spec, ToolSpec::Namespace(_)))
        .collect()
}

pub(crate) fn search_tool_enabled(model_info: &ModelInfo, provider: &ProviderCapabilities) -> bool {
    model_info.supports_search_tool && provider.namespace_tools
}

fn merge_into_namespaces(specs: Vec<ToolSpec>) -> Vec<ToolSpec> {
    let mut merged_specs = Vec::with_capacity(specs.len());
    let mut namespace_indices = BTreeMap::<String, usize>::new();
    for spec in specs {
        match spec {
            ToolSpec::Namespace(mut namespace) => {
                if let Some(index) = namespace_indices.get(&namespace.name).copied() {
                    let ToolSpec::Namespace(existing_namespace) = &mut merged_specs[index] else {
                        unreachable!("namespace index must point to a namespace spec");
                    };
                    if existing_namespace.description.trim().is_empty()
                        && !namespace.description.trim().is_empty()
                    {
                        existing_namespace.description = namespace.description;
                    }
                    existing_namespace.tools.append(&mut namespace.tools);
                    continue;
                }

                namespace_indices.insert(namespace.name.clone(), merged_specs.len());
                merged_specs.push(ToolSpec::Namespace(namespace));
            }
            spec => merged_specs.push(spec),
        }
    }

    for spec in &mut merged_specs {
        let ToolSpec::Namespace(namespace) = spec else {
            continue;
        };

        namespace.tools.sort_by(|left, right| {
            let left_name = match left {
                ResponsesApiNamespaceTool::Function(tool) => &tool.name,
            };
            let right_name = match right {
                ResponsesApiNamespaceTool::Function(tool) => &tool.name,
            };
            left_name.cmp(right_name)
        });

        if namespace.description.trim().is_empty() {
            namespace.description = default_namespace_description(&namespace.name);
        }
    }

    merged_specs
}

#[cfg(test)]
#[path = "spec_plan_tests.rs"]
mod tests;
