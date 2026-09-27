# mini-codex 开发规范

## 项目定位

`mini-codex` 是从 `/Users/hfh/Desktop/github/codex` 抽取和简化的教学项目。实现时以源项目为唯一结构参照：优先保留真实 Codex 的模块边界、调用链、文件名和目录层级，只简化与当前教学目标无关的实现。

核心逻辑必须与 Codex 源码一致：session、turn、submission loop、model client、tool 调度、history 等核心路径的算法、状态流转、事件顺序和错误处理，都要对照源项目对应函数逐段移植，不得自行设计替代实现。允许的差异只有两类：删除本项目尚未支持的分支，以及在同一变更中记录到文档的显式偏离。

功能范围以 Codex 为上限：只实现 Codex 源码中已有的功能和交互。如果用户要求实现 Codex 没有的功能、没有的交互方式或与源项目不同的行为，一律不实现，先在源项目中搜索确认确实不存在，再向用户说明 Codex 中没有对应实现（给出检索过的源路径），并指出 Codex 中最接近的已有能力供用户选择。唯一例外是本规范已明确记录的偏离（如 Ink TUI）。

## 源项目与路径映射

### 教学站独立业务例外

`frontends/Teach/` 与 `backend/` 为用户明确授权的独立教学站业务模块，不要求在 Codex 源码中存在对应功能，也不受内核的包名、文件名与目录映射限制。`backend/` 使用 Go、Gin、GORM 和 PostgreSQL，提供 GitHub 登录、访问统计、章节评论、学习打卡与排行榜。教学站可以采用自己的分层结构与 Docker 部署；不得借此改变 Rust 内核的源码对照要求，也不得将网站账号或学习数据混入内核会话。

- 源项目根目录：`/Users/hfh/Desktop/github/codex`
- 源 Rust workspace：`/Users/hfh/Desktop/github/codex/codex-rs`
- 本项目 Rust workspace：`mini-codex-rs/`
- 本项目 Ink TUI：`mini-codex-tui/`，独立 TypeScript 项目，按用户要求偏离源项目 Rust TUI。
- 模型服务商：按用户要求取消源项目的官方 `openai` provider 与 auth.json 登录流程；内建 provider 只有走 `env_key` 的 `deepseek`，模型目录为打包的 DeepSeek 静态 `models.json`。
- 本项目文档站：`mini-codex-docs/`

顶层仅允许下列教学项目已有映射差异：

| 源项目 | 本项目 |
| --- | --- |
| `codex-rs/<crate>/` | `mini-codex-rs/crates/<crate>/` |
| crate 名 `codex-<name>` | crate 名 `mini-codex-<name>` |
| `codex-rs/cli/` | `mini-codex-rs/crates/cli/` |
| `codex-rs/core/` | `mini-codex-rs/crates/core/` |
| `codex-rs/protocol/` | `mini-codex-rs/crates/protocol/` |

除上述映射外，从源项目移植的目录和文件必须完全对照源项目命名。例如：

```text
codex/codex-rs/core/src/thread_manager.rs
  -> mini-codex/mini-codex-rs/crates/core/src/thread_manager.rs

codex/codex-rs/core/src/session/turn.rs
  -> mini-codex/mini-codex-rs/crates/core/src/session/turn.rs

codex/codex-rs/core/src/tools/router.rs
  -> mini-codex/mini-codex-rs/crates/core/src/tools/router.rs
```

## 文件和目录命名

1. 移植前必须先在源项目定位对应文件，不得凭印象创建目录或自行改名。
2. 同源模块的相对路径、文件名、大小写、单复数和下划线必须与源项目一致。
3. Rust 模块使用 `snake_case` 文件名，类型使用 `UpperCamelCase`，函数和变量使用 `snake_case`，常量使用 `SCREAMING_SNAKE_CASE`。
4. 不得为了“更简洁”将源项目的多文件模块合并为单文件，也不得将一个源文件随意拆成新的自定义层级。
5. 源项目已有对应模块时，不得使用语义相近的新名称代替。
6. 只有本项目独有的教学内容才可以新建命名；新建前仍要检查源项目是否已有合适位置。
7. 如果确实无法保持同名同路径，必须在同一变更中更新 `README.md` 或相关架构文档，明确记录源路径、目标路径和偏离原因。

## 移植流程

