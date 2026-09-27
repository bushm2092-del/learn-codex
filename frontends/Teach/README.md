# Learn Codex

Dockerfile 构建静态前端，由 Nginx 提供 SPA 回退并将 /api/ 转发给后台。部署不使用 Vite preview；前后端离线包见 [部署说明](../../deploy/README.md)。

登录页支持用户名密码注册、登录与 GitHub 登录。注册成功自动登录，密码方式成功后返回允许的 `next` 目标（课程或排行榜）；GitHub 回调仍返回首页。字段与校验文案双语，密码仅随 HTTPS 请求提交，不写入浏览器存储。本地测试需要运行后台并执行最新数据库迁移。

开发前阅读 [AGENTS.md](AGENTS.md) 中的组件职责和交互约定，以及 [DESIGN.md](DESIGN.md) 中的视觉规范。

`Teach` 是品牌为 **Learn Codex** 的交互式源码教学前端。视觉采用白底、细边框、宽留白和代码实验区，当前阶段尚未写入 Harness 教学正文。

## 目录职责

```text
src/
├── animation/   # GSAP timeline 生命周期与播放控制
├── app/         # 路由与应用装配
├── course/      # 课程目录和稳定元数据
├── i18n/        # 中英文文案、语言状态与本地持久化
├── lessons/     # 每节课独立的页面、场景与动画编排
├── styles/      # 全站视觉与响应式样式
└── ui/          # 站点壳层和通用界面
```

课程讲解数据不要写入公共动画组件。新增一课时先在 `course/catalog.ts` 注册，再在 `lessons/` 下建立独立目录；每课用自己的 timeline 描述演示顺序，公共层只负责生命周期和播放控制。

界面基础交互采用无样式的 Radix UI Primitives，组件外观按 `DESIGN.md` 自定义：全站基础样式在 `src/styles/global.css`，可复用 UI 及其专属样式放在 `src/ui/`；不要引入带默认皮肤的组件主题。站点文案通过 `LocaleProvider` 提供，新增可见文案时必须同时补齐 `zh` 与 `en`。

## 本地开发

```bash
pnpm install
pnpm dev
```

提交前执行：

```bash
pnpm check
pnpm build
```

UI 职责：`DropdownMenu.tsx` 封装 Radix 菜单和主题样式，不依赖 i18n；`LanguageMenu.tsx` 绑定语言选项；`AppShell.tsx` 只组装布局。语言持久化由 `i18n/LocaleProvider.tsx` 负责。

## 章节安排

01. Agent Loop · 执行循环：输入、模型响应、工具执行与下一轮循环。
02. Responses / Chat · 模型协议：对比两种协议的消息结构、上下文和流式事件。
03. Function Calling · 工具调用：工具定义、参数生成、调用调度和结果回传。
04. Context · 上下文机制：上下文组成、历史消息、窗口限制与压缩机制。
05. Session · 会话存储机制：会话记录的持久化、加载与恢复。
06. MCP · 外部工具接入：工具发现、连接与调用，以及与 Function Calling 的关系。
07. Skills · 可复用工作流：技能发现、按需加载，以及指令和工具的配合。
08. Sandbox · 沙箱与权限：执行隔离、文件和网络权限、审批机制。
09. Plan Mode · 计划模式：需求澄清、方案制定、计划与执行的边界。
10. Goal Mode · 目标模式：持续推进目标、进度管理、预算与终止条件。
11. Subagent · 子 Agent：任务委派、上下文传递、生命周期与结果收集。
12. Agent Team · 多 Agent 协作：角色分工、并行任务、消息协调与结果整合。

第一课包含手动复制流程演示，其余章节为待编写目录。具体机制与支持范围在编写课程时对照 Codex 源码确认；目录不代表 mini-codex 已实现对应能力。旧 `/lessons/harness-overview` 地址重定向到 `/lessons/agent-loop`。

自动循环演示位于 `src/lessons/agent-loop/AutomatedLoopDemo.tsx`，`automatedTrace.ts` 保存四轮完整请求/响应与工具结果的独立快照。`CinematicLoopFilm.tsx` 在动画窗口中呈现请求、响应、工具执行和记录回传的简化 JSON，前后分镜平移缩放交接。按用户要求移除外围检查区和四节点流程图；历史在数据中完整保留，画面只展开最新结果，并明确标为简化字段示意。使用 DeepSeek Chat Completions 非思考模式的协议示意（官方参考：https://api-docs.deepseek.com/guides/tool_calls/），不是当前 Rust 客户端 `/responses` 请求的逐字复刻。工具使用项目已有 `exec_command` 职责，命令与结果均为静态模拟，不执行 shell、不访问文件、不发送 API 请求。此展示层协议差异不改变内核实现。

