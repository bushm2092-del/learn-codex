---
name: Learn Codex
description: 用交互动画拆解 Codex harness 真实运行机制的源码教学站。
colors:
  selection-bg: "#cfe1ff"
  selection-ink: "#172f50"
  ink: "#111113"
  ink-strong: "#09090b"
  action: "#18181b"
  action-hover: "#000000"
  muted: "#71717a"
  subtle: "#a1a1aa"
  line: "#e4e4e7"
  line-soft: "#eeeeef"
  panel: "#fafafa"
  canvas: "#ffffff"
  signal-blue: "#3b82f6"
  signal-blue-soft: "#e9f1ff"
  signal-blue-ink: "#2f5f9b"
  signal-line: "#a7bddb"
  status-green: "#22c55e"
  code-red: "#ef4444"
  code-amber: "#d7a32b"
  code-green: "#32a852"
  code-violet: "#c084fc"
  code-blue: "#60a5fa"
  placeholder: "#b3b3ba"
typography:
  display:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(48px, 5vw, 66px)"
    fontWeight: 740
    lineHeight: 1
    letterSpacing: "-0.055em"
  headline:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(34px, 4vw, 45px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  brand:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "18px"
    fontWeight: 720
    lineHeight: 1
    letterSpacing: "-0.025em"
  section-heading:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "29px"
    fontWeight: 710
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  card-title:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  supporting:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  placeholder-label:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  stage-title:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
  mono-small:
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
  arrow:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1
  hero-note:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(16px, 1.8vw, 20px)"
    fontWeight: 400
    lineHeight: 1.5
  display-mobile:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "46px"
    fontWeight: 740
    lineHeight: 1
    letterSpacing: "-0.055em"
rounded:
  menu-item: "3px"
  control: "6px"
  index: "7px"
  action: "8px"
  surface: "9px"
  preview: "10px"
  window: "11px"
  pill: "999px"
spacing:
  xs: "7px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
components:
  focus-panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.action}"
    padding: "0 24px"
    height: "45px"
  button-timeline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "32px"
  topbar:
    backgroundColor: "rgba(255, 255, 255, 0.94)"
    textColor: "{colors.ink-strong}"
    height: "58px"
    padding: "0 32px"
  lesson-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "24px"
    height: "190px"
  lesson-stage:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  topic-badge:
    backgroundColor: "{colors.signal-blue-soft}"
    textColor: "#2f5f9b"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  language-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 4px"
    height: "36px"
  language-menu:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px"
---

# Design System: Learn Codex

## Overview

**Creative North Star: "The Interactive Source Notebook"**

Learn Codex 是一份可以运行的源码讲义：像技术文档一样克制、清晰、可扫描，又像实验台一样允许用户播放、暂停和重看机制。页面以白纸、黑墨和细分隔线建立编辑式秩序，动画舞台与代码窗口承担主要视觉焦点。

系统不追求营销页式的装饰密度，也不使用大面积品牌色制造情绪。视觉表达应优先帮助读者理解调用链、状态和时间顺序；每一个高亮、阴影和动效都必须服务于结构或反馈。

**Key Characteristics:**

- 黑白编辑式骨架，靠排版、留白和细边框建立层级。
- 蓝色是稀少的教学信号，只标记当前主题、焦点和流程节点。
- 系统无衬线负责阅读，等宽字体负责代码、编号、状态和控制标签。
- 动画短促、可控、可降级，默认表现为元素进入与信号传播。
- 桌面端保留课程导航与实验舞台，移动端把内容压缩为单列学习流。

## Colors

色板接近纸张与墨水：中性灰负责大多数层级，蓝色仅作为稀少且有含义的教学信号。

### Primary

- **Codex Ink** (`#111113`): 正文、标题与主要信息的默认颜色。
- **Action Black** (`#18181b`): 主行动按钮、进度条和需要最高对比度的交互状态。
- **Signal Blue** (`#3b82f6`): 键盘焦点、章节节点与机制状态提示；不是大面积背景色。
- **Status Green** (`#22c55e`): 仅用于“架构就绪”等成功状态点。
- **Signal Line** (`#a7bddb`): 动画舞台中的低对比度传播轨迹。

### Neutral

