//! 精简的客户端协议；与 core 内部的 Op/Event 分开。
mod protocol;
mod rpc;
pub use protocol::*;
pub use rpc::*;
