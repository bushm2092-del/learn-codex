# Learn Codex 开发约定

本文件适用于 `frontends/teach/` 下所有开发。开始修改前阅读本文件与 `DESIGN.md`，再检查现有组件；仓库根规范中的 Codex 源码真实性要求继续适用。

## 产品与内容

- 产品名为 **Learn Codex**，用网页交互动画讲解 Codex harness 的运行机制。
- 以可播放、暂停、重播的教学动画为主要形式。未明确要求时，不增加视频导出或视频制作流程。
- 第一课是 Agent Loop（执行循环）。课程顺序为 Agent Loop → Responses / Chat → Function Calling → Context → Session Storage → MCP → Skills → Sandbox → Plan Mode → Goal Mode → Subagent → Agent Team。具体讲解步骤以用户提供的过程为输入，再对照真实 Codex 源码完善；未确认的内容保留明确占位，不编造机制、事件顺序或已实现能力。
- 页面框架、语言切换和教学交互属于本项目独有的展示层；涉及 session、turn、model client、tool 调度、history 等原理时，以根规范指定的 Codex 源项目为准。

## 技术与组件职责

使用 React、TypeScript、Vite、React Router、Remotion Player、GSAP 和 Radix UI Primitives，包管理使用 pnpm。

| 目录 | 职责 |
| --- | --- |
| `src/app/` | 路由与应用装配 |
| `src/ui/` | 可复用 UI、Radix 封装、站点壳层及组件专属 CSS |
| `src/i18n/` | 双语文案、语言 Context、Provider、Hook 与持久化 |
| `src/course/` | 课程目录、类型、稳定元数据和课程首页 |
| `src/lessons/<lesson-id>/` | 单课页面、讲解数据、场景与步骤编排 |
| `src/animation/` | 共享 timeline 生命周期、播放控制与动画基础设施 |
| `src/api/` | 后台请求、协议类型与错误 |
| `src/auth/` | 账号状态与 GitHub 登录入口 |
| `src/community/` | 评论、打卡、排行榜与访问统计 |
| `src/styles/` | 全局 tokens、基础排版、页面布局与响应式规则 |

- 可封装的界面组件必须放在 `src/ui/`，不在页面或 `AppShell` 内堆积通用组件实现。
- `AppShell` 只组装导航与页面布局；通用组件通过 props 接收数据，不读取课程内容、语言状态或存储。
- 参考现有边界：`DropdownMenu` 负责 Radix 行为和主题样式；`LanguageMenu` 负责语言选项与状态绑定；`LocaleProvider` 负责持久化与 `html lang`。
- 优先复用现有组件，再按真实需要抽象；不要为没有使用场景的组件建立框架。
- 使用无样式的 Radix Primitives 实现需要焦点管理和键盘交互的控件，外观由项目 CSS 定义。不要直接套用 Radix Themes 或其他默认皮肤。
- 组件专属样式与组件同放 `src/ui/`，通用组件使用独立类名前缀。浮层通过 Portal 渲染，不能依赖导航父节点的样式才能正常显示。
- React Provider 与非组件的 Context、Hook、文案模块分离，维护稳定的 Fast Refresh 边界。

## 视觉约束

- `DESIGN.md` 是风格控制文档，`.impeccable/design.json` 是配套机器可读描述。修改组件规范时同步相关部分，记录最终实现。
- 沿用已建立的白底、黑色标题、细边框、宽留白与代码实验区；参考网站为 `https://learn.shareai.run/en/`，产品标识保持 Learn Codex。
- 普通导航和辅助控件保持轻量，黑色实心按钮用于主要行动；蓝色用于焦点、主题和教学信号。
- 下拉菜单采用紧凑白色浮层、细边框、小圆角和微弱阴影。避免宽大菜单、重阴影、重复语言缩写、无必要的菜单标题及大面积加粗选中块。
- 选中状态使用清晰的标记，hover 与键盘焦点分别可辨识；不能只依赖颜色表达状态。
- 使用现有 tokens，避免任意添加近似色、字号与圆角。新增有明确用途的值时同步设计文档。
- 遵循项目中的 Impeccable 工作流；用户明确的主题与本文件约束优先于通用设计偏好。

## 中英文

- 新增可见文案和无障碍名称必须同时提供中文与英文；品牌、代码标识符和源码名称保留原名。
- 文案放在 `src/i18n/`，课程标题等稳定元数据可以在课程目录中保存双语值。通用 UI 不硬编码业务文案。
- 通过 `useLocale` 读取语言；语言切换不得丢失当前路由或重置教学进度。
- 保持本地语言记忆与 `<html lang>` 同步；存储不可用时当前会话仍能切换。
- 移动端必须能找到语言入口；用中英文实际内容检查换行、溢出和控件宽度。

## 动画

- 宣传片式操作演示使用 Remotion Player，以 `useCurrentFrame`、`interpolate`、`spring` 驱动画面，不混用 CSS 动画、独立计时器或 GSAP。现有普通教学 timeline 可继续使用 GSAP 与 `@gsap/react`；共享动画层不包含具体课程讲解。
- 模拟电脑操作时，不叠加“看这里”“手动操作”等讲解标签或模拟剪贴板栏。用真实界面状态、鼠标拖选、按钮按下及短暂的复制/保存 toast 表达反馈。粘贴与发送必须分开，输入框先显示实际文本，点击发送后才出现消息。
- 使用作用域、refs 和卸载清理，避免影响其他课程或留下重复 timeline。
- 支持播放、暂停、重播与 `prefers-reduced-motion`；语言切换不重建演示流程。
- 动画服务于调用关系、状态变化和执行顺序，避免持续循环的装饰动画。代码示例与流程图必须可读。

## 验证与交付

- 修改前检查工作区，保留无关修改，不恢复或提交其他任务的删除记录。
- 前端变更执行仓库根目录的 `make teach-build`，或在本目录执行 `pnpm check` 与 `pnpm build`。
- UI 交互变更检查点击、键盘选择、Escape 关闭、焦点返回、中英文切换与刷新持久化；按实际改动选择相关检查。
- 检查桌面与移动端布局，不能仅凭构建成功宣称视觉已验证。截图或浏览器检查失败时如实说明。
- 设计文件变更验证 JSON；提交前执行 `git diff --check`。不要修改或提交 `node_modules/`、`dist/`、`*.tsbuildinfo` 等生成产物。
- 新的目录职责与开发方式同步本目录 README；跨项目命令变化同步根 README 和 Makefile。纯前端变更无需改写 Rust 内核说明。
- 只有用户要求时创建 Git 提交，采用 Conventional Commits；提交后报告提交号、验证结果和仍未提交的相关事项。

## 文章型章节

文章型章节统一使用 `src/ui/LessonPage.tsx` 与 `LessonArticle.tsx`，排版以第四章为基准。正文存为章节目录内 `.md`，支持 GFM 和显式注册组件 directive（如 `::ContextTrace{id="local"}`）；不要再为每章创建私有 Markdown 解析器、复制课头结构或将整篇正文写成 TS 段落数组。长代码通过共享 `CodeBlock` / `CodeBlockFrame` 展示，源码入口复用 `LessonSourceButton`。纯文字中英文保存在对应 Markdown 文件，其余界面文案仍位于 i18n。新增 Markdown 行为应运行 `pnpm test:articles`。
