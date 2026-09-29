//! 对应源项目 `codex-rs/utils/pty` 的教学子集。

pub use portable_pty::Child;
pub use portable_pty::CommandBuilder;
pub use portable_pty::PtySize;
pub use portable_pty::native_pty_system;

#[cfg(windows)]
mod windows_input;
#[cfg(windows)]
pub use windows_input::WindowsTtyInputNormalizer;
