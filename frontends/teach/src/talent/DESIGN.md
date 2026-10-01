---
name: "天赋测试 · 彩色挑战卡"
description: "独立的柔和彩色挑战卡、即时游戏信号和真实成绩榜单。"
colors:
  canvas: "oklch(98.5% .004 85)"
  ink: "oklch(20% .012 250)"
  ink-strong: "oklch(14% .012 250)"
  muted: "oklch(46% .012 250)"
  subtle: "oklch(64% .012 250)"
  line: "oklch(20% .012 250 / .16)"
  line-soft: "oklch(20% .012 250 / .09)"
  panel: "oklch(96% .006 85)"
  action: "oklch(22% .012 250)"
  card-edge: "oklch(20% .012 250 / .22)"
  white: "#fff"
  reaction-card: "oklch(95% .043 153)"
  reaction-edge: "oklch(60% .12 153 / .65)"
  memory-card: "oklch(97% .065 96)"
  memory-edge: "oklch(72% .14 96 / .8)"
  reasoning-card: "oklch(94% .041 303)"
  reasoning-edge: "oklch(65% .12 303 / .65)"
  focus-card: "oklch(94% .045 237)"
  focus-edge: "oklch(65% .12 237 / .65)"
  talent-blue: "#315eb4"
  talent-wait: "#9d3434"
  talent-go: "#287548"
  talent-yellow-ink: "#806100"
  art-purple: "#7652a4"
  art-green: "#36a566"
  art-red: "#ce4949"
  art-yellow: "#cfac18"
  grid-lit: "#68bf86"
  grid-lit-edge: "#439c63"
  grid-paper: "oklch(99% .005 85 / .6)"
  sequence-paper: "oklch(100% 0 0 / .45)"
  button-hover: "oklch(100% 0 0 / .35)"
  mark-ink: "#202326"
typography:
  brand:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.6
    letterSpacing: "-.025em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-.025em"
  intro-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  card-description:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  navigation:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  supporting:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 570
    lineHeight: 1.6
  text-button:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  result:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(34px, 4vw, 56px)"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-.025em"
  reaction-signal:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  color-word:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(40px, 5vw, 56px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  answer:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.6
  key:
    fontFamily: "ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "normal"
rounded:
  tag: "4px"
  control: "6px"
  mark: "7px"
  surface: "9px"
  circle: "50%"
spacing:
  4: "4px"
  5: "5px"
  22: "22px"
  6: "6px"
  8: "8px"
  10: "10px"
  12: "12px"
  16: "16px"
  18: "18px"
  20: "20px"
  24: "24px"
  28: "28px"
  32: "32px"
  36: "36px"
  44: "44px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.canvas}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.canvas}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-outline-hover:
    backgroundColor: "{colors.button-hover}"
    textColor: "{colors.ink}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.text-button}"
    padding: "8px 0"
  shell-navigation:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    padding: "4px max(24px, calc((100vw - 1120px) / 2))"
  card-reaction:
    backgroundColor: "{colors.reaction-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
  card-memory:
    backgroundColor: "{colors.memory-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
  card-reasoning:
    backgroundColor: "{colors.reasoning-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
  card-focus:
    backgroundColor: "{colors.focus-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
  card-tag:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  deck-arrow:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "44px"
  reaction-waiting:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    padding: "24px"
  reaction-go:
    backgroundColor: "{colors.talent-go}"
    textColor: "{colors.white}"
    padding: "24px"
  reaction-early:
    backgroundColor: "{colors.reaction-card}"
    textColor: "{colors.talent-wait}"
    padding: "24px"
  memory-cell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  memory-cell-lit:
    backgroundColor: "{colors.talent-go}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
  timed-choice:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 8px"
  board-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  leaderboard:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.supporting}"
  leaderboard-login:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "64px 24px"
---

# Design System: 天赋测试 · 彩色挑战卡

## Overview

**Creative North Star: "彩色挑战卡"**

