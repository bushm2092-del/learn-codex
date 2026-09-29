//! 对应源项目 `codex-rs/features` 的当前教学范围。

use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Feature {
    UnifiedExec,
    UnifiedExecTty,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeaturesToml {
    pub unified_exec: Option<bool>,
    pub unified_exec_tty: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Features {
    unified_exec: bool,
    unified_exec_tty: bool,
}

impl Default for Features {
    fn default() -> Self {
        Self {
            // 两项在源项目中均为 Stable 且 default_enabled = true。
            unified_exec: true,
            unified_exec_tty: true,
        }
    }
}

impl Features {
    pub fn from_config_toml(config: Option<&FeaturesToml>) -> Self {
        let defaults = Self::default();
        Self {
            unified_exec: config
                .and_then(|features| features.unified_exec)
                .unwrap_or(defaults.unified_exec),
            unified_exec_tty: config
                .and_then(|features| features.unified_exec_tty)
                .unwrap_or(defaults.unified_exec_tty),
        }
    }

    pub fn enabled(&self, feature: Feature) -> bool {
        match feature {
            Feature::UnifiedExec => self.unified_exec,
            Feature::UnifiedExecTty => self.unified_exec_tty,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unified_exec_features_default_to_enabled() {
        let features = Features::default();
        assert!(features.enabled(Feature::UnifiedExec));
        assert!(features.enabled(Feature::UnifiedExecTty));
    }
}
