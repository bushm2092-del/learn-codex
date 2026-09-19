use super::*;
use pretty_assertions::assert_eq;
use tempfile::TempDir;

fn read_config(codex_home: &Path) -> String {
    std::fs::read_to_string(codex_home.join(CONFIG_TOML_FILE)).expect("config.toml")
}

#[test]
fn set_model_creates_config_when_missing() {
    let codex_home = TempDir::new().expect("temp home");

    apply_blocking(
        codex_home.path(),
        &[ConfigEdit::SetModel {
            model: Some("deepseek-v4-pro".into()),
        }],
    )
    .expect("apply");

    assert_eq!(
        read_config(codex_home.path()),
        "model = \"deepseek-v4-pro\"\n"
    );
}

#[test]
fn set_model_preserves_comments_and_other_keys() {
    let codex_home = TempDir::new().expect("temp home");
    std::fs::write(
        codex_home.path().join(CONFIG_TOML_FILE),
        r#"# 我的配置
model = "deepseek-flash" # 当前模型
model_provider = "deepseek"

[model_providers.deepseek]
name = "DeepSeek"
env_key = "DEEPSEEK_API_KEY"
"#,
    )
    .expect("write");

    apply_blocking(
        codex_home.path(),
        &[ConfigEdit::SetModel {
            model: Some("deepseek-v4-pro".into()),
        }],
    )
    .expect("apply");

    assert_eq!(
        read_config(codex_home.path()),
        r#"# 我的配置
model = "deepseek-v4-pro" # 当前模型
model_provider = "deepseek"

[model_providers.deepseek]
name = "DeepSeek"
env_key = "DEEPSEEK_API_KEY"
"#
    );
}

#[test]
fn set_path_creates_nested_tables_and_clear_path_removes_them() {
    let codex_home = TempDir::new().expect("temp home");

    apply_blocking(
        codex_home.path(),
        &[ConfigEdit::SetPath {
            segments: vec![
                "model_providers".into(),
                "deepseek".into(),
                "base_url".into(),
            ],
            value: value("https://proxy.example.com"),
        }],
    )
    .expect("apply");
    assert_eq!(
        read_config(codex_home.path()),
        "[model_providers.deepseek]\nbase_url = \"https://proxy.example.com\"\n"
    );

    apply_blocking(
        codex_home.path(),
        &[ConfigEdit::ClearPath {
            segments: vec![
                "model_providers".into(),
                "deepseek".into(),
                "base_url".into(),
            ],
        }],
    )
    .expect("apply");
    assert_eq!(
        read_config(codex_home.path()),
        "[model_providers.deepseek]\n"
    );
}

#[test]
fn clearing_missing_key_does_not_touch_file() {
    let codex_home = TempDir::new().expect("temp home");

    apply_blocking(codex_home.path(), &[ConfigEdit::SetModel { model: None }]).expect("apply");

    assert!(!codex_home.path().join(CONFIG_TOML_FILE).exists());
}
