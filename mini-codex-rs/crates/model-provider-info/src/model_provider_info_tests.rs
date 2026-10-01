use super::*;
use pretty_assertions::assert_eq;

#[test]
fn test_deserialize_example_model_provider_toml() {
    let example_provider_toml = r#"
name = "Example"
base_url = "https://example.com"
env_key = "API_KEY"
        "#;
    let expected_provider = ModelProviderInfo {
        name: "Example".into(),
        base_url: Some("https://example.com".into()),
        env_key: Some("API_KEY".into()),
        env_key_instructions: None,
        wire_api: WireApi::Responses,
        stream_max_retries: None,
    };

    let provider: ModelProviderInfo = toml::from_str(example_provider_toml).unwrap();
    assert_eq!(expected_provider, provider);
}

#[test]
fn test_deserialize_chat_wire_api_shows_helpful_error() {
    let provider_toml = r#"
name = "OpenAI using Chat Completions"
base_url = "https://api.openai.com/v1"
env_key = "OPENAI_API_KEY"
wire_api = "chat"
        "#;

    let err = toml::from_str::<ModelProviderInfo>(provider_toml).unwrap_err();
    assert!(err.to_string().contains(CHAT_WIRE_API_REMOVED_ERROR));
}

#[test]
fn test_api_key_reports_missing_env_var_with_instructions() {
    let provider = ModelProviderInfo {
        name: "Example".into(),
        base_url: Some("https://example.com".into()),
        env_key: Some("MINI_CODEX_TEST_MISSING_API_KEY".into()),
        env_key_instructions: Some("Create a key at https://example.com/keys".into()),
        wire_api: WireApi::Responses,
        stream_max_retries: None,
    };

    let err = provider.api_key().unwrap_err();
    assert_eq!(
        err,
        EnvVarError {
            var: "MINI_CODEX_TEST_MISSING_API_KEY".into(),
            instructions: Some("Create a key at https://example.com/keys".into()),
        }
    );
    assert_eq!(
        err.to_string(),
        "Missing environment variable: `MINI_CODEX_TEST_MISSING_API_KEY`. Create a key at https://example.com/keys"
    );
}

#[test]
fn test_api_key_is_none_without_env_key() {
    let provider = ModelProviderInfo {
        name: "No key".into(),
        base_url: Some("http://localhost:11434/v1".into()),
        env_key: None,
        env_key_instructions: None,
        wire_api: WireApi::Responses,
        stream_max_retries: None,
    };
    assert_eq!(provider.api_key(), Ok(None));
}

#[test]
fn test_built_in_provider_is_deepseek_with_env_key() {
    let providers = built_in_model_providers();
    assert_eq!(
        providers,
        HashMap::from([(
            DEEPSEEK_PROVIDER_ID.to_string(),
            ModelProviderInfo {
                name: "DeepSeek".into(),
                base_url: Some("https://api.deepseek.com".into()),
                env_key: Some("DEEPSEEK_API_KEY".into()),
                env_key_instructions: Some(DEEPSEEK_ENV_KEY_INSTRUCTIONS.into()),
                wire_api: WireApi::Responses,
                stream_max_retries: None,
            }
        )])
    );
}

#[test]
fn test_merge_configured_model_providers_overrides_built_in() {
    let configured = ModelProviderInfo {
        name: "DeepSeek via proxy".into(),
        base_url: Some("https://proxy.example.com/v1".into()),
        env_key: Some("DEEPSEEK_API_KEY".into()),
        env_key_instructions: None,
        wire_api: WireApi::Responses,
        stream_max_retries: None,
    };
    let merged = merge_configured_model_providers(
        built_in_model_providers(),
        HashMap::from([(DEEPSEEK_PROVIDER_ID.to_string(), configured.clone())]),
    )
    .unwrap();

    assert_eq!(
        merged,
        HashMap::from([(DEEPSEEK_PROVIDER_ID.to_string(), configured)])
    );
}
