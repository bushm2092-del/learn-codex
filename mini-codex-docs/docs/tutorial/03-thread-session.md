# 3. Thread 与 Session

<div class="tutorial-goal"><strong>本章目标：</strong>用双向 channel 把调用方和后台 Agent 循环解耦。</div>

## 三个对象的职责

| 对象 | 职责 | 源码 |
| --- | --- | --- |
| `ThreadManager` | 持有共享依赖并创建线程 | `core/src/thread_manager.rs` |
| `CodexThread` | 对外提供提交操作、读取事件的方法 | `core/src/codex_thread.rs` |
| `Session` | 后台读取 Submission 并执行回合 | `core/src/session/session.rs` |

## 双向消息边界

```text
调用方 ── Submission ──▶ Session
调用方 ◀──── Event ───── Session
```

`CodexThread` 对外只暴露提交回合、关闭线程和读取事件三个异步边界。调用者提交任务后立即得到 `submission_id`，随后通过 `next_event()` 消费流式事件。

## 为什么共享依赖放在 ThreadManager

模型客户端和工具路由器通常可被多个线程复用，所以用 `Arc` 保存；工作目录和消息历史属于单个 Session，所以在线程创建时传入。

```rust
Session::spawn(
    Arc::clone(&self.model_client),
    Arc::clone(&self.tool_router),
    self.instructions.clone(),
    cwd,
)
```

## 生命周期

1. `ThreadManager::start_thread` 创建 channel 和 Session。
2. Session 启动 `submission_loop` 后台任务。
3. `CodexThread::start_turn` 写入 `UserTurn`。
4. Session 调用 `run_turn` 并持续发送 Event。
5. `Shutdown` 让循环有序退出。
