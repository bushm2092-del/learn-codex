use std::path::Path;

use mini_codex_protocol::models::ContentItem;
use mini_codex_protocol::models::ResponseItem;

use crate::shell::Shell;

/// 构造源项目首次 turn 使用的单环境 `<environment_context>` 用户消息。
pub(crate) fn environment_context(cwd: &Path, shell: &Shell) -> ResponseItem {
    let cwd = escape_xml(&cwd.to_string_lossy());
    let shell = escape_xml(shell.name());
    ResponseItem::Message {
        id: None,
        role: "user".to_string(),
        content: vec![ContentItem::InputText {
            text: format!(
                "<environment_context>\n  <cwd>{cwd}</cwd>\n  <shell>{shell}</shell>\n</environment_context>"
            ),
        }],
        phase: None,
    }
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use crate::shell::ShellType;
    use pretty_assertions::assert_eq;

    #[test]
    fn renders_cwd_and_shell_for_the_model() {
        let item = environment_context(
            Path::new("/tmp/example"),
            &Shell {
                shell_type: ShellType::Bash,
                shell_path: PathBuf::from("/bin/bash"),
            },
        );
        let ResponseItem::Message { content, .. } = item else {
            panic!("environment context must be a message");
        };
        assert_eq!(
            content,
            vec![ContentItem::InputText {
                text: "<environment_context>\n  <cwd>/tmp/example</cwd>\n  <shell>bash</shell>\n</environment_context>".to_string()
            }]
        );
    }
}
