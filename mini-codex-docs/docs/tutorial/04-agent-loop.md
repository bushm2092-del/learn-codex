# 4. 模型与工具循环

<div class="tutorial-goal"><strong>本章目标：</strong>实现 harness 最核心的“采样、执行工具、回灌结果、再次采样”。</div>

<HarnessFlow />

## 一轮不是一次模型请求

用户的一轮任务可能包含多次模型采样：

```text
采样 1：模型请求 exec_command
执行工具：得到 stdout/stderr
采样 2：模型读取工具输出并生成最终回答
```

因此 `run_turn` 外层需要一个有上限的循环：

```rust
const MAX_SAMPLING_STEPS: usize = 32;

for _step in 0..MAX_SAMPLING_STEPS {
    let prompt = Prompt { /* history + tools + instructions */ };
    let mut stream = session.model_client.stream(prompt).await?;
    // 处理流式事件和 function_call
}
```

上限是必要的安全边界，避免模型不断请求工具导致无限循环。

## 工具调用的关键路径

1. 解析 `name`、`call_id` 和 `arguments`。
2. 发出 `ToolCallStarted` 事件。
3. 通过 `ToolRouter::dispatch` 查找并执行工具。
4. 将结果记录为 `function_call_output`。
5. 发出 `ToolCallCompleted`，开始下一次模型采样。

```json
{
  "type": "function_call_output",
  "call_id": "call-1",
  "output": "命令执行结果"
}
```

`call_id` 必须保持一致，否则模型无法把输出和原始调用对应起来。

## ToolRouter 为什么独立

`run_turn` 只理解统一的工具接口，不依赖 shell 实现。以后新增文件读取、补丁编辑或 MCP 工具时，只需要注册新的 Tool 实现。

::: warning 当前安全边界
教学版 `exec_command` 直接执行 shell。生产实现必须继续加入审批策略、sandbox、超时、取消和输出大小限制。
:::
