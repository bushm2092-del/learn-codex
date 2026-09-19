# 5. CLI 与集成测试

<div class="tutorial-goal"><strong>本章目标：</strong>连接真实入口，并用可重复的假模型证明工具输出确实进入下一次请求。</div>

## CLI 只做边界工作

`crates/cli/src/main.rs` 负责读取配置，创建 `ModelClient`、`ToolRouter` 和 `ThreadManager`，提交标准输入并展示事件。它不实现工具循环，否则未来增加 TUI 或 Web 客户端时会复制核心逻辑。

中文欢迎语、工具状态和错误文案直接在 CLI 中展示；system prompt 也在 CLI 中构造，并通过
`ThreadManager::new` 传入核心。核心只处理操作和事件，不负责界面文案。

## 为什么需要脚本化模型

集成测试不能依赖网络、API Key 或模型输出的随机性。`ScriptedModelClient` 按顺序返回两组事件：

```text
第一次响应：function_call(exec_command)
第二次响应：message("完成")
```

测试随后检查第二个 Prompt：

```rust
let tool_output = prompts[1]
    .input
    .iter()
    .find(|item| item["type"] == "function_call_output")
    .expect("第二次模型请求中应包含工具输出");

assert_eq!(tool_output["call_id"], "call-1");
```

这条断言验证的是 harness 的核心不变量，而不只是某个函数的局部返回值。

## 运行验证

```bash
make rust-fmt
make rust-check
make rust-test
```

运行真实 CLI：

```bash
printf 'DEEPSEEK_API_KEY=你的密钥\n' > ~/.mini-codex/.env
cd mini-codex-rs
cargo run -p mini-codex-cli
```

provider 与 API key 的环境变量名来自内建的 `deepseek` provider（可在 `~/.mini-codex/config.toml`
覆盖），CLI 源码不再保存任何密钥或地址；配置格式与加载链见[第七节](./07-config)。DeepSeek 官方 Responses API 的 endpoint 是
`https://api.deepseek.com/responses`。

完成最小闭环后，建议依次增加：取消与中断、审批和 sandbox、rollout 持久化、上下文压缩、MCP、subagents。每次只增加一个能力，并为它补充端到端测试。
