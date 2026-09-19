use super::load_config_layers_state;
use crate::CONFIG_TOML_FILE;
use crate::ConfigLayerEntry;
use crate::ConfigLayerSource;
use crate::ConfigLayerStack;
use pretty_assertions::assert_eq;
use std::io::ErrorKind;
use tempfile::TempDir;
use toml::Value as TomlValue;

#[test]
fn missing_user_config_loads_empty_layer() {
    let codex_home = TempDir::new().expect("temp home");

    let stack = load_config_layers_state(codex_home.path(), &[]).expect("load");

    assert_eq!(
        stack,
        ConfigLayerStack::new(vec![ConfigLayerEntry::new(
            ConfigLayerSource::User {
                file: codex_home.path().join(CONFIG_TOML_FILE),
            },
            TomlValue::Table(toml::map::Map::new()),
        )])
    );
    assert_eq!(
        stack.effective_config(),
        TomlValue::Table(toml::map::Map::new())
    );
}

#[test]
fn user_config_is_loaded_as_single_layer() {
    let codex_home = TempDir::new().expect("temp home");
    let contents = "model = \"deepseek-v4-flash\"\nmodel_provider = \"deepseek\"\n";
    std::fs::write(codex_home.path().join(CONFIG_TOML_FILE), contents).expect("write");

    let stack = load_config_layers_state(codex_home.path(), &[]).expect("load");

    let expected: TomlValue = toml::from_str(contents).unwrap();
    assert_eq!(stack.effective_config(), expected);
}

#[test]
fn cli_overrides_are_pushed_as_session_flags_layer_on_top() {
    let codex_home = TempDir::new().expect("temp home");
    let contents = "model = \"from-file\"\nmodel_provider = \"deepseek\"\n";
    std::fs::write(codex_home.path().join(CONFIG_TOML_FILE), contents).expect("write");
    let cli_overrides = vec![(
        "model".to_string(),
        TomlValue::String("from-flag".to_string()),
    )];

    let stack = load_config_layers_state(codex_home.path(), &cli_overrides).expect("load");

    assert_eq!(
        stack
            .layers_low_to_high()
            .map(|layer| layer.name.clone())
            .collect::<Vec<_>>(),
        vec![
            ConfigLayerSource::User {
                file: codex_home.path().join(CONFIG_TOML_FILE),
            },
            ConfigLayerSource::SessionFlags,
        ]
    );
    let expected: TomlValue =
        toml::from_str("model = \"from-flag\"\nmodel_provider = \"deepseek\"\n").unwrap();
    assert_eq!(stack.effective_config(), expected);
}

#[test]
fn invalid_toml_reports_path_in_error() {
    let codex_home = TempDir::new().expect("temp home");
    let path = codex_home.path().join(CONFIG_TOML_FILE);
    std::fs::write(&path, "model = ").expect("write");

    let err = load_config_layers_state(codex_home.path(), &[]).expect_err("invalid toml");

    assert_eq!(err.kind(), ErrorKind::InvalidData);
    assert!(
        err.to_string()
            .contains(&format!("Failed to parse {}", path.display()))
    );
}
