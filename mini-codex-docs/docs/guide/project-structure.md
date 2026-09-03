# 项目组织结构

仓库采用平级的多项目布局：Rust 代码和文档站各自拥有独立的构建入口。

```text
mini-codex/
├── mini-codex-rs/          # Cargo workspace
│   ├── Cargo.toml
│   └── crates/
│       ├── protocol/       # API 数据结构和事件常量
│       ├── core/           # Thread、Session、Turn、工具路由
│       └── cli/            # 命令行入口
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
- 两个项目共享 Git 仓库，但可以独立运行和验证。

## 真实源码对应

| 学习概念 | mini-codex-rs 文件 |
| --- | --- |
| 线程管理 | `crates/core/src/thread_manager.rs` |
| 线程对象 | `crates/core/src/codex_thread.rs` |
| Session 循环 | `crates/core/src/session/session.rs` |
| 一轮 Turn | `crates/core/src/session/turn.rs` |
| 模型客户端 | `crates/core/src/client.rs` |
| 工具路由 | `crates/core/src/tools/router.rs` |
| 命令执行工具 | `crates/core/src/tools/handlers/exec_command.rs` |
