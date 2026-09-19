use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadStartParams {
    pub cwd: Option<String>,
}

/// `thread/settings/update`：更新一个 thread 的会话级设置，对后续回合生效。
///
/// 源项目还允许更新 cwd、approval policy、sandbox、reasoning effort 等；本项目只保留模型。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadSettingsUpdateParams {
    pub thread_id: String,
    pub model: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadSettingsUpdateResponse {}
