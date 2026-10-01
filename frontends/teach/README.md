# Learn Codex

首页课程卡和侧边章节目录通过 `ChapterTags` 展示正式／草稿状态与已开放章节的累计 PV（阅读次数）；UV 由后台统计但不展示为学习人数。统计失败不伪造为零。s01–s04 为正式文章；s05 上下文机制以草稿形式开放，讲解 Prompt、协议历史、调用结果整理、截断与 token 粗估、本地摘要压缩和失败边界；对应 Rust 实现与源路径映射见 [Context 教程](../../mini-codex-docs/docs/tutorial/05-context.md)。

Dockerfile 构建静态前端，由 Nginx 提供 SPA 回退并将 /api/ 转发给后台。部署不使用 Vite preview；前后端离线包见 [部署说明](../../deploy/README.md)。

登录页支持用户名密码注册、登录与 GitHub 登录。注册成功自动登录，密码方式成功后返回允许的 `next` 目标（课程或排行榜）；GitHub 回调仍返回首页。字段与校验文案双语，密码仅随 HTTPS 请求提交，不写入浏览器存储。本地测试需要运行后台并执行最新数据库迁移。

开发前阅读 [AGENTS.md](AGENTS.md) 中的组件职责和交互约定，以及 [DESIGN.md](DESIGN.md) 中的视觉规范。

`Teach` 是品牌为 **Learn Codex** 的交互式源码教学前端。视觉采用白底、细边框、宽留白和代码实验区，已提供 Agent Loop、模型协议、Function Calling 与 Context 教学正文。

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

## 源码快照

章节可展示对应版本的 `mini-codex-rs` 源码。每章一个分支 `lesson/<章节 id>`（章节 id 与 `course/catalog.ts` 一致），例如 `lesson/function-call-source`；章节发布后的修正直接提交到该分支，并按需同步到后续章节。

执行 `pnpm snapshots` 会从本地所有 `lesson/*` 分支导出被 git 跟踪的源码，生成到 `public/source/`（不进 git）。快照取决于执行构建的机器上这些分支的状态，远程分支不会被读取；换机器构建前需先在本地建好或拉取对应分支。

```text
public/source/
├── index.json               # 已有快照：lesson、branch、commit
├── snapshots/<lesson>.json  # 文件树：相对 mini-codex-rs 的路径、blob sha、字节数、跳转表名
├── blobs/<blob-sha>.txt     # 文件内容，按 blob sha 去重
├── refs/<sha1>.json         # 跳转到定义的数据，按内容 sha1 去重
└── icons/<name>.svg         # 文件树用到的 Material Icon Theme 图标
```

文件树图标在生成快照时按 `material-icon-theme` 的名称映射解析（与 VS Code 插件一致），写入快照的 `icon` 与 `dirs` 字段，只复制用到的 SVG；映射表约 450 KB，不进入浏览器包。未安装依赖时快照照常生成，只是不带图标。

跳转到定义同样在生成快照时完成：脚本用 `git archive` 把每个 lesson 提交的 `mini-codex-rs` 解包到临时目录，运行 `rust-analyzer scip` 生成 SCIP 索引，解码后为每个文件写出 `{ targets: [路径, 行, 列][], refs: [行, 起始列, 结束列, target 下标][] }`（行列从 0 开始，列已从 rust-analyzer 的 UTF-8 字节换算为 UTF-16，与浏览器字符串一致），快照中的文件以 `refs` 字段指向它。只有定义位于本快照内的符号才生成链接，`std` 与第三方 crate 不可跳转。单个分支索引约 20 秒，结果按提交缓存在 `node_modules/.cache/source-refs/`，未变化的分支不会重复索引；构建机需安装 `rust-analyzer`（`rustup component add rust-analyzer`）并能解析 `Cargo.lock` 中的依赖，缺失或失败时只打印提示，源码照常浏览、只是没有跳转。

页面侧由 `course/sourceSnapshot.ts` 读取快照：章节标题行的 `ui/LessonSourceButton` 在对应快照存在时显示“查看源码”，打开 `ui/SourceExplorer` 浏览文件树与只读源码，文件内容与跳转表按需加载；点击标识符跳转到定义所在文件与行，路径栏的返回按钮回到跳转前位置。二进制文件和超过 512 KB 的文件只保留在文件树中，`blob` 为 `null` 并用 `skipped` 说明原因。仓库根目录的 `make teach-dev`、`make teach-build` 与 `make offline-pack` 会先生成快照。执行过 `make hooks`（`make install` 已包含）后，在 `lesson/*` 分支上提交、合并、`--amend`/rebase 或切换、新建该分支时，`.githooks/` 会自动刷新快照，开发服务器刷新页面即可看到。`git branch -f`、`git update-ref` 等不经过这些 hook 的操作仍需手动执行 `pnpm snapshots`。Docker 构建上下文没有 `.git`，镜像内的 `pnpm build` 使用构建前已生成的 `public/source/`。

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
13. Self-Evolution · 自进化机制：待编写。
14. Computer Use · 计算机操作：待编写。

第一课包含手动复制流程演示，第二课已开放模型协议文章；第三课 Function Calling 已正式发布。第四课 `/lessons/function-call-source` 已正式发布，讲解 tools 模块的需求，以及 `crates/tools/` 与 `crates/core/src/tools/` 的实现；正文中的 `crates/` 路径可打开本章源码预览。第五课 `/lessons/context` 以草稿开放，正文位于 `src/i18n/context.ts`，复用既有代码高亮与章节社区组件。后续章节顺延。具体机制与支持范围在编写课程时对照 Codex 源码确认；目录不代表 mini-codex 已实现对应能力。旧 `/lessons/harness-overview` 地址重定向到 `/lessons/agent-loop`。

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

GitHub 登录前检查 `/auth/config`，未配置会留在当前页提示；成功回调后重新读取 `/me`。已开放的 Agent Loop 和模型协议页均挂载 `ChapterCommunity`，评论和打卡按章节 ID 隔离；后续章节开放时复用该组件。评论作为纯文本渲染，删除需二次确认，打卡以服务端结果为准。排行榜独立路由 `/leaderboard`，手机可通过页脚或课程末尾进入。

PV 仅在首页或已开放章节路径变化时上报一次；不因语言切换、hash 锚点或 StrictMode 重执行重复上报，也不自动重试写请求。页脚展示近 30 日聚合统计，服务不可用时隐藏数字而不是显示假 0。后台故障不影响课程阅读。

首页目录对照图使用 `src/ui/DirectoryComparison`，实际路径与双语职责标签位于 `src/course/sourceComparison.ts`；展示已核对的核心文件与真实顶层路径映射，不代表完整仓库清单。

自动演示由 `LoopDebuggerFilm` 展示调试器式执行过程，`debuggerTrace` 从协议轨迹推导 22 个执行快照。支持查看 prompt、task、tools、history、reply、call、result 及完整请求/响应；地址显示为 `POST https://api.deepseek.com/chat/completions`，不发送请求。变量面板可展开，仅通过上一步、下一步切换快照，不提供播放或时间进度条。

Agent Loop 自动循环动画前提供简短 Rust 伪代码，说明请求模型、记录响应、执行工具、按调用 ID 回传结果与循环结束。示例省略生产级控制分支，不可直接运行。通用展示组件位于 `src/ui/CodeBlock`，使用 Shiki（按需加载 Rust / GitHub Light），双语教学内容位于 `src/i18n/agentLoopCode.ts`。
# 访问与登录

首页和课程支持未登录阅读，账号服务不可用时不在导航弹出错误。评论、打卡入口及排行榜在未登录时引导到独立的 `/login` 页面；登录配置或网络错误只在该页主动登录后显示。GitHub 授权成功后由后台返回首页。这里是前端访问策略，后台公开读取接口不因此变为私有。

## 账号与学习交互

`ui/CompletionCelebration` 提供不阻挡操作的全屏打卡成功动效；`community/ChapterLearners` 展示后台返回的打卡人数和最近 40 位打卡用户的头像，不会公开普通浏览记录。

账号菜单使用 `ui/UserAvatar` 展示 GitHub 真实头像，普通账号和加载失败时回退为首字母。`ui/DropdownMenu` 封装菜单交互；章节打卡支持取消，服务端成功后同步进度，评论框采用登录页相同焦点样式。

## Rust 教学实验

编辑器底部的操作提示、Key 隐私、输出隐私和源码链接统一收进 main.rs 旁的“使用说明与隐私”问号浮层，按需查看，不常驻占用高度。

`ui/CodeWorkspace` 为实验区提供双屏切换：桌面左侧阅读文档、右侧全高编辑运行，支持拖动分隔线（方向键微调、双击还原）、全屏代码、退出按钮、Escape 与小屏自动回退。第三章通过 `examples` 和 `exampleId` 提供“本文代码”目录，在 Rust 实验和完整只读 JSON 之间切换；示例内容复用正文数据。通过原位 CSS 布局保留 RustSandbox 和 CodeMirror 实例，不复制源码或 API Key，也不重复创建运行任务。

`ui/Select` 封装 Radix Select，接收 `value`、`options`、`onValueChange`、无障碍 `label` 及可选禁用/占位参数。Portal 菜单统一白底细边框，支持长标题换行、选中标记和键盘操作，不读取业务或语言状态。

第二章和第三章复用 CodeMirror 6 Rust 编辑器（高亮、行号、撤销）、reqwest + tokio + serde_json 示例和异步任务结果。调用模型的示例在表头显示用户 Key 输入，并请求 DeepSeek Responses API 的 `POST /responses`；第三章的第一个示例发送 `tools` 定义并展示模型返回的 `function_call`。模型响应之前单独展示 `tools` 请求片段，并用双列字段指南解释工具类型、名称、描述及 JSON Schema 参数结构。响应讲解下方提供完整可运行的工具闭环：`while` 最多执行 3 轮真实模型请求，解析 `function_call`、按 `name` 调用沙箱内的工具实现、追加同 `call_id` 的 `function_call_output`，再请求模型直到得到最终回答；`get_weather` 使用固定教学数据，模型请求和回传链路是真实的。第三章继续用六步连续轨迹讲解 `function_call → ToolCall → ToolRouter → handler → function_call_output → 再次采样`，并逐项对应 Codex 的 `stream_events_utils.rs`、`tools/parallel.rs`、`tools/router.rs`、`tools/registry.rs`、`tools/context.rs` 与 `session/turn.rs`；协议示例按 DeepSeek 无状态 Responses 行为重放完整输入，不使用其不支持的 `previous_response_id`。文档截图由 `src/ui/ImageZoom` 承载：点击图片用原生 `<dialog>` 原位放大，Escape、遮罩或关闭按钮退出并归还焦点；原文链接位于截图下方图注，图片本身不跳转。依赖在镜像构建时锁定并预编译，不支持用户添加依赖。真实执行依赖后台独立 gVisor worker；默认执行入口关闭。Key 只放当前页面状态，提交后不自动清空，也不写浏览器持久化存储。运行输出使用默认收起的深色终端面板。网络示例只保留普通 HTTPS 调用，由执行镜像内部代理适配；代码不包含 cfg 或 Unix socket。标题旁问号使用 Radix Popover 展示环境限制，支持键盘、Escape 关闭与焦点返回。

Context 章节 `/lessons/context` 同步讲解 Rust 的本地摘要与远程 V2：压缩方式按 provider 能力选择、使用当前配置模型、追加 `compaction_trigger`、校验加密输出后替换历史，并区分重试与失败保留历史。中英文正文位于 `src/lessons/context/article.zh.md` 与 `article.en.md`；课头文案位于 `src/i18n/context.ts`；源码对应与删减范围见 `mini-codex-docs/docs/tutorial/05-context.md`。

Context 章节复用第四章的 `LessonSourceButton` / `SourceExplorer` 文件树、分屏、宽度调整与代码高亮。该章通过 `scripts/local-source.mjs` 的 Vite 虚拟模块打包本次构建的白名单 Rust 源码，标注“本次构建源码”；无对应提交时不展示 GitHub 跳转。其他章节继续使用 `lesson/*` 的提交快照。本地源码与第四章共用 Material Icon Theme 映射和 SCIP 引用解析，支持标识符定义跳转、目标行高亮与返回。构建前需安装 `rust-analyzer`（`rustup component add rust-analyzer`）；索引失败会使构建失败，不静默发布缺少跳转的章节。构建使用隔离输入生成索引，缓存放在忽略的 `.source-cache/`，按全部展示文件内容失效。开发时修改已有白名单文件会重新索引并刷新页面；新增或删除文件后重启开发服务器。白名单包含 Rust、Cargo 清单／锁文件、README、压缩模板及内嵌模型目录 JSON，排除环境文件和构建产物。部署的定义跳转在本章面板内部完成，无对应提交时不提供虚假的 GitHub 地址。

Context 章节已补齐为 19 节双语 Markdown 源码文章，复盘实际学习链路；`i18n/contextAnimations.ts` 保存六组可重放轨迹，`lessons/context/ContextFilm.tsx` 只按 Remotion 当前帧渲染状态，`ui/ContextTracePlayer` 提供播放、暂停、重播、逐步跳转、进度滑块与完整文字步骤。窗口宽度变化保持文字原尺寸，减少动态效果时保留静态状态；离屏和页面隐藏时暂停。图中消息类型为显示简称，token 数为教学样例，不承诺线上测量。

## 共享 Markdown 文章

第四章与 Context 统一使用 `ui/LessonPage.tsx`：课程标题、状态、源码按钮／分屏、概述、正文、前章链接与讨论区由同一壳层组装。`ui/LessonArticle.tsx` 使用 react-markdown、remark-gfm 和 remark-directive 渲染 Markdown，复用第四章的排版，支持嵌套列表、表格、引用、链接和代码围栏；代码统一经过 `ui/CodeBlock.tsx` → `CodeBlockFrame`，支持 Rust、JSON/JSONC、TOML、Bash 高亮与长代码展开。未知语言显示原始代码。

正文保存在 `lessons/<lesson>/article.md` 或 `article.zh.md` / `article.en.md`。页面只传入课程 ID、Markdown、概述和自定义组件注册表，不再把段落存成 TS 数组。已有第四章 Markdown 原文不变（目前正文为中文），迁移后继续使用其课头概述。Context 使用独立中英文文件。

Markdown 中插入已注册组件：

```md
## 本地压缩 {#context-local}

解释内容，可以使用 **强调**、`代码`、表格和普通链接。

::ContextTrace{id="local"}
```

页面向 `LessonPage` 传入 `components={{ ContextTrace }}`；组件接收字符串参数 `id="local"`。当前不执行 Markdown 中的 JSX、脚本或任意 import，也不渲染原始 HTML。组件只能来自显式注册表；拼错名称会显示未注册组件提示，而不是静默消失。新增组件可以使用单行 leaf directive 或 container directive（当前作为无 children 的组件插槽使用）。

标题自动生成 GitHub 风格锚点，重复标题追加后缀；可用 `{#id}` 显式指定跨语言稳定锚点。`showContents` 自动生成二级标题目录。行内 `crates/...` 路径仅在当前章节快照／本地源码清单中真实存在时变成可点击按钮，调用同一个 `LessonSourceButton` 的打开事件；不能为未存在的源码制造链接。Context 的动画注册表和 Markdown 渲染函数保持稳定身份，中英文切换不重置播放器进度。

验证共享解析行为：`pnpm test:articles`（Node 22.6+，使用内建 TypeScript stripping）。常规验证仍为 `pnpm check` 与 `pnpm build`。后续文字型章节沿用这套组件；已有一至三章的专用交互舞台不在本次迁移范围内。

源码元数据回归：`node --test tests/sourceSnapshots.test.mjs tests/localSource.test.mjs`。测试图标映射一致性、跨文件定义与行列、工作区内容变化后的缓存失效，以及环境文件／符号链接排除。

## 天赋测试

独立娱乐入口 `/talent` 展示四项挑战卡片，使用自己的 `TalentShell`，不套课程导航或大标题。薄荷绿、奶油黄、淡紫和浅蓝卡片高低错落，支持左右选择、手机横向滑动、翻面看玩法及 Escape 返回正面。品牌图标为可独立复用的 `src/ui/talent-mark.svg`；卡片与游戏示意分别由 `TalentChallengeCards`、`TalentChallengeArt` 提供。课程顶栏与页脚仍提供模块入口。

测试路由为 `/talent/reaction`、`/talent/memory`、`/talent/reasoning`、`/talent/focus`；大厅可匿名查看，测试必须登录，未登录跳转 `/login?next=...`，用户名密码登录或注册后回到所选测试。独立榜单为 `/talent/leaderboard?game=...`，登录后加载所选项目的真实成绩；GitHub OAuth 仍沿用后台现有的首页回跳行为。挑战进行、准备与保存期间模块导航暂停，避免误离开；语言切换和结束本次挑战仍可操作。

`src/talent/` 管测试页面和游戏生命周期：`ReactionTest` 随机等待 2–5 秒，变绿后点击或按空格 / Enter，抢点重试当前轮，5 轮平均耗时上榜；`MemoryTest` 用九宫格逐关复现闪烁顺序，支持点击及数字键 1–9；`TimedTest` 承载 60 秒数字规律与颜色干扰，支持点击及数字键 1–4。顺序记忆最多 20 关；两项限时测试答对 +1、答错 −1、最低 0 分。

`src/i18n/talent.ts` 保存全部中英文文案，语言切换不重置挑战。颜色信号和记忆闪烁是测试本身，反应力变色不加过渡动画。卸载会清理计时器；页面隐藏或窗口失焦中断挑战，需要重新开始；结束本次挑战不会保存部分成绩。双击与按键长按不会连续计入多次操作。

题目由后台生成，完成后自动提交原始点击、选项或毫秒样本。服务端计算成绩，每项各取个人最佳，同分并列。提交失败时保留当前结果并显示“重试保存”，使用原挑战 ID 避免重复成绩；刷新会清空尚未保存的临时结果。共享榜单展示位于 `src/ui/TalentLeaderboard.tsx`，舞台和榜单样式位于 `src/ui/TalentTests.css`。

后台迁移、接口、计分与娱乐榜边界见 [后台说明](../../backend/README.md#天赋测试独立娱乐模块)。验证命令：`pnpm check`、`pnpm build`、`node --experimental-strip-types --test tests/talent.test.mjs`。
