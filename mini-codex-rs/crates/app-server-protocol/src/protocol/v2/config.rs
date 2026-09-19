//! 对应 `codex-rs/app-server-protocol/src/protocol/v2/config.rs`：`config/read` 与
//! `config/value/write`。
//!
//! 源项目的 `config/read` 返回完整 `Config` 及每个字段的来源层；本项目只返回模型相关字段。

use serde::Deserialize;
use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfigReadParams {
    /// 源项目用它返回各配置层；本项目接受该字段但当前不返回 `layers`。
    #[serde(default)]
    pub include_layers: bool,
}

/// `config/read` 返回的配置子集。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub model: Option<String>,
    pub model_provider: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigReadResponse {
    pub config: Config,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MergeStrategy {
    /// 用新值整体替换该路径上的旧值。
    Replace,
    /// 表按键合并，标量与 Replace 相同。
    Upsert,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WriteStatus {
    Ok,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigWriteResponse {
    pub status: WriteStatus,
    /// 写入后文件内容的版本标识，供客户端做乐观并发控制。
    pub version: String,
    /// 实际写入的 config 文件路径。
    pub file_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConfigValueWriteParams {
    /// 点分路径，例如 `model` 或 `model_providers.deepseek.base_url`。
    pub key_path: String,
    pub value: JsonValue,
    pub merge_strategy: MergeStrategy,
    /// 源项目允许指定其他 config 文件；本项目只写用户 `config.toml`，因此该字段必须缺省。
    pub file_path: Option<String>,
    pub expected_version: Option<String>,
}
