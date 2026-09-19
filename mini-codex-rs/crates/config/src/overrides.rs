//! 对应 `codex-rs/config/src/overrides.rs`：把 `-c key.path=value` 形式的运行期覆盖
//! 组装成一层 TOML。
//!
//! 源项目在这里还对 `features.*` 的 bool/table 互转做特殊处理；本项目未移植 features。

use toml::Value as TomlValue;

pub(crate) fn default_empty_table() -> TomlValue {
    TomlValue::Table(Default::default())
}

pub fn build_cli_overrides_layer(cli_overrides: &[(String, TomlValue)]) -> TomlValue {
    let mut root = default_empty_table();
    for (path, value) in cli_overrides {
        apply_toml_override(&mut root, path, value.clone());
    }
    root
}

/// 把一个点分路径的覆盖写入 TOML 值；中间层缺失时创建表，非表时整体替换。
fn apply_toml_override(root: &mut TomlValue, path: &str, value: TomlValue) {
    use toml::value::Table;

    let mut current = root;
    let mut segments_iter = path.split('.').peekable();

    while let Some(segment) = segments_iter.next() {
        let is_last = segments_iter.peek().is_none();

        if is_last {
            match current {
                TomlValue::Table(table) => {
                    table.insert(segment.to_string(), value);
                }
                _ => {
                    let mut table = Table::new();
                    table.insert(segment.to_string(), value);
                    *current = TomlValue::Table(table);
                }
            }
            return;
        }

        match current {
            TomlValue::Table(table) => {
                current = table
                    .entry(segment.to_string())
                    .or_insert_with(|| TomlValue::Table(Table::new()));
            }
            _ => {
                *current = TomlValue::Table(Table::new());
                if let TomlValue::Table(tbl) = current {
                    current = tbl
                        .entry(segment.to_string())
                        .or_insert_with(|| TomlValue::Table(Table::new()));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::build_cli_overrides_layer;
    use pretty_assertions::assert_eq;
    use toml::Value as TomlValue;

    #[test]
    fn nested_paths_create_intermediate_tables() {
        let layer = build_cli_overrides_layer(&[
            ("model".to_string(), TomlValue::String("m".into())),
            (
                "model_providers.deepseek.base_url".to_string(),
                TomlValue::String("https://api.deepseek.com".into()),
            ),
        ]);

        let expected: TomlValue = toml::from_str(
            r#"
model = "m"

[model_providers.deepseek]
base_url = "https://api.deepseek.com"
"#,
        )
        .unwrap();
        assert_eq!(layer, expected);
    }
}