天赋测试是一组可以拿起、翻面和开始挑战的彩色卡片。暖白页面、深色文字、四块柔和色面与短软阴影构成独立于课程的界面；系统字型和清晰描边保留轻量、直接的操作感。

色面标识挑战身份，深色按钮标识主要行动，游戏信号只表达当前状态。大厅保持小号品牌与简短提示，游戏页把题目、计时和答案放在主要视线中；所有成绩、错误和登录状态来自真实业务。

**Scope:** 本文只约束 `/talent`、`/talent/reaction`、`/talent/memory`、`/talent/reasoning`、`/talent/focus`、`/talent/leaderboard?game=...`，以及 `next` 指向上述路由的 `/login`。源文件包括本目录的页面与游戏，以及 `../ui/TalentTests.css`、`TalentShell.tsx`、`TalentChallengeCards.tsx`、`TalentChallengeArt.tsx`、`TalentArrow.tsx`、`TalentLeaderboard.tsx`、`talent-mark.svg`。UI 文件位于 `src/ui/` 仍属于此独立世界。课程、全局移动 NavigationMenu、课程来源的账号登录页和 Context 使用 [`../../DESIGN.md`](../../DESIGN.md)。

用户确认的方向与首屏构图见 [surface contract](../../.impeccable/surfaces/talent-color-cards.md)。前置产品约束见 [PRODUCT.md](../../PRODUCT.md)。

**Key Characteristics:**

- 薄荷绿、奶油黄、淡紫、浅蓝分别对应四种挑战。
- 四卡高低错落、轻微倾斜；悬停归正，翻面查看规则。
- 暖白底、深色文字、细着色边框与短软阴影。
- 系统无衬线与 tabular-nums 保持阅读、计时和成绩清楚。
- 手机保留横向选择、翻面、语言与账号入口，减少动态时仍可操作。

## 登录与账号

`LoginShell` 根据白名单校验后的 `next` 选择壳层。天赋来源使用 360px 紧凑单列表单、44px 输入框和深色主按钮，沿用暖白底、天赋 SVG 标识与 56px 导航；标题为“登录，开始挑战”或“创建挑战账号”，字号 24px / 650，说明 13px。提交按钮为“登录并挑战”或“注册并挑战”，明确使用 Canvas 文字和随文字颜色变化的箭头，防止壳层通用按钮颜色覆盖；两种登录按钮均至少 44px 高。只提供挑战大厅、天赋排行榜、语言切换与返回大厅，不展示课程文案、课程页脚链接和重复登录入口。表单上下留白为 24px，标题区下方 20px，模式切换、分隔线与返回入口间距为 16px，字段提示下方 14px；小屏可自然纵向滚动。密码注册/登录与 GitHub 登录都回到原挑战或带 game 的榜单。游戏内账号菜单也只链接天赋排行榜。

## Colors

前置 token 保留源码中的 OKLCH 或十六进制写法，不生成额外色阶。深色操作与暖白纸面负责可读性，四种柔和卡色负责项目身份。

### Primary

- **Action / Ink / Strong Ink:** 主行动、标题、数字和键盘焦点；主按钮文字用 Canvas，hover 使用 Strong Ink。
- **Reaction Mint / Memory Cream / Reasoning Lilac / Focus Blue:** 四项卡面及对应游戏引导、结果面；各自有着色细边框，榜单当前标签沿用同组颜色。

### Secondary

- **Talent Go:** 反应测试可点击的整面绿色与记忆亮格；绿底信号使用 White 文字。
- **Talent Wait:** 抢点、无效轮次、答错反馈以及颜色干扰题的红墨；当前等待面使用 Panel 与 Ink。
- **Talent Blue / Talent Yellow Ink:** 颜色干扰题的蓝墨与黄墨。黄墨与奶油卡色职责不同。
- **Art Purple / Art Green / Art Red / Art Yellow / Grid Lit:** 卡上数字问号、信号图示、彩点与记忆示意；仅为挑战图示，实际游戏亮格使用 Talent Go。

### Neutral

