use super::*;
use mini_codex_features::Feature;
use mini_codex_features::Features;
use mini_codex_features::FeaturesToml;
use mini_codex_model_provider_info::WireApi;
use pretty_assertions::assert_eq;
use std::io::ErrorKind;
use tempfile::TempDir;

fn proxy_provider() -> ModelProviderInfo {
    ModelProviderInfo {
        name: "DeepSeek via proxy".into(),
        base_url: Some("https://proxy.example.com/v1".into()),
        env_key: Some("PROXY_API_KEY".into()),
        env_key_instructions: None,
        wire_api: WireApi::Responses,
        stream_max_retries: None,
    }
}

#[test]
fn load_config_as_toml_reads_model_and_custom_provider() {
    let codex_home = TempDir::new().expect("temp home");
    std::fs::write(
        codex_home.path().join(CONFIG_TOML_FILE),
        r#"
model = "deepseek-v4-pro"
model_provider = "proxy"

[model_providers.proxy]
name = "DeepSeek via proxy"
base_url = "https://proxy.example.com/v1"
env_key = "PROXY_API_KEY"
"#,
    )
    .expect("write");

    let cfg = load_config_as_toml_with_cli_overrides(codex_home.path(), Vec::new()).expect("load");

    assert_eq!(
        cfg,
        ConfigToml {
            model_context_window: None,
            model_auto_compact_token_limit: None,
            model: Some("deepseek-v4-pro".into()),
            model_provider: Some("proxy".into()),
            features: None,
            model_providers: HashMap::from([("proxy".to_string(), proxy_provider())]),
        }
    );
}

#[test]
fn load_config_as_toml_uses_defaults_when_file_missing() {
    let codex_home = TempDir::new().expect("temp home");

    let cfg = load_config_as_toml_with_cli_overrides(codex_home.path(), Vec::new()).expect("load");

    assert_eq!(cfg, ConfigToml::default());
}

#[test]
fn defaults_to_deepseek_provider_and_resolves_cwd() {
    let codex_home = TempDir::new().expect("temp home");
    let cwd = TempDir::new().expect("cwd");

    let config = Config::load_from_base_config_with_overrides(
        ConfigToml::default(),
        ConfigOverrides {
            cwd: Some(cwd.path().to_path_buf()),
            ..Default::default()
        },
        codex_home.path().to_path_buf(),
    )
    .expect("config");

    assert_eq!(
        config,
        Config {
            model_context_window: None,
            model_auto_compact_token_limit: None,
            model: None,
            model_provider_id: DEEPSEEK_PROVIDER_ID.into(),
            model_provider: ModelProviderInfo::create_deepseek_provider(),
            cwd: cwd.path().to_path_buf(),
            codex_home: codex_home.path().to_path_buf(),
            model_providers: built_in_model_providers(),
            features: Features::default(),
            token_budget: None,
        }
    );
}

#[test]
fn overrides_take_precedence_over_config_toml() {
    let codex_home = TempDir::new().expect("temp home");
    let cwd = TempDir::new().expect("cwd");
    let cfg = ConfigToml {
        model_context_window: None,
        model_auto_compact_token_limit: None,
        model: Some("from-toml".into()),
        model_provider: Some("deepseek".into()),
        features: None,
        model_providers: HashMap::from([("proxy".to_string(), proxy_provider())]),
    };

    let config = Config::load_from_base_config_with_overrides(
        cfg,
        ConfigOverrides {
            model: Some("from-override".into()),
            cwd: Some(cwd.path().to_path_buf()),
            model_provider: Some("proxy".into()),
        },
        codex_home.path().to_path_buf(),
    )
    .expect("config");

    let mut expected_providers = built_in_model_providers();
    expected_providers.insert("proxy".to_string(), proxy_provider());
    assert_eq!(
        config,
        Config {
            model_context_window: None,
            model_auto_compact_token_limit: None,
            model: Some("from-override".into()),
            model_provider_id: "proxy".into(),
            model_provider: proxy_provider(),
            cwd: cwd.path().to_path_buf(),
            codex_home: codex_home.path().to_path_buf(),
            model_providers: expected_providers,
            features: Features::default(),
            token_budget: None,
        }
    );
}

#[test]
fn loads_unified_exec_feature_flags() {
    let codex_home = TempDir::new().expect("temp home");
    let config = Config::load_from_base_config_with_overrides(
        ConfigToml {
            model_context_window: None,
            model_auto_compact_token_limit: None,
            features: Some(FeaturesToml {
                unified_exec: Some(false),
                unified_exec_tty: Some(false),
                ..Default::default()
            }),
            ..Default::default()
        },
        ConfigOverrides::default(),
        codex_home.path().to_path_buf(),
    )
    .expect("config");
    assert!(!config.features.enabled(Feature::UnifiedExec));
    assert!(!config.features.enabled(Feature::UnifiedExecTty));
}

#[test]
fn unknown_model_provider_is_not_found() {
    let codex_home = TempDir::new().expect("temp home");
    let cfg = ConfigToml {
        model_context_window: None,
        model_auto_compact_token_limit: None,
        model_provider: Some("missing".into()),
        ..Default::default()
    };

    let err = Config::load_from_base_config_with_overrides(
        cfg,
        ConfigOverrides::default(),
        codex_home.path().to_path_buf(),
    )
    .expect_err("missing provider");

    assert_eq!(err.kind(), ErrorKind::NotFound);
    assert_eq!(err.to_string(), "Model provider `missing` not found");
}

#[test]
fn context_limits_survive_config_assembly() {
    let cfg: ConfigToml =
        toml::from_str("model_context_window = 16000\nmodel_auto_compact_token_limit = 12000\n")
            .unwrap();
    let config = Config::load_from_base_config_with_overrides(
        cfg,
        ConfigOverrides::default(),
        std::env::temp_dir(),
    )
    .unwrap();
    assert_eq!(
        (
            config.model_context_window,
            config.model_auto_compact_token_limit
        ),
        (Some(16000), Some(12000))
    );
}

#[test]
fn token_budget_accepts_boolean_and_table_and_validates_settings() {
    for raw in [
        "[features]\ntoken_budget = true",
        "[features.token_budget]\nenabled = true\nreminder_threshold_tokens = 10000\nguidance_message = '准备收尾'",
    ] {
        let cfg: ConfigToml = toml::from_str(raw).unwrap();
        let config = Config::load_from_base_config_with_overrides(
            cfg,
            ConfigOverrides::default(),
            std::env::temp_dir(),
        )
        .unwrap();
        assert!(config.features.enabled(Feature::TokenBudget));
        assert!(config.token_budget.is_some());
    }
    for settings in [
        "reminder_threshold_tokens = 0",
        "reminder_message_template = ''",
        "auto_compact_fallback_prompt = '收尾'",
        "auto_compact_fallback_buffer_tokens = -1",
        "use_history_notes_extension = true",
    ] {
        let cfg = toml::from_str(&format!(
            "[features.token_budget]\nenabled = true\n{settings}"
        ))
        .unwrap();
        assert!(
            Config::load_from_base_config_with_overrides(
                cfg,
                ConfigOverrides::default(),
                std::env::temp_dir()
            )
            .is_err()
        );
    }
    let cfg =
        toml::from_str("[features.token_budget]\nenabled = false\nreminder_threshold_tokens = 0")
            .unwrap();
    let config = Config::load_from_base_config_with_overrides(
        cfg,
        ConfigOverrides::default(),
        std::env::temp_dir(),
    )
    .unwrap();
    assert_eq!(config.token_budget, None);
}
