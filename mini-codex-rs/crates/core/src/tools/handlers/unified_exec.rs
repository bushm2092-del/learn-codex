use serde::Deserialize;

mod exec_command;

pub use exec_command::ExecCommandHandler;

#[derive(Debug, Deserialize)]
pub(crate) struct ExecCommandArgs {
    pub(crate) cmd: String,
}
