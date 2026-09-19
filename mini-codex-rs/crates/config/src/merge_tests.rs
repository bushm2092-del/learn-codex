use super::merge_toml_values;
use pretty_assertions::assert_eq;
use toml::Value as TomlValue;

#[test]
fn merge_tables_recursively_and_replace_scalars() {
    let mut base: TomlValue = toml::from_str(
        r#"
model = "base-model"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
"#,
    )
    .unwrap();
    let overlay: TomlValue = toml::from_str(
        r#"
model = "overlay-model"

[model_providers.deepseek]
env_key = "DEEPSEEK_API_KEY"
"#,
    )
    .unwrap();

    merge_toml_values(&mut base, &overlay);

    let expected: TomlValue = toml::from_str(
        r#"
model = "overlay-model"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
"#,
    )
    .unwrap();
    assert_eq!(base, expected);
}