- **Canvas / Panel:** 暖白页面、答案与淡色等待面。
- **Muted / Subtle:** 说明、标签、非活动导航及滚动条；关键行动和成绩使用 Ink。
- **Line / Soft Line / Card Edge:** 控件边框、表格分隔与默认面板边缘。
- **Grid Paper / Sequence Paper / Button Hover:** 卡上格子、数字片与描边按钮 hover 的半透明白色。
- **Mark Ink:** SVG 标识外框与中心菱形的固定深色。

**The Challenge Identity Rule.** 柔和卡面表示挑战身份；可点击绿色、错误红色与颜色干扰文字表示游戏状态。两者不可互换。

**The Immediate Signal Rule.** 反应变绿和记忆亮格直接切换，不加入颜色过渡；翻面与选择动画不进入玩法计时。

## Typography

**Body Font:** System UI（`system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif）。仅 1–4 答案键提示使用 `ui-monospace, monospace`，没有字体下载。

品牌为 20px / 650，卡片与游戏页标题为 24px / 650 / 1.25，字距均为 −.025em。卡片说明为 16px / 1.5；正文继承 16px / 1.6，辅助说明 14px，状态和元信息 12–13px。游戏引导标题为 28px / 1.2，结果数字使用 `clamp(38px, 5vw, 66px)` / 650 / 1.1；计时器 23px。游戏信号标题与颜色文字各使用 frontmatter 的响应式字号，不成为大厅主标题。

成绩、回合、序列、计时和答案使用 tabular-nums。品牌统一 16px，卡片和页面标题 20px，引导标题 24px。

**The Small Brand Rule.** 品牌使用紧凑文字与四颜色 SVG；大厅大标题保留为辅助技术可读的隐藏 h1。

## Layout

卡片比例以用户后续提供的窄长卡片截图为准；保留既有配色和翻面，不复制参考中的方案说明或状态标签。桌面约 228px 宽、412–446px 高，形成约 1:1.8–2 的细长比例。

壳层纵向铺满至少 100dvh，主内容为可伸展的纵向 flex 容器，大厅以自动纵向外边距居中；header 与 footer 不收缩。正常桌面高度内同时显示导航、四卡与页脚，矮屏或长背面仍按内容自然滚动。按用户后续要求，整体约缩小两成：桌面边距为 `max(24px, calc((100vw - 1120px) / 2))`，卡组最大 1000px，使用独立的 `--talent-deck-inset: max(var(--talent-inset), calc((100vw - 1000px) / 2))` 对齐卡组与两侧箭头；细长品牌栏最小高度 56px、上下内边距 4px。大厅删除开始挑战的短提示及底部“当前选择”／分页圆点栏，保留隐藏 h1、卡组与登录说明；大厅上下内边距 8px，登录说明上间距 8px。轨道 gap 22px、内边距 20px 12px 60px；每卡宽度为 `max(216px, calc((100% - 66px) / 4))`，宽度不足时内部横向滚动并吸附到卡片中心。

| 挑战 | 桌面最小卡高 | 下移 | 倾角 | 760px 以下最小卡高 / 下移 |
| --- | --- | --- | --- | --- |
| reaction | 418px | 32px | −2.5° | 404px / 24px |
| memory | 446px | 0px | +1.8° | 430px / 0px |
| reasoning | 412px | 44px | −1.4° | 396px / 32px |
| focus | 430px | 16px | +2.2° | 416px / 10px |

游戏页采用用户选定的 A「居中舞台」效果图：`.impeccable/mocks/decision/talent-game-layout/a-centered-stage.png`。游戏容器最大 1120px，排行榜容器最大 960px；排行榜保留外边距 24px auto 48px，游戏页使用自动外边距在 header 与 footer 之间居中，上下内边距 20px。返回链接与 24px 游戏标题之间为 1px 竖分隔。游戏区独占一行，舞台最小高度 `clamp(400px, min(62dvh, calc(100dvh - 400px)), 640px)`；玩法与个人最佳置于下方，距舞台 28px，以 `minmax(0, 1.6fr) minmax(0, 1fr)` 排列，gap 32px，水平内边距 16px，右区左边框 1px／左内边距 32px。引导与结果内边距 24px；个人最佳为空且加载成功时使用破折号与真实空状态文案。

- **1000px 以下：** 答案改为两列，导航与账号间距收紧；游戏及其下方信息仍按原结构排列。
- **760px 以下：** 外边距 24px，导航换到完整第二行，账号用户名隐藏；卡宽为 `min(232px, calc(100vw - 72px))`，轨道内边距 `20px max(36px, calc((100vw - 232px) / 2)) 56px`，首尾卡片也能居中，圆箭头置于轨道底部留白内（bottom 8px）并变为 40px，不额外占用状态栏；游戏舞台高度为 `clamp(400px, 62dvh, 480px)`；下方信息改为单列，gap 20px，个人最佳上方改为横分隔／上内边距 20px，游戏标题为 20px。题面高度从 180px 缩至 164px，隐藏重复的剩余时间标签。表格仍为名次／玩家／成绩三列，首列 44px、水平单元格内边距 6px，页脚纵向排列。
- **380px 以下：** 外边距 18px，卡宽沿用 `min(232px, calc(100vw - 72px))`、轨道动态左右留白、gap 22px；卡面 18px 内边距，示意九宫格保持 30px，避免压缩操作按钮。

卡组支持滑动、两侧箭头及左右键；Escape 关闭当前背面，翻面后焦点移至可见面的翻面按钮。隐藏面使用 inert 与 aria-hidden，并绝对定位，不参与卡高计算；可见背面遇到长说明时自然撑高。语言切换保留选择与翻面状态，重新对齐当前卡片。

## Elevation & Depth

卡片与游戏面使用短软阴影：`0 1px 2px oklch(20% .012 250 / .04), 0 6px 12px oklch(20% .012 250 / .06)`。圆箭头使用 `0 1px 3px oklch(20% .012 250 / .06)`，按钮按下使用内阴影 `inset 0 1px 2px oklch(20% .012 250 / .12)`。壳层、规则、排行榜保持平面分隔。

卡片选择通过边框与 Ink 混合 18% 加深；悬停归正为 260ms，翻面为 650ms，使用 `cubic-bezier(.16,1,.3,1)`。3D 视距 1400px，内层保留 3D、背面隐藏。减少动态时移除 transition 与 smooth scroll，卡片只保留静态下移；正反面切换仍可操作。

**The Retained Stagger Rule.** 悬停或键盘聚焦时归正并上移 4px，保留每项卡片的高低差；减少动态时去掉倾斜、保留静态错落。

## Shapes

卡片、游戏舞台与榜单登录提示采用小圆角矩形（9px）；按钮、答案、九宫格和数字片为 6px，标签为 4px。边框统一 1px，只有序列问号框使用虚线。圆形用于彩点和方向按钮。

品牌 SVG 使用 36×36 viewBox、31×31 外框、7px 圆角、1.8 描边；四组短射线为 2.4 圆端描边，中心深色菱形。页面显示尺寸桌面和手机均为 24px。图示采用语义 HTML/CSS/SVG，无交付栅格素材。

## Components

### Buttons / Navigation

实心与描边操作均最小 44px 高、10px 18px 内边距、6px 圆角。实心按钮用 Action 与 Canvas，hover 用 Strong Ink；描边按钮透明底，hover 浅白并加深边框。文字按钮使用 13px Muted、下划线、8px 0 内边距。禁用按钮 opacity .4、默认指针；aria-disabled 导航不降低可读性。键盘焦点使用 2px Ink、offset 4px；反应整面按钮使用 3px currentColor、offset −8px。

独立壳层只含品牌、挑战大厅、排行榜、语言与账号。品牌文字 16px，导航及语言 13px，活动导航用深色与下划线（offset 6px）。手机保持两行，行间距 2px，上下内边距 4px；导航链接最小高 36px。页脚返回课程链接为 inline-flex、gap 6px。共用箭头由 `TalentArrow.tsx` 输出：24×24 viewBox、16px 尺寸、1.5 currentColor 描边，用于两面开始、返回、排行榜和页脚。卡组前后选择另用 20×20 viewBox 的折线，桌面显示 18px。

### Challenge Cards / Tags

同一卡片前后使用相同身份色、边框、圆角和阴影。正面依次显示标题、短说明、挑战图示、3px 8px 描边标签和操作；背面显示规则、计分单位、按键提示及同位置操作。图示为绿色反应信号、亮格九宫格、2/4/8/? 数字片和蓝墨颜色词／四彩点。卡片操作间距 8px；开始按钮为 13px、8px 14px 内边距、44px 最小高；规则为 14px/1.7，辅助说明 13px/1.7。图示反应 SVG 112px、颜色词 56px（手机 52px）、数字片 38×42px。示意九宫格为 3×3、30px 格、gap 5px；它与实际游戏网格不同。

### Gameplay

反应点击区填满舞台剩余空间，最小高度为舞台高度减去 52px 回合条，24px 内边距，整面可点击。等待用 Panel 与深色文字，绿信号用 Talent Go 与白字，抢点和无效轮次用项目卡底与红字，单轮结果回到项目卡底。文字和 SVG 符号始终存在；下方五格回合条使用 Canvas，显示五轮平均耗时所需的真实样本。

顺序记忆为 3×3、gap 10px、最大 260px 宽、6px 圆角；未亮格为 Canvas 与 Muted，亮格和按下为 Talent Go 与白字。每关独立随机新顺序，长度从 1 格增加到 20 格；点错结束，以完整通过关数计分。展示阶段禁用所有格子，文字区分观看与复现阶段；1–9 键提示保留。数字规律与 Stroop 均为 60 秒题面，答案为中性 Canvas 按钮、最小高度 56px、10px 8px 内边距，保留 1–4 键。颜色词承载 red/blue/green/yellow 信号，答案文字不跟随题目染色；反馈用正确绿／错误红。

### Auth / Results / Leaderboard

大厅匿名可读；游玩前等待真实账号状态，未登录回跳登录页并保留 next。排行榜页可切换项目，但成绩内容需登录；未登录显示 Panel 登录提示。准备、进行和保存期间模块链接以 aria-disabled 暂停，语言及结束入口保留。窗口失焦或切到后台显示中断与重启；结果包含大号分数、单位、保存状态，离线可重试，登录过期给登录入口，重玩在保存期间禁用。

每个项目独立榜单，当前标签同时有色面、着色边框和下划线。名次／玩家／成绩为三列表格，14px 主字号、12px 表头／单位、18px 分数。玩家使用真实头像与首字母回退；当前用户为 Panel 行底和“你”标识。加载、接口错误、空榜、刷新和个人最佳使用真实双语状态，不补造人数与成绩。

## Do's and Don'ts

### Do:

- Do 在天赋路由及其专属 UI 文件中使用本设计，课程继续读取全局设计。
- Do 保留四项卡片的身份色、错落、倾角和翻面后的同色背面。
- Do 用深色实心按钮表达开始或重试，用描边或下划线操作表达次级行动。
- Do 为信号保留文字、符号或数字，为选择保留 aria-pressed、下划线和键盘焦点。
- Do 在中英文与手机宽度下保留箭头、横向滑动、语言入口和三列表格。
- Do 用真实加载、错误、空榜、个人最佳及保存状态反馈业务。

### Don't:

- Don't 把旧蓝色待机、红色等待或黄色开始按钮带回新卡片世界。
- Don't 把四卡排成同高、完全平齐的静态矩阵，或恢复大厅巨型标题。
- Don't 为信号添加渐变、淡入或颜色缓动。
- Don't 把示例排名、占位分数或娱乐成绩当作真实测评或能力认证。
- Don't 将本模块的彩色卡面和阴影推广到课程或 Context 页面。
