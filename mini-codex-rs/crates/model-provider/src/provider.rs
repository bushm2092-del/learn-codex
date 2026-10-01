use mini_codex_api::is_azure_responses_provider;
use mini_codex_model_provider_info::ModelProviderInfo;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoteCompactionSupport {
    Unsupported,
    V2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderCapabilities {
    pub namespace_tools: bool,
    pub remote_compaction: RemoteCompactionSupport,
}
impl Default for ProviderCapabilities {
    fn default() -> Self {
        Self {
            namespace_tools: false,
            remote_compaction: RemoteCompactionSupport::Unsupported,
        }
    }
}

// 对齐上游 ConfiguredModelProvider；不把默认 provider 绑定为能力上限。
pub struct ConfiguredModelProvider {
    info: ModelProviderInfo,
}
impl ConfiguredModelProvider {
    pub fn new(info: ModelProviderInfo) -> Self {
        Self { info }
    }
    pub fn capabilities(&self) -> ProviderCapabilities {
        let remote_compaction = if self.info.is_openai()
            || is_azure_responses_provider(&self.info.name, self.info.base_url.as_deref())
        {
            RemoteCompactionSupport::V2
        } else {
            RemoteCompactionSupport::Unsupported
        };
        ProviderCapabilities {
            remote_compaction,
            ..ProviderCapabilities::default()
        }
    }
}

#[cfg(test)]
#[path = "provider_tests.rs"]
mod tests;
