use super::ModelsManager;
use crate::bundled_models_response;
use mini_codex_protocol::openai_models::ModelInfo;
use mini_codex_protocol::openai_models::ModelPreset;
use mini_codex_protocol::openai_models::ModelVisibility;
use mini_codex_protocol::openai_models::ModelsResponse;
use pretty_assertions::assert_eq;

#[test]
fn bundled_catalog_lists_deepseek_models_with_flash_as_default() {
    let manager = ModelsManager::new(bundled_models_response().expect("bundled catalog"));

    let presets = manager.list_models();

    assert_eq!(
        presets
            .iter()
            .map(|preset| (
                preset.model.as_str(),
                preset.show_in_picker,
                preset.is_default
            ))
            .collect::<Vec<_>>(),
        vec![
            ("deepseek-flash", true, true),
            ("deepseek-v4-pro", true, false),
            ("deepseek-v4-flash", false, false),
        ]
    );
    assert_eq!(manager.get_default_model(), "deepseek-flash");
}

#[test]
fn list_models_sorts_by_priority_and_drops_unavailable_entries() {
    let manager = ModelsManager::new(ModelsResponse {
        models: vec![
            ModelInfo {
                supports_search_tool: false,
                slug: "second".into(),
                display_name: "Second".into(),
                description: None,
                visibility: ModelVisibility::List,
                supported_in_api: true,
                priority: 2,
            },
            ModelInfo {
                supports_search_tool: false,
                slug: "gone".into(),
                display_name: "Gone".into(),
                description: None,
                visibility: ModelVisibility::None,
                supported_in_api: true,
                priority: 0,
            },
            ModelInfo {
                supports_search_tool: false,
                slug: "first".into(),
                display_name: "First".into(),
                description: Some("best".into()),
                visibility: ModelVisibility::Hide,
                supported_in_api: true,
                priority: 1,
            },
        ],
    });

    assert_eq!(
        manager.list_models(),
        vec![
            ModelPreset {
                id: "first".into(),
                model: "first".into(),
                display_name: "First".into(),
                description: "best".into(),
                is_default: false,
                show_in_picker: false,
            },
            ModelPreset {
                id: "second".into(),
                model: "second".into(),
                display_name: "Second".into(),
                description: String::new(),
                is_default: true,
                show_in_picker: true,
            },
        ]
    );
    assert_eq!(manager.get_default_model(), "second");
}
