export const rustSandbox = {
 zh: {
  title: "用 Rust 调用 AI", source: "main.rs · Rust", key: "你的 DeepSeek API Key", run: "编译并运行", cancel: "取消任务", reset: "恢复示例", login: "登录后运行", output: "运行输出", empty: "运行后在这里查看编译结果和模型回答。", pending: "正在提交…", retry: "重新获取结果",
  intro: "用 reqwest 发送请求，serde_json 填写参数，tokio 运行异步代码：发送消息，直接打印完整响应。",
  editorHint: "支持 Rust 高亮、编辑和撤销；Tab 可移出编辑器。代码上限 12 KiB。",
  environment: "运行环境与限制",
  hint: "预装 reqwest 0.12.28、tokio 1.48.0、serde_json 1.0.145。真实编译、执行 Rust；不允许下载或添加依赖。单任务串行，最多排队 5 个；编译 30 秒、运行 15 秒，内存上限 1 GiB，输出上限 32 KiB。",
  openSource: "本教学项目完全开源，欢迎查阅源码：",
  privacy: "API Key 仅在服务器内存中用于本次模型调用，不写入数据库、日志或浏览器存储，不注入运行代码，也不回传给前端。请求会消耗你的 DeepSeek 额度，请勿在代码中填写 Key。",
  outputPrivacy: "提交的代码和运行结果仅短暂保留，不持久化存储。服务器会返回编译信息和运行输出；页面将其作为纯文本展示，不作为 HTML 或 JavaScript 执行。开源不代表零风险，建议使用可随时撤销、额度受限的 Key。",
  relay: "沙箱不能直接联网。运行环境通过受限代理转发 HTTPS 请求，真实 Key 由服务器添加；代码读取到的环境变量只是占位值。每次运行最多调用一次 deepseek-flash，输出上限 256 tokens。",
  docs: "DeepSeek 官方文档：首次调用 API（点击查看原文）", alt: "DeepSeek 官方文档截图，展示 API 地址和模型参数", zoom: "放大查看 DeepSeek 官方文档截图", zoomHint: "放大", close: "关闭放大视图", error: "请求失败，请稍后重试。", busy: "队列已满、已有任务或提交过快，请稍后重试。", unavailable: "执行环境暂未开放或不可用，你仍可阅读和编辑代码。", missing: "任务已过期，请重新运行。",
  states: {queued:"排队中",running:"编译 / 运行中",succeeded:"执行完成",failed:"执行失败或超出限制",cancelled:"已取消",expired:"排队超时"}, position:"队列位置",
 },
 en: {
  title: "Call AI with Rust", source: "main.rs · Rust", key: "Your DeepSeek API key", run: "Compile and run", cancel: "Cancel job", reset: "Reset example", login: "Sign in to run", output: "Output", empty: "Compiler output and the model's answer will appear here.", pending: "Submitting…", retry: "Reload result",
  intro: "Send requests with reqwest, build parameters with serde_json, and run async code with tokio: send a message, then print the full response.",
  editorHint: "Rust highlighting, editing and undo. Tab leaves the editor. Source limit: 12 KiB.",
  environment: "Runtime and limits",
  hint: "Preinstalled: reqwest 0.12.28, tokio 1.48.0, serde_json 1.0.145. Real Rust compilation and execution; no additional dependencies or downloads. One active job, up to 5 waiting; 30s compilation, 15s execution, 1 GiB memory and 32 KiB output.",
  openSource: "This teaching project is fully open source. Review the code:",
  privacy: "Your API key is held in server memory for this model call only. It is not written to the database, logs or browser storage, injected into running code, or returned to the frontend. Requests use your DeepSeek credits. Do not put keys in source code.",
  outputPrivacy: "Submitted code and results are held temporarily, not persisted. The server returns compiler messages and execution output, which the page displays as plain text, never as HTML or JavaScript. Open source does not mean risk-free; use a revocable key with a limited spending allowance.",
  relay: "The sandbox has no direct network access. A restricted runtime proxy relays HTTPS requests; the server adds the real key. The environment variable in code is only a placeholder. One deepseek-flash request per run, capped at 256 output tokens.",
  docs: "DeepSeek official documentation: Your first API call (open original)", alt: "DeepSeek documentation showing the API endpoint and model parameters", zoom: "Enlarge the DeepSeek documentation screenshot", zoomHint: "Enlarge", close: "Close enlarged view", error: "Request failed. Please try again.", busy: "Queue full, job already active, or submitting too quickly. Try again later.", unavailable: "Execution is disabled or unavailable. You can still read and edit the code.", missing: "This job expired. Run it again.",
  states: {queued:"Queued",running:"Compiling / running",succeeded:"Completed",failed:"Failed or limit exceeded",cancelled:"Cancelled",expired:"Queue timeout"}, position:"Queue position",
 },
} as const;

export const rustExample = `use serde_json::{json, Value};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let request = client.post("https://api.deepseek.com/chat/completions")
        .bearer_auth(std::env::var("DEEPSEEK_API_KEY")?);

    let response: Value = request
        .json(&json!({
            "model": "deepseek-flash",
            "messages": [
                {"role": "user", "content": "你是谁"},
                {"role": "assistant", "content": "我是deepseek"},
                {"role": "user", "content": "我的上一句话是什么？"}
            ],
            "stream": false,
            "max_tokens": 256
        }))
        .send().await?
        // Report HTTP errors instead of treating them as model answers.
        .error_for_status()?
        .json().await?;

    println!("{response}");
    Ok(())
}`;
