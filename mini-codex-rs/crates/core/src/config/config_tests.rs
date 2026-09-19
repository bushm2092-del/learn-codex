use super::*;
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
            model: Some("deepseek-v4-pro".into()),
            model_provider: Some("proxy".into()),
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
            model: None,
            model_provider_id: DEEPSEEK_PROVIDER_ID.into(),
            model_provider: ModelProviderInfo::create_deepseek_provider(),
            cwd: cwd.path().to_path_buf(),
            codex_home: codex_home.path().to_path_buf(),
            model_providers: built_in_model_providers(),
        }
    );
}

#[test]
fn overrides_take_precedence_over_config_toml() {
    let codex_home = TempDir::new().expect("temp home");
    let cwd = TempDir::new().expect("cwd");
    let cfg = ConfigToml {
        model: Some("from-toml".into()),
        model_provider: Some("deepseek".into()),
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
            model: Some("from-override".into()),
            model_provider_id: "proxy".into(),
            model_provider: proxy_provider(),
            cwd: cwd.path().to_path_buf(),
            codex_home: codex_home.path().to_path_buf(),
            model_providers: expected_providers,
        }
    );
}

#[test]
fn unknown_model_provider_is_not_found() {
    let codex_home = TempDir::new().expect("temp home");
    let cfg = ConfigToml {
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
