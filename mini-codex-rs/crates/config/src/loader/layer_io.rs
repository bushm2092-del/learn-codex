//! 对应 `codex-rs/config/src/loader/layer_io.rs`：单个配置文件的读取与解析。

use std::io;
use std::path::Path;
use toml::Value as TomlValue;

/// 读取并解析一个 TOML 配置文件。
///
/// - 文件不存在：返回 `Ok(None)`，由调用方决定是否用默认值。
/// - 解析失败：返回 `InvalidData`，并在消息中带上文件路径，便于用户定位。
/// - 其他 IO 错误：原样返回。
///
/// 源项目还支持 `strict_config`（对未知字段报错）并使用 tracing 记录日志；
/// 本项目尚未引入 tracing，因此 `log_missing_as_info` 只保留签名以对齐调用点。
pub(super) fn read_config_from_path(
    path: &Path,
    _log_missing_as_info: bool,
) -> io::Result<Option<TomlValue>> {
    match std::fs::read_to_string(path) {
        Ok(contents) => match toml::from_str::<TomlValue>(&contents) {
            Ok(value) => Ok(Some(value)),
            Err(err) => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("Failed to parse {}: {err}", path.display()),
            )),
        },
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err),
    }
}