- **Deep Ink** (`#09090b`): 代码窗口与最深文字。
- **Muted Graphite** (`#71717a`): 说明文字、元信息与代码注释。
- **Quiet Zinc** (`#a1a1aa`): 次要编号、箭头和非活动状态。
- **Rule Gray** (`#e4e4e7`): 主要边框与内容分隔线。
- **Soft Rule** (`#eeeeef`): 工具栏、舞台页脚等容器内部的分隔线。
- **Panel Paper** (`#fafafa`): 轻量 hover、面板与舞台底色。
- **Canvas White** (`#ffffff`): 页面和主要内容面的基础背景。
- **Signal Mist** (`#e9f1ff`): 蓝色标签的低对比度背景。
- **Placeholder Gray** (`#b3b3ba`): 尚未开放章节的占位文字。
- **Code Syntax Set** (`#ef4444`, `#d7a32b`, `#32a852`, `#c084fc`, `#60a5fa`): 仅限窗口控制点和代码语法着色。

### Named Rules

**The Signal, Not Paint Rule.** 蓝色只表示焦点、主题或运行信号；单屏蓝色面积应保持很小，不用于装饰性大色块。

**The Paper and Ink Rule.** 默认用白、黑和中性灰解决层级，只有在语义不足时才引入颜色。

## Typography

