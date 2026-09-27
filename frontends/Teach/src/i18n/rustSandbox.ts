export const rustSandbox = {
 zh: {
  title: "用 Rust 发起一次请求", source: "Rust 代码（仅标准库）", key: "你的 DeepSeek API Key", run: "编译并运行", cancel: "取消任务", reset: "恢复示例", login: "登录后运行", output: "运行输出", empty: "运行后在这里查看编译结果和 HTTP 响应。", pending: "正在提交…", retry: "重新获取结果",
  hint: "真实编译、执行 Rust。单任务串行，最多排队 5 个；编译 30 秒、运行 15 秒，内存上限 1 GiB，输出上限 32 KiB。仅支持标准库，不支持下载依赖。",
  privacy: "Key 仅用于本次请求，不保存到数据库或浏览器存储，也不注入代码。请求会消耗你的 DeepSeek 额度。不要在代码中填写 Key。",
  relay: "沙箱不能直接联网。示例通过本地 HTTP 转发器调用 DeepSeek，转发器补充认证并使用 HTTPS；每次运行最多调用一次 deepseek-flash，输出上限 256 tokens。",
  docs: "DeepSeek 官方文档：首次调用 API（点击查看原文）", alt: "DeepSeek 官方文档截图，展示 API 地址和模型参数", error: "请求失败，请稍后重试。", busy: "队列已满、已有任务或提交过快，请稍后重试。", unavailable: "执行环境暂未开放或不可用，你仍可阅读和编辑代码。", missing: "任务已过期，请重新运行。",
  states: {queued:"排队中",running:"编译 / 运行中",succeeded:"执行完成",failed:"执行失败或超出限制",cancelled:"已取消",expired:"排队超时"}, position:"队列位置",
 },
 en: {
  title: "Send a request with Rust", source: "Rust code (standard library only)", key: "Your DeepSeek API key", run: "Compile and run", cancel: "Cancel job", reset: "Reset example", login: "Sign in to run", output: "Output", empty: "Compiler output and the HTTP response will appear here.", pending: "Submitting…", retry: "Reload result",
  hint: "Real Rust compilation and execution. One active job, up to 5 waiting; 30s compilation, 15s execution, 1 GiB memory and 32 KiB output. Standard library only; no dependency downloads.",
  privacy: "Your key is used for this request only, not stored in the database or browser storage, and not injected into code. Requests use your DeepSeek credits. Do not put keys in source code.",
  relay: "The sandbox has no direct network access. This example uses a local HTTP relay that adds authentication and connects to DeepSeek over HTTPS. One deepseek-flash request per run, capped at 256 output tokens.",
  docs: "DeepSeek official documentation: Your first API call (open original)", alt: "DeepSeek documentation showing the API endpoint and model parameters", error: "Request failed. Please try again.", busy: "Queue full, job already active, or submitting too quickly. Try again later.", unavailable: "Execution is disabled or unavailable. You can still read and edit the code.", missing: "This job expired. Run it again.",
  states: {queued:"Queued",running:"Compiling / running",succeeded:"Completed",failed:"Failed or limit exceeded",cancelled:"Cancelled",expired:"Queue timeout"}, position:"Queue position",
 },
} as const;

export const rustExample = `use std::io::{Read, Write};
use std::os::unix::net::UnixStream;
use std::time::Duration;

fn main() -> std::io::Result<()> {
    let body = r#"{
        "model": "deepseek-flash",
        "messages": [{"role": "user", "content": "Hello!"}],
        "stream": false,
        "max_tokens": 256
    }"#;

    // Local HTTP relay: authentication and HTTPS are handled outside the sandbox.
    let mut socket = UnixStream::connect("/relay/http.sock")?;
    socket.set_read_timeout(Some(Duration::from_secs(14)))?;
    socket.set_write_timeout(Some(Duration::from_secs(2)))?;
    write!(socket,
        "POST /chat/completions HTTP/1.1\\r\\nHost: api.deepseek.com\\r\\nContent-Type: application/json\\r\\nContent-Length: {}\\r\\nConnection: close\\r\\n\\r\\n{}",
        body.len(), body
    )?;

    // Keep the raw HTTP response visible; cap reads to this lesson's output budget.
    let mut response = String::new();
    socket.take(32768).read_to_string(&mut response)?;
    println!("{response}");
    Ok(())
}`;
