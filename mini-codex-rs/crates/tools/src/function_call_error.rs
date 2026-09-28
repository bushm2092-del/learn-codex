use thiserror::Error;

/// 执行模型可见工具时的错误；可恢复错误必须回送模型，不能直接终止 turn。
#[derive(Debug, Error, PartialEq)]
pub enum FunctionCallError {
    #[error("{0}")]
    RespondToModel(String),
    #[error("Fatal error: {0}")]
    Fatal(String),
}
