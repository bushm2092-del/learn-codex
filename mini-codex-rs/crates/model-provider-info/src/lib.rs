//! 对应 `codex-rs/model-provider-info`：描述一个模型服务商如何被访问。
//!
//! 源项目还包含重试、超时、WebSocket、Amazon Bedrock、命令式 bearer token 等字段，
//! 并内建 `openai`（走 auth.json 登录）与 oss provider；本项目按用户要求取消官方
//! OpenAI provider，只内建走 `env_key` 的 DeepSeek，字段名与 TOML 键名与源项目一致。

use mini_codex_protocol::error::EnvVarError;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::fmt;

const DEEPSEEK_PROVIDER_NAME: &str = "DeepSeek";
pub const DEEPSEEK_PROVIDER_ID: &str = "deepseek";
pub const DEEPSEEK_DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
const DEEPSEEK_ENV_KEY: &str = "DEEPSEEK_API_KEY";
const DEEPSEEK_ENV_KEY_INSTRUCTIONS: &str = "在 https://platform.deepseek.com 创建 API key，写入 ~/.mini-codex/.env（DEEPSEEK_API_KEY=<你的密钥>），或在终端 export DEEPSEEK_API_KEY";

const CHAT_WIRE_API_REMOVED_ERROR: &str =
    "`wire_api = \"chat\"` is no longer supported; use `wire_api = \"responses\"`";

/// provider 使用的线协议。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WireApi {
    /// OpenAI 暴露在 `/v1/responses` 的 Responses API。
    #[default]
    Responses,
}

impl fmt::Display for WireApi {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self {
            Self::Responses => "responses",
        };
        f.write_str(value)
    }
}

impl<'de> Deserialize<'de> for WireApi {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        match value.as_str() {
            "responses" => Ok(Self::Responses),
            "chat" => Err(serde::de::Error::custom(CHAT_WIRE_API_REMOVED_ERROR)),
            _ => Err(serde::de::Error::unknown_variant(&value, &["responses"])),
        }
    }
}

/// 访问某个模型服务商所需的信息，来自 `config.toml` 的 `[model_providers.<id>]`。
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ModelProviderInfo {
    /// 友好的展示名。
    #[serde(default)]
    pub name: String,
    /// provider 的 OpenAI 兼容 API 根地址。
    pub base_url: Option<String>,
    /// 保存该 provider API key 的环境变量名。
    pub env_key: Option<String>,

    /// 可选说明，帮助用户获取并设置该环境变量。
    pub env_key_instructions: Option<String>,
    /// 该 provider 期望的线协议。
    #[serde(default)]
    pub wire_api: WireApi,
}

impl ModelProviderInfo {
    /// 若配置了 `env_key`，读取对应环境变量作为 API key；变量缺失或为空时返回错误。
    /// 未配置 `env_key` 时返回 `None`，表示该 provider 不通过环境变量取 key。
    pub fn api_key(&self) -> Result<Option<String>, EnvVarError> {
        match &self.env_key {
            Some(env_key) => {
                let api_key = std::env::var(env_key)
                    .ok()
                    .filter(|v| !v.trim().is_empty())
                    .ok_or_else(|| EnvVarError {
                        var: env_key.clone(),
                        instructions: self.env_key_instructions.clone(),
                    })?;
                Ok(Some(api_key))
            }
            None => Ok(None),
        }
    }

    /// 内建 DeepSeek provider。对应源项目 `create_oss_provider_with_base_url` 这类
    /// “第三方 provider 走 env_key” 的构造方式。
    pub fn create_deepseek_provider() -> ModelProviderInfo {
        ModelProviderInfo {
            name: DEEPSEEK_PROVIDER_NAME.into(),
            base_url: Some(DEEPSEEK_DEFAULT_BASE_URL.into()),
            env_key: Some(DEEPSEEK_ENV_KEY.into()),
            env_key_instructions: Some(DEEPSEEK_ENV_KEY_INSTRUCTIONS.into()),
            wire_api: WireApi::Responses,
        }
    }
}

/// 内建的默认 provider 列表。
pub fn built_in_model_providers() -> HashMap<String, ModelProviderInfo> {
    use ModelProviderInfo as P;

    // 用户可通过 config.toml 的 `model_providers` 添加或覆盖 provider。
    [(DEEPSEEK_PROVIDER_ID, P::create_deepseek_provider())]
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect()
}

/// 把 config.toml 中用户定义的 provider 合并进内建列表；同名时用户定义覆盖内建。
pub fn merge_configured_model_providers(
    mut model_providers: HashMap<String, ModelProviderInfo>,
    configured_model_providers: HashMap<String, ModelProviderInfo>,
) -> Result<HashMap<String, ModelProviderInfo>, String> {
    for (key, provider) in configured_model_providers {
        model_providers.insert(key, provider);
    }
    Ok(model_providers)
}

#[cfg(test)]
#[path = "model_provider_info_tests.rs"]
mod tests;
