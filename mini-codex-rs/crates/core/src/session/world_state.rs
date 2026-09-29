use std::path::Path;

use mini_codex_protocol::models::ResponseItem;

use crate::context::world_state::environment::environment_context;
use crate::shell::Shell;

/// 当前教学内核只有一个固定本地 environment，因此首次注入完整快照后无需生成 diff。
pub(crate) fn initial_world_state(cwd: &Path, shell: &Shell) -> Vec<ResponseItem> {
    vec![environment_context(cwd, shell)]
}
