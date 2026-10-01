//! 对应 `codex-rs/core/src/config/mod.rs`：把磁盘上的 `ConfigToml` 与运行期覆盖
//! 合并成 core 使用的 `Config`。
//!
//! 边界：`mini-codex-config` 只负责“读到什么”；本模块负责“最终生效的是什么”，
//! 包括 provider 合并、默认 provider 选择和 cwd 解析。入口（cli / app-server）只消费
//! `Config`，不再各自读环境变量。

pub mod edit;

use mini_codex_config::ConfigToml;
use mini_codex_config::loader::load_config_layers_state;
use mini_codex_features::Features;
use mini_codex_model_provider_info::DEEPSEEK_PROVIDER_ID;
use mini_codex_model_provider_info::ModelProviderInfo;
use mini_codex_model_provider_info::built_in_model_providers;
use mini_codex_model_provider_info::merge_configured_model_providers;
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use toml::Value as TomlValue;

pub use mini_codex_config::CONFIG_TOML_FILE;

/// 从磁盘加载并与覆盖项合并后的应用配置。
///
/// 源项目的 `Config` 还包含 approval、sandbox、mcp、history、features 等大量字段；
/// 本项目只保留模型选择与目录相关字段。
#[derive(Debug, Clone, PartialEq)]
pub struct Config {
    /// 可选的模型选择覆盖。为 `None` 时由调用方决定默认模型。
    pub model: Option<String>,
    pub model_context_window: Option<i64>,
    pub model_auto_compact_token_limit: Option<i64>,

    /// `model_providers` 表中被选中的 provider 的键。
    pub model_provider_id: String,

    /// 向模型发请求所需的 provider 信息。
    pub model_provider: ModelProviderInfo,

    /// 会话的工作目录。业务层内所有相对路径都相对该目录解析。
    pub cwd: PathBuf,

    /// 所有 Codex 状态所在的目录（默认 `~/.mini-codex`，可用 `MINI_CODEX_HOME` 覆盖）。
    pub codex_home: PathBuf,

    /// 合并后的 provider 表（内建加用户定义）。
    pub model_providers: HashMap<String, ModelProviderInfo>,

    /// 源项目 feature registry 的当前受支持子集。
    pub features: Features,
    pub token_budget: Option<TokenBudgetConfig>,
}

/// 用户配置的可选覆盖项（例如来自 CLI 参数或 app-server 请求）。
#[derive(Default, Debug, Clone)]
pub struct ConfigOverrides {
    pub model: Option<String>,
    pub cwd: Option<PathBuf>,
    pub model_provider: Option<String>,
}

impl Config {
    /// 用 `codex_home/config.toml`、`-c` 运行期覆盖和 harness 覆盖构造 `Config`。
    ///
    /// 这是各入口的统一装配点：先定位 `codex_home`，再读 TOML 并叠加 `cli_overrides`，
    /// 最后合并 `harness_overrides`（入口在代码里直接指定的 cwd、model 等）。
    pub fn load_with_cli_overrides_and_harness_overrides(
        cli_overrides: Vec<(String, TomlValue)>,
        harness_overrides: ConfigOverrides,
    ) -> std::io::Result<Self> {
        let codex_home = find_codex_home()?;
        let cfg = load_config_as_toml_with_cli_overrides(&codex_home, cli_overrides)?;
        Self::load_from_base_config_with_overrides(cfg, harness_overrides, codex_home)
    }

    /// 把已反序列化的 `ConfigToml` 与覆盖项合并成最终配置。
    ///
    /// 优先级与源项目一致：覆盖项 > config.toml > 默认值。
    pub fn load_from_base_config_with_overrides(
        cfg: ConfigToml,
        overrides: ConfigOverrides,
        codex_home: PathBuf,
    ) -> std::io::Result<Self> {
        let ConfigOverrides {
            model,
            cwd,
            model_provider,
        } = overrides;

        let resolved_cwd = {
            use std::env;

            match cwd {
                None => env::current_dir()?,
                Some(p) if p.is_absolute() => p,
                Some(p) => {
                    // 相对路径相对当前工作目录解析。
                    let mut current = env::current_dir()?;
                    current.push(p);
                    current
                }
            }
        };

        let features = Features::from_config_toml(cfg.features.as_ref());
        let token_budget = resolve_token_budget_config(&cfg, &features)?;
        let model_providers =
            merge_configured_model_providers(built_in_model_providers(), cfg.model_providers)
                .map_err(|message| std::io::Error::new(std::io::ErrorKind::InvalidData, message))?;

        let model_provider_id = model_provider
            .or(cfg.model_provider)
            .unwrap_or_else(|| DEEPSEEK_PROVIDER_ID.to_string());
        let model_provider = model_providers
            .get(&model_provider_id)
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Model provider `{model_provider_id}` not found"),
                )
            })?
            .clone();

        let model = model.or(cfg.model);

        Ok(Self {
            model_context_window: cfg.model_context_window,
            model_auto_compact_token_limit: cfg.model_auto_compact_token_limit,
            model,
            model_provider_id,
            model_provider,
            cwd: resolved_cwd,
            codex_home,
            model_providers,
            features,
            token_budget,
        })
    }
}

/// 读取 `codex_home/config.toml`，叠加 `cli_overrides` 后反序列化为 `ConfigToml`。
/// 文件不存在时返回默认值。
pub fn load_config_as_toml_with_cli_overrides(
    codex_home: &Path,
    cli_overrides: Vec<(String, TomlValue)>,
) -> std::io::Result<ConfigToml> {
    let config_layer_stack = load_config_layers_state(codex_home, &cli_overrides)?;
    let merged_toml = config_layer_stack.effective_config();
    deserialize_config_toml_with_base(merged_toml, codex_home)
}

/// 把合并后的 TOML 值转换为 `ConfigToml`。
///
/// 源项目在这里设置 `AbsolutePathBufGuard`，让配置中的相对路径相对 `config_base_dir`
/// 解析；本项目尚未移植路径类字段，因此参数只保留签名以对齐调用点。
pub fn deserialize_config_toml_with_base(
    root_value: TomlValue,
    _config_base_dir: &Path,
) -> std::io::Result<ConfigToml> {
    root_value
        .try_into()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
}

/// 返回 Codex 配置目录，可通过 `MINI_CODEX_HOME` 指定，默认 `~/.mini-codex`。
pub fn find_codex_home() -> std::io::Result<PathBuf> {
    mini_codex_utils_home_dir::find_codex_home()
}

#[cfg(test)]
#[path = "config_tests.rs"]
mod tests;

use mini_codex_features::{Feature, FeatureToml, FeaturesToml, TokenBudgetConfigToml};
const TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES: usize = 2000;
const TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES: usize = 2000;
const AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES: usize = 2000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TokenBudgetConfig {
    pub use_history_notes_extension: bool,
    pub reminder_threshold_tokens: Option<i64>,
    pub reminder_message_template: String,
    pub guidance_message: Option<String>,
    pub auto_compact_fallback_prompt: Option<String>,
    pub auto_compact_fallback_buffer_tokens: Option<i64>,
}

impl TokenBudgetConfig {
    pub(crate) fn validate(&self) -> std::io::Result<()> {
        if self
            .reminder_threshold_tokens
            .is_some_and(|tokens| tokens <= 0)
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "features.token_budget.reminder_threshold_tokens must be positive",
            ));
        }

        if self.reminder_message_template.trim().is_empty() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "features.token_budget.reminder_message_template must not be empty",
            ));
        }
        if self.reminder_message_template.len() > TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!(
                    "features.token_budget.reminder_message_template must not exceed {TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES} bytes"
                ),
            ));
        }

        if self
            .guidance_message
            .as_ref()
            .is_some_and(|message| message.len() > TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES)
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!(
                    "features.token_budget.guidance_message must not exceed {TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES} bytes"
                ),
            ));
        }

        if self
            .auto_compact_fallback_prompt
            .as_ref()
            .is_some_and(|prompt| prompt.len() > AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES)
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!(
                    "features.token_budget.auto_compact_fallback_prompt must not exceed {AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES} bytes"
                ),
            ));
        }
        if self.auto_compact_fallback_prompt.is_some()
            && self.auto_compact_fallback_buffer_tokens.is_none()
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "features.token_budget.auto_compact_fallback_buffer_tokens is required when auto_compact_fallback_prompt is set",
            ));
        }
        if self
            .auto_compact_fallback_buffer_tokens
            .is_some_and(|tokens| tokens <= 0)
        {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "features.token_budget.auto_compact_fallback_buffer_tokens must be positive",
            ));
        }

        Ok(())
    }

    pub(crate) fn fallback_buffer_tokens(&self) -> i64 {
        if self.auto_compact_fallback_prompt.is_some() {
            self.auto_compact_fallback_buffer_tokens.unwrap_or(0)
        } else {
            0
        }
    }
}

impl Default for TokenBudgetConfig {
    fn default() -> Self {
        Self {
            use_history_notes_extension: false,
            reminder_threshold_tokens: None,
            reminder_message_template: mini_codex_prompts::REMINDER_MESSAGE_TEMPLATE.to_owned(),
            guidance_message: None,
            auto_compact_fallback_prompt: None,
            auto_compact_fallback_buffer_tokens: None,
        }
    }
}

pub(crate) fn resolve_token_budget_config(
    config_toml: &ConfigToml,
    features: &Features,
) -> std::io::Result<Option<TokenBudgetConfig>> {
    if !features.enabled(Feature::TokenBudget) {
        return Ok(None);
    }

    let token_budget_config = token_budget_toml_config(config_toml.features.as_ref());
    let use_history_notes_extension = token_budget_config
        .and_then(|config| config.use_history_notes_extension)
        .unwrap_or_default();
    let reminder_threshold_tokens =
        token_budget_config.and_then(|config| config.reminder_threshold_tokens);
    let reminder_message_template = token_budget_config
        .and_then(|config| config.reminder_message_template.clone())
        .unwrap_or_else(|| mini_codex_prompts::REMINDER_MESSAGE_TEMPLATE.to_owned());
    let guidance_message = token_budget_config
        .and_then(|config| config.guidance_message.clone())
        .filter(|message| !message.trim().is_empty());
    let auto_compact_fallback_prompt = token_budget_config
        .and_then(|config| config.auto_compact_fallback_prompt.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let auto_compact_fallback_buffer_tokens =
        token_budget_config.and_then(|config| config.auto_compact_fallback_buffer_tokens);

    let token_budget = TokenBudgetConfig {
        use_history_notes_extension,
        reminder_threshold_tokens,
        reminder_message_template,
        guidance_message,
        auto_compact_fallback_prompt,
        auto_compact_fallback_buffer_tokens,
    };
    token_budget.validate()?;
    if token_budget.use_history_notes_extension {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "mini-codex 尚未移植 history/notes 扩展",
        ));
    }
    Ok(Some(token_budget))
}

fn token_budget_toml_config(features: Option<&FeaturesToml>) -> Option<&TokenBudgetConfigToml> {
    match features?.token_budget.as_ref()? {
        FeatureToml::Config(config) => Some(config),
        FeatureToml::Enabled(_) => None,
    }
}
