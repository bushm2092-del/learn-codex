//! 对应 `codex-rs/config/src/fingerprint.rs`：为配置层计算版本指纹。
//!
//! `config/value/write` 用它做乐观并发控制：客户端带上读到的版本，服务端比对后再写。

use serde_json::Value as JsonValue;
use sha2::Digest;
use sha2::Sha256;
use toml::Value as TomlValue;

/// 递归排序对象键，保证相同内容得到相同序列化结果。
fn canonical_json(value: &JsonValue) -> JsonValue {
    match value {
        JsonValue::Object(map) => {
            let mut entries: Vec<_> = map.iter().collect();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            JsonValue::Object(
                entries
                    .into_iter()
                    .map(|(key, value)| (key.clone(), canonical_json(value)))
                    .collect(),
            )
        }
        JsonValue::Array(items) => JsonValue::Array(items.iter().map(canonical_json).collect()),
        other => other.clone(),
    }
}

pub fn version_for_toml(value: &TomlValue) -> String {
    let json = serde_json::to_value(value).unwrap_or(JsonValue::Null);
    let canonical = canonical_json(&json);
    let serialized = serde_json::to_vec(&canonical).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(serialized);
    let hash = hasher.finalize();
    let hex = hash
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("sha256:{hex}")
}
