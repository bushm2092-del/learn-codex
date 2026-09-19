//! 对应 `codex-rs/app-server/src/config_manager_service.rs`：`config/*` 请求背后的读写服务。
//!
//! 源项目在写入前还要校验 requirements、profile、features 等；本项目只做
//! 路径解析、版本比对、JSON→TOML 转换，然后交给 `core::config::edit` 原子写回。

use mini_codex_app_server_protocol::{ConfigWriteResponse, MergeStrategy, WriteStatus};
use mini_codex_config::{CONFIG_TOML_FILE, loader::load_config_layers_state, version_for_toml};
use mini_codex_core::config::edit::{ConfigEdit, apply_blocking};
use serde_json::Value as JsonValue;
use std::path::{Path, PathBuf};
use toml::Value as TomlValue;

pub(crate) struct ConfigManagerService {
    codex_home: PathBuf,
}

impl ConfigManagerService {
    pub(crate) fn new(codex_home: PathBuf) -> Self {
        Self { codex_home }
    }

    fn user_config_path(&self) -> PathBuf {
        self.codex_home.join(CONFIG_TOML_FILE)
    }

    /// 读取当前 user 层并返回其版本，供客户端后续写入时比对。
    pub(crate) fn user_layer(&self) -> std::io::Result<(TomlValue, String)> {
        let layers = load_config_layers_state(&self.codex_home, &[])?;
        let user_config = layers.effective_config();
        let version = version_for_toml(&user_config);
        Ok((user_config, version))
    }

    pub(crate) fn write_value(
        &self,
        file_path: Option<String>,
        expected_version: Option<String>,
        key_path: String,
        value: JsonValue,
        strategy: MergeStrategy,
    ) -> Result<ConfigWriteResponse, String> {
        let allowed_path = self.user_config_path();
        if let Some(path) = file_path
            && Path::new(&path) != allowed_path
        {
            return Err("Only writes to the user config are allowed".to_string());
        }

        let (user_config, current_version) = self
            .user_layer()
            .map_err(|err| format!("failed to load configuration: {err}"))?;
        if let Some(expected) = expected_version.as_deref()
            && expected != current_version
        {
            return Err(
                "Configuration was modified since last read. Fetch latest version and retry."
                    .to_string(),
            );
        }

        let segments = parse_key_path(&key_path)?;
        let parsed_value = parse_value(value)?;
        let edit = match parsed_value {
            None => ConfigEdit::ClearPath { segments },
            Some(new_value) => {
                let merged = match strategy {
                    MergeStrategy::Replace => new_value,
                    MergeStrategy::Upsert => {
                        let mut base = value_at_path(&user_config, &segments)
                            .cloned()
                            .unwrap_or(TomlValue::Table(Default::default()));
                        mini_codex_config::merge_toml_values(&mut base, &new_value);
                        base
                    }
                };
                ConfigEdit::SetPath {
                    segments,
                    value: toml_value_to_item(&merged),
                }
            }
        };

        apply_blocking(&self.codex_home, &[edit])
            .map_err(|err| format!("failed to persist config.toml: {err}"))?;

        let (_, version) = self
            .user_layer()
            .map_err(|err| format!("failed to reload configuration: {err}"))?;
        Ok(ConfigWriteResponse {
            status: WriteStatus::Ok,
            version,
            file_path: allowed_path.display().to_string(),
        })
    }
}

fn value_at_path<'a>(root: &'a TomlValue, segments: &[String]) -> Option<&'a TomlValue> {
    segments
        .iter()
        .try_fold(root, |current, segment| current.as_table()?.get(segment))
}

/// 顶层表写成 `[a.b]` 标准表，嵌套在值里的表写成内联表，与源项目一致。
fn toml_value_to_item(value: &TomlValue) -> toml_edit::Item {
    match value {
        TomlValue::Table(table) => {
            let mut table_item = toml_edit::Table::new();
            table_item.set_implicit(false);
            for (key, val) in table {
                table_item.insert(key, toml_value_to_item(val));
            }
            toml_edit::Item::Table(table_item)
        }
        other => toml_edit::Item::Value(toml_value_to_value(other)),
    }
}

fn toml_value_to_value(value: &TomlValue) -> toml_edit::Value {
    match value {
        TomlValue::String(val) => toml_edit::Value::from(val.clone()),
        TomlValue::Integer(val) => toml_edit::Value::from(*val),
        TomlValue::Float(val) => toml_edit::Value::from(*val),
        TomlValue::Boolean(val) => toml_edit::Value::from(*val),
        TomlValue::Datetime(val) => toml_edit::Value::from(*val),
        TomlValue::Array(items) => {
            let mut array = toml_edit::Array::new();
            for item in items {
                array.push(toml_value_to_value(item));
            }
            toml_edit::Value::Array(array)
        }
        TomlValue::Table(table) => {
            let mut inline = toml_edit::InlineTable::new();
            for (key, val) in table {
                inline.insert(key, toml_value_to_value(val));
            }
            toml_edit::Value::InlineTable(inline)
        }
    }
}

fn parse_value(value: JsonValue) -> Result<Option<TomlValue>, String> {
    if value.is_null() {
        return Ok(None);
    }

    serde_json::from_value::<TomlValue>(value)
        .map(Some)
        .map_err(|err| format!("invalid value: {err}"))
}

/// 按 `.` 切分 keyPath，带引号的段允许包含 `.`。
fn parse_key_path(path: &str) -> Result<Vec<String>, String> {
    if path.trim().is_empty() {
        return Err("keyPath must not be empty".to_string());
    }

    let mut segments = Vec::new();
    let mut segment = String::new();
    let mut chars = path.chars();
    let mut quoted = false;

    while let Some(ch) = chars.next() {
        match ch {
            '"' if segment.is_empty() && !quoted => quoted = true,
            '"' if quoted => quoted = false,
            '\\' if quoted => {
                let Some(escaped) = chars.next() else {
                    return Err("unterminated escape in keyPath".to_string());
                };
                segment.push(escaped);
            }
            '.' if !quoted => {
                if segment.is_empty() {
                    return Err("keyPath segments must not be empty".to_string());
                }
                segments.push(std::mem::take(&mut segment));
            }
            '"' => return Err("invalid quoted keyPath segment".to_string()),
            _ => segment.push(ch),
        }
    }

    if quoted {
        return Err("unterminated quoted keyPath segment".to_string());
    }
    if segment.is_empty() {
        return Err("keyPath segments must not be empty".to_string());
    }

    segments.push(segment);
    Ok(segments)
}

#[cfg(test)]
#[path = "config_manager_service_tests.rs"]
mod tests;