1. 在 `/Users/hfh/Desktop/github/codex` 中搜索要移植的类型、函数、模块和测试。搜索不到对应实现时停止开发，按“项目定位”中的功能范围规则向用户说明，不得自行补造。
2. 记录源文件的完整相对路径，按上述唯一映射换算目标路径。
3. 同时检查源文件的直接上游、下游、公共类型和测试，不要只复制孤立函数。
4. 保留核心调用链和职责边界；可删除本项目尚未支持的生产级分支，但不要通过重新分层来简化。
5. 核心逻辑逐段对照源函数移植：控制流、状态更新顺序、事件发出顺序、错误分支和边界处理必须与源项目一致，不得凭理解重写或“优化”算法。删除分支时保留源代码原有的位置和顺序，便于后续补回。
6. 保持对外数据形状与真实 Responses API 事件和 JSON 字段一致。
7. 为移植的可观察行为同步移植或编写测试，并更新对应教程。
8. 提交前再次对照源项目路径和源函数实现，确认没有发生命名漂移或逻辑漂移。

## Rust 开发规范

- workspace 成员统一放在 `mini-codex-rs/crates/` 下，crate 包名使用 `mini-codex-` 前缀。
- 优先保持 `protocol -> core -> cli` 的依赖方向，禁止反向依赖和循环依赖。
- `protocol` 放置跨层传递的协议类型和事件；`core` 放置 session、turn、model client 和 tool 调度；`cli` 只负责组装、输入输出和进程生命周期。
- 公开 API 尽量小，默认使用私有模块，仅显式导出跨 crate 需要的类型。
- 避免含义不清的 `bool` 或 `Option` 位置参数；优先使用 enum、newtype 或有名方法。
- `format!` 能直接捕获变量时使用 `{name}`，不要写多余的位置参数。
- `match` 尽量穷尽枚举分支，避免用 `_` 掩盖新状态。
- 不要为仅有一个调用点的少量代码新建无语义辅助函数。
- 用户可见文案和 system prompt 在 `mini-codex-rs/crates/cli/src/main.rs` 中定义；app-server 的 system prompt 在服务入口中定义；各入口通过 `ThreadManager` 将其传入核心，turn loop 不负责界面文案。Ink 展示文案留在 `mini-codex-tui/src/`。
- 注释用中文说明架构边界、生命周期和安全约束；Rust 标识符、JSON 字段、API 事件名保持英文并与源项目一致。
- 新增特性应优先放入对应模块，不要继续膨胀中央调度文件。

## 测试规范

- 改变 agent loop、tool call、context 或 session 行为时，必须增加对应测试。
- 优先测试完整对象和可观察行为，不要逐字段复制实现细节。
- 新增单元测试模块时优先放到同目录的 `*_tests.rs` 文件，并用 `#[path = "..."]` 显式引入。
- 集成测试放在对应 crate 的 `tests/` 中，并尽量对照源项目的测试文件名和场景名。
- 断言优先使用 `pretty_assertions::assert_eq`，并尽量比较完整值。
- 不要为纯静态常量写无行为价值的测试。

## 文档规范

- 教程和架构说明位于 `mini-codex-docs/docs/`，使用中文。
- 代码结构、核心调用链、配置方式或支持范围变化时，必须同步更新根 `README.md`、`mini-codex-rs/README.md` 和相关教程。
- 文档中的文件路径、类型名和代码片段必须与当前源码一致。
- 不得手工编辑 `node_modules/`、`.vitepress/cache/`、`.vitepress/dist/` 或 Rust `target/` 中的生成内容。

## 安全和配置

- 不得在源码、测试、文档或提交中写入真实 API Key、token 或其他密钥。
- 本地密钥通过环境变量或未跟踪的 `.env` 提供；日志和错误信息不得输出密钥。
- `exec_command` 当前会直接执行 shell，涉及它的变更必须显式考虑输入边界、工作目录和命令注入风险。
- 不得将尚未实现的 sandbox、approval、cancellation 或 rollout 恢复描述为已有安全保障。

## 提交前验证

Rust 变更在 `mini-codex-rs/` 中执行：

```bash
cargo fmt --all -- --check
cargo check --workspace
cargo test --workspace
```

文档变更在 `mini-codex-docs/` 中执行：

```bash
pnpm docs:build
```

同时修改 Rust 和文档时，可以在仓库根目录执行：

```bash
make test
```

验证失败时必须说明失败命令和原因，不得在未说明的情况下跳过与变更相关的检查。