循环职责参照源项目 `codex-rs/core/src/session/turn.rs`，本项目对应 `mini-codex-rs/crates/core/src/session/turn.rs`；工具定义参照本项目 `tools/handlers/exec_command.rs`。本例只展示正常完成路径，不把取消、错误、审批与预算等分支伪装为已实现演示。数据测试：`node --test tests/automatedTrace.test.mjs`。

动画先展示 2.8 秒需求开场白，再进入 29.9 秒操作流程，总长 32.7 秒；开场支持中英文、重播与单步跳过。

手动复制演示由 `src/lessons/agent-loop/ManualCopyDemo.tsx` 装配 Remotion Player，`ManualCopyFilm.tsx` 根据当前帧绘制场景，`manualScene.ts` 定义可独立还原的状态。双语文案位于 `src/i18n/manualCopy.ts`。23 段不等长动作、60 fps、29.9 秒的流程覆盖拖选、复制、粘贴、输入要求、发送、生成、替换文件、保存和回传完整文本，最后复制第二次回答，将删除待办说明追加到 README 并保存。支持播放、暂停、重播、单步和拖动；语言切换保留播放位置。示意数据不连接 DeepSeek，不访问真实文件或系统剪贴板。

通用焦点容器 `src/ui/FocusPanel.tsx` 只接收当前焦点、标签、内容与样式，提供描边和文字标记；场景负责判断当前阶段、选中文本和镜头位置，通用容器不感知课程状态。

手动复制演示使用 Remotion 自带的帧插值和 spring，不包含视频导出。窗口外壳 `src/ui/DesktopWindow.tsx` 与提示 `src/ui/SceneToast.tsx` 是纯展示组件，课程负责时序。界面不显示步骤标题、阶段条、“看这里”“手动操作”或剪贴板栏；复制与保存通过短暂 toast 提示。减少动态效果时不移动鼠标、镜头或逐字显示文本。状态测试：`node --experimental-strip-types --test tests/manualScene.test.mjs`。
# 课程代码展示

## 教学站 API 接入

`src/api/` 封装带 Cookie 的请求和错误；`src/auth/` 管登录状态；`src/community/` 管章节评论、打卡、排行榜和访问统计，双语文案在 `src/i18n/community.ts`。通用样式放在 `src/ui/Community.css`。

先按 `backend/README.md` 启动后台，再运行教学站。Vite dev/preview 默认把 `/api` 代理到 `http://localhost:8080`。生产需在反向代理配置同站点 `/api`，或通过 `VITE_API_BASE_URL` 指定 API origin；该变量不得包含密钥。后台 `FRONTEND_ORIGIN` 必须与浏览器 origin 一致，跨 origin 请求仍需同站点 Cookie。

GitHub 登录前检查 `/auth/config`，未配置会留在当前页提示；成功回调后重新读取 `/me`。只有已开放的 Agent Loop 页挂载章节互动，其他章节开放后复用 `ChapterCommunity`。评论作为纯文本渲染，删除需二次确认，打卡以服务端结果为准。排行榜独立路由 `/leaderboard`，手机可通过页脚或课程末尾进入。

PV 仅在首页或已开放章节路径变化时上报一次；不因语言切换、hash 锚点或 StrictMode 重执行重复上报，也不自动重试写请求。页脚展示近 30 日聚合统计，服务不可用时隐藏数字而不是显示假 0。后台故障不影响课程阅读。

首页目录对照图使用 `src/ui/DirectoryComparison`，实际路径与双语职责标签位于 `src/course/sourceComparison.ts`；展示已核对的核心文件与真实顶层路径映射，不代表完整仓库清单。

自动演示由 `LoopDebuggerFilm` 展示调试器式执行过程，`debuggerTrace` 从协议轨迹推导 22 个执行快照。支持查看 prompt、task、tools、history、reply、call、result 及完整请求/响应；地址显示为 `POST https://api.deepseek.com/chat/completions`，不发送请求。变量面板可展开，仅通过上一步、下一步切换快照，不提供播放或时间进度条。

Agent Loop 自动循环动画前提供简短 Rust 伪代码，说明请求模型、记录响应、执行工具、按调用 ID 回传结果与循环结束。示例省略生产级控制分支，不可直接运行。通用展示组件位于 `src/ui/CodeBlock`，使用 Shiki（按需加载 Rust / GitHub Light），双语教学内容位于 `src/i18n/agentLoopCode.ts`。
# 访问与登录

首页和课程支持未登录阅读，账号服务不可用时不在导航弹出错误。评论、打卡入口及排行榜在未登录时引导到独立的 `/login` 页面；登录配置或网络错误只在该页主动登录后显示。GitHub 授权成功后由后台返回首页。这里是前端访问策略，后台公开读取接口不因此变为私有。
