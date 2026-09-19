# 项目组织结构

仓库采用平级的多项目布局：Rust 内核、Ink TUI 和文档站各自拥有独立的构建入口。

```text
mini-codex/
├── mini-codex-rs/          # Cargo workspace
│   ├── Cargo.toml
│   └── crates/
│       ├── protocol/       # API 数据结构、事件常量和跨层错误类型
│       ├── utils/home-dir/ # 定位 $MINI_CODEX_HOME
│       ├── arg0/           # 启动时加载 $MINI_CODEX_HOME/.env
│       ├── model-provider-info/ # ModelProviderInfo 与内建 deepseek provider
│       ├── models-manager/ # models.json 模型目录与默认模型
│       ├── config/         # config.toml 反序列化、分层加载与合并
│       ├── app-server/    # JSONL 服务与请求调度
│       ├── app-server-protocol/ # 外部客户端协议
│       ├── core/           # Config 合并、Thread、Session、Turn、工具路由
│       └── cli/            # 命令行入口
├── mini-codex-tui/         # TypeScript + React + Ink
├── mini-codex-docs/        # VitePress 项目
│   ├── package.json
│   └── docs/
│       ├── .vitepress/config.mts
│       ├── guide/
│       └── index.md
├── Makefile                 # 跨项目命令编排
├── README.md               # 仓库级入口
└── README.zh-CN.md
```

## 为什么这样拆

- Rust workspace 的依赖、测试和发布由 Cargo 管理，不被 Node 工具链干扰。
- VitePress 只负责 Markdown 文档和静态站点构建。
- 文档站在自己的目录中管理 pnpm 依赖和构建命令。
- 根目录 Makefile 只负责调用各子项目的工具链，不替代 Cargo 或 pnpm。
- 三个项目共享 Git 仓库，但可以独立运行和验证。

## 真实源码对应

| 学习概念 | mini-codex-rs 文件 |
| --- | --- |
| .env 加载 | `crates/arg0/src/lib.rs` |
| 配置目录定位 | `crates/utils/home-dir/src/lib.rs` |
| provider 定义 | `crates/model-provider-info/src/lib.rs` |
| config.toml 加载 | `crates/config/src/loader/mod.rs` |
| 最终配置合并 | `crates/core/src/config/mod.rs` |
| config.toml 局部写回 | `crates/core/src/config/edit.rs` |
| 模型目录 | `crates/models-manager/src/manager.rs` |
| 会话设置更新 | `crates/core/src/session/thread_settings.rs` |
| 线程管理 | `crates/core/src/thread_manager.rs` |
| 线程对象 | `crates/core/src/codex_thread.rs` |
| Session 循环 | `crates/core/src/session/session.rs` |
| 一轮 Turn | `crates/core/src/session/turn.rs` |
| 模型客户端 | `crates/core/src/client.rs` |
| 工具路由 | `crates/core/src/tools/router.rs` |
| 命令执行工具 | `crates/core/src/tools/handlers/exec_command.rs` |

Ink 与 app-server 的源路径对照和教学取舍见[第六章](../tutorial/06-app-server-ink)。
