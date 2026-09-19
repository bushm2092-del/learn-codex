//! 对应 `codex-rs/core/src/config/edit.rs`：对 `config.toml` 做保留格式的局部修改。
//!
//! 使用 `toml_edit` 而不是重新序列化整个文件，这样用户手写的注释、空行和键顺序
//! 都会保留。源项目还有 MCP、skills、notice 等专用编辑项以及 symlink 处理；
//! 本项目只保留 `/model` 选择需要的通用路径编辑。

use anyhow::Context;
use std::path::Path;
use std::path::PathBuf;
use toml_edit::DocumentMut;
use toml_edit::Item as TomlItem;
use toml_edit::Table as TomlTable;
use toml_edit::value;

use crate::config::CONFIG_TOML_FILE;

/// 一次对 `config.toml` 的原子编辑。
#[derive(Clone, Debug)]
pub enum ConfigEdit {
    /// 更新默认模型；`None` 表示清除 `model` 键。
    SetModel { model: Option<String> },
    /// 设置精确点分路径上的值。
    SetPath {
        segments: Vec<String>,
        value: TomlItem,
    },
    /// 删除精确点分路径上的值。
    ClearPath { segments: Vec<String> },
}

struct ConfigDocument {
    doc: DocumentMut,
}

#[derive(Copy, Clone)]
enum TraversalMode {
    Create,
    Existing,
}

impl ConfigDocument {
    fn new(doc: DocumentMut) -> Self {
        Self { doc }
    }

    /// 应用一条编辑；返回文档是否发生变化。
    fn apply(&mut self, edit: &ConfigEdit) -> anyhow::Result<bool> {
        match edit {
            ConfigEdit::SetModel { model } => Ok(self.write_optional_value(
                &["model"],
                model.as_ref().map(|model_value| value(model_value.clone())),
            )),
            ConfigEdit::SetPath { segments, value } => Ok(self.insert(segments, value.clone())),
            ConfigEdit::ClearPath { segments } => Ok(self.remove(segments)),
        }
    }

    fn write_optional_value(&mut self, segments: &[&str], value: Option<TomlItem>) -> bool {
        match value {
            Some(item) => self.write_value(segments, item),
            None => self.clear(segments),
        }
    }

    fn write_value(&mut self, segments: &[&str], value: TomlItem) -> bool {
        let resolved = segments
            .iter()
            .map(|segment| (*segment).to_string())
            .collect::<Vec<_>>();
        self.insert(&resolved, value)
    }

    fn clear(&mut self, segments: &[&str]) -> bool {
        let resolved = segments
            .iter()
            .map(|segment| (*segment).to_string())
            .collect::<Vec<_>>();
        self.remove(&resolved)
    }

    fn insert(&mut self, segments: &[String], value: TomlItem) -> bool {
        let Some((last, parents)) = segments.split_last() else {
            return false;
        };

        let Some(parent) = self.descend(parents, TraversalMode::Create) else {
            return false;
        };

        let mut value = value;
        if let Some(existing) = parent.get(last) {
            Self::preserve_decor(existing, &mut value);
        }
        parent[last] = value;
        true
    }

    fn remove(&mut self, segments: &[String]) -> bool {
        let Some((last, parents)) = segments.split_last() else {
            return false;
        };

        let Some(parent) = self.descend(parents, TraversalMode::Existing) else {
            return false;
        };

        parent.remove(last).is_some()
    }

    fn descend(&mut self, segments: &[String], mode: TraversalMode) -> Option<&mut TomlTable> {
        let mut current = self.doc.as_table_mut();

        for segment in segments {
            match mode {
                TraversalMode::Create => {
                    if !current.contains_key(segment.as_str()) {
                        current.insert(segment.as_str(), TomlItem::Table(new_implicit_table()));
                    }

                    let item = current.get_mut(segment.as_str())?;
                    current = ensure_table_for_write(item)?;
                }
                TraversalMode::Existing => {
                    let item = current.get_mut(segment.as_str())?;
                    current = ensure_table_for_read(item)?;
                }
            }
        }

        Some(current)
    }

    /// 替换值时沿用原有的注释和空白，避免改写用户的排版。
    fn preserve_decor(existing: &TomlItem, replacement: &mut TomlItem) {
        if let (TomlItem::Value(existing_value), TomlItem::Value(replacement_value)) =
            (existing, replacement)
        {
            replacement_value
                .decor_mut()
                .clone_from(existing_value.decor());
        }
    }
}

fn new_implicit_table() -> TomlTable {
    let mut table = TomlTable::new();
    table.set_implicit(true);
    table
}

fn ensure_table_for_write(item: &mut TomlItem) -> Option<&mut TomlTable> {
    match item {
        TomlItem::Table(table) => Some(table),
        TomlItem::Value(value) => {
            if let Some(inline) = value.as_inline_table() {
                *item = TomlItem::Table(inline.clone().into_table());
                item.as_table_mut()
            } else {
                *item = TomlItem::Table(new_implicit_table());
                item.as_table_mut()
            }
        }
        TomlItem::None => {
            *item = TomlItem::Table(new_implicit_table());
            item.as_table_mut()
        }
        TomlItem::ArrayOfTables(_) => None,
    }
}

fn ensure_table_for_read(item: &mut TomlItem) -> Option<&mut TomlTable> {
    match item {
        TomlItem::Table(table) => Some(table),
        TomlItem::Value(value) => {
            let inline = value.as_inline_table()?;
            *item = TomlItem::Table(inline.clone().into_table());
            item.as_table_mut()
        }
        TomlItem::None | TomlItem::ArrayOfTables(_) => None,
    }
}

/// 对 `codex_home/config.toml` 应用一组编辑并原子写回。
pub fn apply_blocking(codex_home: &Path, edits: &[ConfigEdit]) -> anyhow::Result<()> {
    let config_path = codex_home.join(CONFIG_TOML_FILE);
    apply_blocking_to_resolved_file(&config_path, edits)
}

fn apply_blocking_to_resolved_file(
    resolved_config_file: &Path,
    edits: &[ConfigEdit],
) -> anyhow::Result<()> {
    if edits.is_empty() {
        return Ok(());
    }

    let serialized = match std::fs::read_to_string(resolved_config_file) {
        Ok(contents) => contents,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(err) => return Err(err.into()),
    };

    let doc = if serialized.is_empty() {
        DocumentMut::new()
    } else {
        serialized.parse::<DocumentMut>()?
    };

    let mut document = ConfigDocument::new(doc);
    let mut mutated = false;

    for edit in edits {
        mutated |= document.apply(edit)?;
    }

    if !mutated {
        return Ok(());
    }

    write_atomically(resolved_config_file, &document.doc.to_string()).with_context(|| {
        format!(
            "failed to persist config at {}",
            resolved_config_file.display()
        )
    })?;

    Ok(())
}

/// 先写临时文件再重命名，避免进程中断时留下半写的 config.toml。
fn write_atomically(write_path: &Path, contents: &str) -> std::io::Result<()> {
    let parent = write_path.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("path {} has no parent directory", write_path.display()),
        )
    })?;
    std::fs::create_dir_all(parent)?;
    let tmp: PathBuf = write_path.with_extension(format!("tmp-{}", std::process::id()));
    std::fs::write(&tmp, contents)?;
    std::fs::rename(&tmp, write_path)?;
    Ok(())
}

#[cfg(test)]
#[path = "edit_tests.rs"]
mod tests;
