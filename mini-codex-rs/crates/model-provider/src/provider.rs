/// 服务商能力上限；当前仅移植工具搜索依赖的 namespace 字段。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderCapabilities {
    pub namespace_tools: bool,
}