**Display Font:** System UI Sans (`ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif)
**Body Font:** System UI Sans（同上）
**Label/Mono Font:** `SFMono-Regular`, `Consolas`, `Liberation Mono`, monospace

**Character:** 无衬线字体保持教学内容直接、清楚；紧缩字距的大标题提供编辑感。等宽字体不是装饰，而是“这是代码、状态或序列信息”的语义标记。

### Hierarchy

- **Display** (740, `clamp(48px, 5vw, 66px)`, 1): 仅用于首页品牌主标题，字距 `-0.055em`。
- **Headline** (700, `clamp(34px, 4vw, 45px)`, 1.1): 课程页主标题，字距 `-0.04em`。
- **Section Heading** (710, `29px`, 1.25): 首页一级模块标题，字距 `-0.035em`。
- **Title** (700, `23px`, 1.25): 课程内容分节标题，字距 `-0.025em`。
- **Body** (400, `14–18px`, 1.5–1.6): 教学说明与摘要；长文建议控制在约 70 字符宽度内。
- **Label** (600, `11–12px`, 1): 编号、事件名、状态和元信息；章节组标签可用 `0.08em` 字距与大写。
- **Supporting Scale** (`13 / 14 / 17 / 18 / 19 / 20px`): 分别服务于占位说明、正文小号、舞台标题、引导语、卡片标题与箭头；不可随意增加中间字号。

### Named Rules

**The Two Voices Rule.** 叙述使用系统无衬线；代码、编号、状态、公式和时间线控制使用等宽字体，不混用职责。

## Layout

Rust 编辑器底部不常驻使用说明、隐私说明和源码链接；统一收纳在 main.rs 旁的问号入口“使用说明与隐私”。点击展开 Radix Popover，长内容在浮层内滚动，Escape 和点击外部关闭，不推移代码或终端。

Rust 实验区在 1100px 及以上提供“双屏：边读边写”。文档默认占左侧 48%，分隔线支持拖动、方向键微调和双击还原（30%–62%）；目录暂时隐藏。右侧铺满导航栏以下的窗口高度，编辑器自适应剩余空间，浅色输出栏固定在底部，展开后的终端输出默认占 24dvh；顶部独立手柄可上下拖动调高，方向键微调、Home/End 调整到边界、双击恢复默认高度。收起后隐藏手柄并保留高度；拖动不触发折叠，输出高度受视口和编辑区剩余空间限制。布局操作统一收纳在 main.rs 旁的 30px 灰色图标按钮：分屏按钮再次点击返回单栏，双屏中显示全屏/恢复按钮；悬停显示操作名称，提供无障碍标签、选中态和键盘焦点，不再单独占据控制栏或文档行。退出按钮与 Escape 返回单栏并归还焦点；小屏自动回到单栏。切换布局不重新挂载编辑器，保留编辑、撤销历史、Key 与任务状态；同一页面只展开一个双屏实验区。

首页首屏不设固定最小高度，按钮到源码对照标题的间距为桌面 64px、移动端 56px，避免两个区块的留白叠加。

首页内容容器为 `min(1200px, calc(100% - 64px))`，采用居中的纵向章节流，主要章节使用约 `64px` 的上下留白。代码示例限制为 `674px`，时间线预览限制为 `850px`，通过更窄的内容面形成聚焦。

课程页容器为 `min(1216px, calc(100% - 48px))`，桌面端使用 `255px + 1fr` 双栏网格与 `48px` 间距；侧栏在 `top: 92px` 处吸顶，右侧保留标题、摘要和交互舞台。课程卡片使用连续的三列边框网格，而不是彼此悬浮的卡片岛。

在 `900px` 以下，课程页折叠为单列，侧栏变为横向章节导航，课程卡片降为两列；在 `680px` 以下，顶部导航隐藏文字入口，课程卡片与页面主体均变为单列，内容左右安全边距缩至 `14–16px`。核心间距沿用 `7 / 10 / 16 / 24 / 32 / 64px` 的节奏。

## Elevation & Depth

系统以平面为默认状态，主要依靠边框、背景色差和容器嵌套表达结构。阴影只出现在需要从纸面抬起的两个焦点对象：深色代码窗口与动画舞台中的中心讲解卡。

### Shadow Vocabulary

- **Code Window Lift** (`0 24px 52px rgba(0, 0, 0, 0.13)`): 只用于首页深色代码窗口，使其成为示例焦点。
- **Stage Card Lift** (`0 14px 34px rgba(24, 24, 27, 0.07)`): 用于实验舞台中心对象，提供轻微空间分离。
- **Action Rest** (`0 1px 2px rgba(0, 0, 0, 0.12)`): 主按钮的微弱实体感。

### Named Rules

**The Flat-by-Default Rule.** 普通卡片、导航和教学容器保持无阴影；只有代码窗口、主行动和舞台内的活动对象可以获得抬升。

## Shapes

形状语言以小半径矩形和一像素细边框为主。控制项使用 `6px`，主按钮使用 `8px`，教学面与舞台卡使用 `9–11px`；只有标签、状态点与进度轨道使用完全胶囊或圆形。课程目录网格保持直角，以连续边框强调它是一张结构表，而非营销卡片集合。

## Components

### Learning Community

章节标题旁使用紧凑细边框标签展示文章状态与累计 PV 阅读次数；不展示 UV 或打卡人数作为阅读量。接口不可用时隐藏计数，不显示假零。

排行榜采用 920px 居中编辑式布局：标题与规则、个人进度横条、头像排名表依次排列。个人横条保留继续学习入口，当前用户行用浅灰底和“你”标记；前三名使用黑底数字，所有名次来自接口且保留并列。移动端个人区纵向排列，表格保持三列，不制造空白占位或虚构参与人数。

新打卡成功后播放 2.6 秒全屏纸屑庆祝，Portal 固定定位且不拦截点击、不抢焦点，Escape 可提前结束；reduced-motion 仅保留静态成功提示。打卡人数旁采用紧密横排真实头像，并在 hover/键盘焦点时显示用户名；最多显示最近 40 位，其余显示人数，取消后刷新。不得将普通访客列为打卡用户。

账号区使用真实头像、用户名和箭头触发 Radix 下拉菜单，头像失败回退为首字母。菜单采用 180ms 轻微位移淡入。评论框沿用登录框的白底、6px 圆角和深色内焦点描边；打卡成功显示全屏庆祝和完成状态，保留明确的取消打卡入口。所有动效响应 reduced-motion。

账号输入框聚焦使用贴合边框的 2px 深色内描边（outline-offset: -2px），不使用外扩蓝圈，不改变尺寸；按钮和链接保留深色键盘焦点轮廓。

登录页使用 400px 居中单列表单，不增加外层卡片。登录与注册为细线切换，46px 输入框和黑色主按钮建立操作层级；GitHub 为次级描边按钮，底部保留免登录阅读入口。注册确认密码、显示密码与错误信息均在表单内呈现。布局与业务留在 auth，样式放在 ui/AuthPage.css。

导航账号入口采用小尺寸描边按钮；章节末尾以分隔线组织打卡、登录提示、纯文本评论表单与列表，不叠加卡片。排行榜用简单表格，同分并列；移动端保留登录与语言切换，排行榜通过页脚及课程末尾链接进入。所有加载、失败、未登录、空列表和已打卡状态均有双语反馈，不使用模拟业务数据。

### Source Directory Comparison

首页源码介绍使用 `DirectoryComparison` 并排目录对照图：白底细边框，同名路径按行对齐，中间蓝色细箭头连接，以 1:1 标识强调对应关系。只展示已核对的核心文件，真实列出两个 workspace 根路径。窄屏允许图内横向滚动并提供键盘焦点，不压缩文件名；图注说明是文件节选。

### Lesson Code Block

沙箱提交、排队、编译运行时，按钮和状态行显示小尺寸 loading 圆环与对应文字；运行期间禁止重复提交，保留取消入口。减少动态效果时圆环静止，状态文字持续可读。

双屏展开后，原代码位置保留浅灰提示“此示例已在右侧打开 · 点击继续编辑”，使用固定 18px 圆端右箭头，提供阅读衔接和适度段落间距；点击直接聚焦右侧编辑器，不复制代码。退出双屏后提示消失，恢复原编辑区。右侧 API Key 采用紧凑密码输入框，与文件名、布局操作及运行按钮同处表头一行；标签保留供辅助技术读取，占位符标明 DeepSeek API Key，空间不足时允许自然换行。

第三章双屏顶部提供“本文代码”选择框和总数，按正文顺序汇总两个可运行 Rust 示例与四个 JSON 片段（含调用说明下方的工具结果回传项）。Rust 示例切换保留各自的编辑器、Key 和运行状态；JSON 以完整只读高亮展示，不提供运行按钮。选择框复用 `ui/Select`（Radix Select）：32px 触发器、白底 1px 细边框、6px 圆角、13px 字号，Portal 菜单跟随触发器宽度且限制在视口内，最长 360px 滚动；触发器长标题省略、选项完整换行，选中项以勾号标识，支持方向键、文字搜索和 Escape 关闭并归还焦点（不退出双屏），切换时保持分屏宽度与全屏状态，不滚动正文。目录与正文共享同一份示例数据，不复制维护代码内容。

Rust 编辑器搜索面板使用组件内独立样式，隔离沙箱全宽输入和块级标签规则。查找、替换各一行，选项集中于第三行，30px 控件、14px 复选框、灰底细边框；关闭按钮固定在右上角。保留 CodeMirror 查找/替换、大小写、正则、全词和键盘行为，通过 `EditorState.phrases` 提供中文文案，编辑器不重建。搜索命中使用浅蓝底色，当前匹配增加蓝色轮廓。

运行输出为合法 JSON 时自动以两空格缩进展示，键名蓝、字符串绿、数字橙、布尔值和 null 紫；非 JSON 输出保留原文。使用 React 文本节点渲染，不解析 HTML，保留输出区域滚动与键盘访问。

Rust 编辑器的文字选区使用原生浅蓝背景 `#dce9f8`，保留各 token 的语法色；选区覆盖当前行浅灰底色，不将选中文字统一染蓝。

编辑器聚焦不显示粗黑轮廓，仅将原有 1px 边框变为 muted 色。运行环境说明收纳到文件名旁的 18px 问号图标（28px 点击区域），使用 Radix Popover 展示，支持 Escape、点击外部关闭与焦点返回；正文不再出现独立“运行环境与限制”展开行。

第二章 Rust 实验位于文档截图下，采用用户参考图的平面源码编辑器风格：CodeMirror 6 白底直角细边框、13px 等宽字体、1.75 行高、640px 最大滚动高度，灰色行号与注释 `#666666`，当前行浅灰 `#f5f5f5`，活动行号蓝色 `#075db5`。编辑器专用语法色：关键字红 `#d92332`、类型/函数紫 `#8024df`、变量/命名空间橙 `#b84b00`、字符串绿 `#06743b`、数字蓝 `#075db5`；选区 `#dce9f8`，括号匹配底色 `#e8e8e8` 与轮廓 `#b8b8b8`。这些颜色只用于代码，不扩散到站点业务组件。Tab 不捕获；运行时只读。编辑器、表头 Key 输入和输出终端组成一个连续细边框工作区；每个编辑器和 Key 输入使用实例级唯一 id，保证同页多个沙箱的标签关联正确。Key 使用 password 输入，仅保留在当前页面状态且提交后不自动清空，不写浏览器持久化存储。输出终端默认收起，标题同时承载队列状态，单栏、双屏与全屏统一采用浅灰色标题栏、灰色细边框和深色文字；展开后的结果区延续浅灰底色，JSON 复用文档浅色高亮，显示纯文本且不渲染 HTML。窄屏时 Key 标签与输入框、输出标题与状态分别纵向排列。运行环境限制可展开查看。禁用、登录、错误、取消及超限状态提供双语文案。官方文档截图使用 `src/ui/ImageZoom`：点击图片打开原生 `<dialog>` 放大视图（`rgba(9, 9, 11, .72)` 遮罩、白色 11px 圆角面板、顶部 13px 图名与 32px 关闭按钮，160ms 指数缓出淡入），Escape、遮罩点击与关闭按钮均可关闭并归还焦点到图片；图片以 `zoom-in` 光标和 hover / 键盘聚焦时出现的黑底白字“放大”提示表明可点击，放大期间锁定底层页面滚动，`680px` 以下按高度铺满并允许横向滚动；使用浏览器原生模态能力，不新增第三方依赖。原文链接移到截图下方 13px 图注文字，图片本身不再跳转。

课程伪代码由 `src/ui/CodeBlock` 展示，使用 Shiki 与 GitHub Light 标准语法配色；仅加载 Rust 语法和该主题。白底、细边框、9px 圆角，无阴影；代码为 14px 等宽字体与 1.8 行高。窄屏在代码区内横向滚动并支持键盘聚焦，不撑宽页面。未加载或加载失败时保留原始代码。标题、说明和代码注释同步中英文。

第三章工具执行说明使用连续步骤轨迹表达闭环，不使用悬浮卡片或装饰箭头。桌面端采用两列自适应共边框网格，中文四步排列成 2×2；取消固定最小高度，步骤数量变化时分隔线由网格间隙统一生成，步骤编号用等宽蓝色小字，标题和说明保持黑灰层级；`760px` 以下和双屏阅读区切为单列。协议调用与结果继续复用 `JsonCodeBlock`；模型响应上方的 `tools` 定义使用同一代码块，并以下划分隔的双列 `dl` 解释字段，移动端切为字段名在上、说明在下。重点 `function_call` 摘录之后使用同一 Rust 沙箱组件展示可编辑、可运行的真实 `while` 工具闭环，表头继续收集 Key，终端按轮次显示模型关键输出与工具结果。

### Primary Button

- **Shape:** `8px` 圆角，最小高度 `45px`，水平内边距 `24px`。
- **Primary:** Action Black 背景、白色文字、`14px` 字号。
- **Hover / Focus:** hover 上移 `1px` 并变为纯黑；focus 使用 `2px` Signal Blue 外描边与 `3px` offset。

### Timeline Controls

- **Shape:** 白底、`1px #d8d8dc` 边框、`6px` 圆角、`32px` 最小高度。
- **State:** hover 加深边框与文字并使用 Panel Paper 背景；按钮按“播放 / 暂停 / 重播”成组出现。

### Chips

- **Topic Badge:** Signal Mist 背景、`#2f5f9b` 文字、胶囊轮廓、`4px 10px` 内边距。
- **Published Badge:** 正式内容使用 `#f0fdf4` 浅绿底、`#166534` 深绿文字、`#bbf7d0` 边框。
- **Draft Badge:** 草稿使用 `#fffbeb` 浅琥珀底、`#92400e` 深琥珀文字、`#fde68a` 边框。首页、目录及文章标题共享状态色；保留文字标签，不仅靠颜色区分。待编写与阅读次数保持中性灰，状态标签不充当操作控件。

### Cards / Containers

- **Lesson Card:** 三列或单列连续网格的一格，直角、`24px` 内边距、最小高度 `190px`；hover 只把背景切换为 Panel Paper。
- **Code Window:** `11px` 圆角、深色背景、深色边框和 Code Window Lift 阴影；顶部保留 38px 文件栏。
- **Lesson Stage:** `9px` 圆角、细边框、白底；内部工具栏和页脚用 Soft Rule 分隔。

### Navigation

- **Top Bar:** `58px` 高、白色半透明背景、`14px` 毛玻璃和底边框；文字导航由灰转黑，品牌字标保持强对比。
- **Lesson Sidebar:** 活动项使用浅灰背景、`6px` 圆角和更重字重；桌面端吸顶，窄屏转为横向短导航。
- **Language Menu:** 使用 `src/ui/DropdownMenu.tsx` 封装 Radix 菜单交互与主题样式，`LanguageMenu.tsx` 只绑定语言状态，`AppShell` 只组装导航。触发器为透明底、14px 文字与小箭头，桌面和移动端均显示“中文 / EN”。菜单最小宽度 132px、白底、1px 细边框、6px 圆角、4px 内边距；每行只显示语言名与勾选标记，选中态不加粗、不铺底，hover 用浅灰。浮层仅使用 `0 2px 6px rgba(24, 24, 27, 0.04)` 微弱阴影。

### Animation Stage

Agent Loop 自动演示现在采用固定调试器布局：左侧 Rust 伪代码与当前行箭头，右侧可展开的完整变量和请求/响应 JSON，顶部固定 DeepSeek 请求地址。用行高亮与值变化表示执行，不移动代码窗口；底部保留逐步和播放控制。变量快照区分未赋值、响应入历史和结果入历史，不提前显示未来状态。

自动循环演示采用 Remotion 窗口分镜：请求 JSON、响应 JSON、执行 JSON 与回传 JSON 依次进入前景，前一窗口平移缩小淡出。JSON 直接位于动画中，按用户要求简化字段和历史展示，并标明是字段示意；不再使用四节点流程图或下方完整检查区。提示词、需求和工具定义用紧凑排版同时呈现，调用 ID、工具调用及结果字段用浅蓝高亮。中英文切换保留播放进度。

操作影片第一帧在文件窗口上方显示需求弹窗：半透明中性遮罩、白色居中弹窗、24px 标题“需求”和 23px 需求正文。使用 `src/ui/SceneDialog` 展示外壳，不阻塞网页焦点。保留 2.8 秒开场时段，最后 0.4 秒淡出后进入操作；减少动态效果时直接切换。不再使用整屏文字开场或文件内任务便签。

操作影片使用 60 fps 与不等长动作段：复制、发送和保存短促，输入与生成保留阅读时间。鼠标从上一动作终点连续移动到下一起点，拖选逐字位置平滑插值；toast 可跨段淡出，不在切段时截断。避免每段固定停留造成幻灯片感。

教学演示用阶段条标记当前流程，用 `FocusPanel` 的蓝色细描边和“看这里”文字标记当前操作面板；通用面板允许 1.015 倍轻微缩放。文本选中态使用 `#cfe1ff` 背景和 `#172f50` 前景。高亮必须对应真实演示步骤。

手动复制演示采用真实电脑操作式分镜：不展示大字步骤、阶段条、“看这里”“手动操作”或剪贴板栏。窗口从 0.92 倍推至原尺寸，不倾斜；鼠标拖选与文字选区同步，点击复制/保存后显示黑底白字 toast，粘贴内容必须先出现在输入框，再点击发送。Remotion 以当前帧驱动镜头、鼠标、文本和 toast，暂停与拖动不得产生独立运动。减少动态效果时取消镜头过渡、鼠标和逐字效果，保留完整文本及反馈。此表现仅用于教学舞台，不扩散到导航和普通内容。

舞台使用 `32px` 方格、径向淡出遮罩与白灰背景，中心内容面保持可读。GSAP 默认时长约 `0.55–0.65s`，使用 `power3.out` 进入与 `power3.inOut` 信号传播；动画优先采用 transform 与 opacity，并完整响应 `prefers-reduced-motion`。

## Do's and Don'ts

### Do:

- **Do** 用排版、留白和一像素边框先解决信息层级。
- **Do** 把蓝色留给焦点、章节节点、主题标签和运行信号。
- **Do** 让课程动画具备播放、暂停、重播和 reduced-motion 降级。
- **Do** 在代码、编号、公式、事件与状态信息上统一使用等宽字体。
- **Do** 保持桌面双栏到移动单栏的清晰响应式转变。

### Don't:

- **Don't** 添加大面积渐变、霓虹色或无语义的蓝色装饰。
- **Don't** 给每张卡片都加阴影；结构型容器默认保持平面。
- **Don't** 使用超大圆角、玻璃卡片堆叠或胶囊形主按钮改变编辑式气质。
- **Don't** 用持续循环或无法暂停的动画干扰阅读。
- **Don't** 把营销文案的视觉优先级置于真实源码调用链和教学状态之上。
