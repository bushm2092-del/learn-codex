use super::*;
use pretty_assertions::assert_eq;
use serde_json::json;
use tempfile::TempDir;

fn read_config(codex_home: &Path) -> String {
    std::fs::read_to_string(codex_home.join(CONFIG_TOML_FILE)).unwrap_or_default()
}

#[test]
fn parse_key_path_splits_on_dots_and_honors_quotes() {
    assert_eq!(parse_key_path("model").unwrap(), vec!["model"]);
    assert_eq!(
        parse_key_path("model_providers.deepseek.base_url").unwrap(),
        vec!["model_providers", "deepseek", "base_url"]
    );
    assert_eq!(
        parse_key_path(r#"projects."/a/b".trust_level"#).unwrap(),
        vec!["projects", "/a/b", "trust_level"]
    );
    assert_eq!(
        parse_key_path("model..x").unwrap_err(),
        "keyPath segments must not be empty"
    );
    assert_eq!(
        parse_key_path("  ").unwrap_err(),
        "keyPath must not be empty"
    );
}

#[test]
fn write_value_replace_sets_model_and_bumps_version() {
    let codex_home = TempDir::new().expect("temp home");
    std::fs::write(
        codex_home.path().join(CONFIG_TOML_FILE),
        "model = \"deepseek-flash\"\nmodel_provider = \"deepseek\"\n",
    )
    .expect("write");
    let service = ConfigManagerService::new(codex_home.path().to_path_buf());
    let (_, before) = service.user_layer().expect("layer");

    let response = service
        .write_value(
            None,
            Some(before.clone()),
            "model".into(),
            json!("deepseek-v4-pro"),
            MergeStrategy::Replace,
        )
        .expect("write");

    assert_eq!(
        read_config(codex_home.path()),
        "model = \"deepseek-v4-pro\"\nmodel_provider = \"deepseek\"\n"
    );
    assert_eq!(response.status, WriteStatus::Ok);
    assert_eq!(
        response.file_path,
        codex_home
            .path()
            .join(CONFIG_TOML_FILE)
            .display()
            .to_string()
    );
    assert_ne!(response.version, before);
    assert_eq!(response.version, service.user_layer().expect("layer").1);
}

#[test]
fn write_value_rejects_stale_version_and_foreign_path() {
    let codex_home = TempDir::new().expect("temp home");
    let service = ConfigManagerService::new(codex_home.path().to_path_buf());

    let err = service
        .write_value(
            None,
            Some("sha256:stale".into()),
            "model".into(),
            json!("x"),
            MergeStrategy::Replace,
        )
        .unwrap_err();
    assert_eq!(
        err,
        "Configuration was modified since last read. Fetch latest version and retry."
    );

    let err = service
        .write_value(
            Some("/etc/other.toml".into()),
            None,
            "model".into(),
            json!("x"),
            MergeStrategy::Replace,
        )
        .unwrap_err();
    assert_eq!(err, "Only writes to the user config are allowed");
    assert_eq!(read_config(codex_home.path()), "");
}

#[test]
fn write_value_upsert_merges_tables_and_null_clears() {
    let codex_home = TempDir::new().expect("temp home");
    std::fs::write(
        codex_home.path().join(CONFIG_TOML_FILE),
        "[model_providers.deepseek]\nname = \"DeepSeek\"\n",
    )
    .expect("write");
    let service = ConfigManagerService::new(codex_home.path().to_path_buf());

    service
        .write_value(
            None,
            None,
            "model_providers.deepseek".into(),
            json!({"base_url": "https://proxy.example.com"}),
            MergeStrategy::Upsert,
        )
        .expect("upsert");
    // Upsert 重写整张表；`toml::Value` 的表按键排序，因此 base_url 排在 name 前。
    assert_eq!(
        read_config(codex_home.path()),
        "[model_providers.deepseek]\nbase_url = \"https://proxy.example.com\"\nname = \"DeepSeek\"\n"
    );

    service
        .write_value(
            None,
            None,
            "model_providers.deepseek.base_url".into(),
            JsonValue::Null,
            MergeStrategy::Replace,
        )
        .expect("clear");
    assert_eq!(
        read_config(codex_home.path()),
        "[model_providers.deepseek]\nname = \"DeepSeek\"\n"
    );
}
