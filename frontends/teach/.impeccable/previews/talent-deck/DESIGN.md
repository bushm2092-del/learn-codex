---
name: 天赋测试 · 卡片交互预览
description: 灰色卡片、描边控件与可翻面的本地挑战预览。
colors:
  paper: "oklch(97.8% 0 0)"
  raised: "oklch(99.5% 0 0)"
  gray: "oklch(92% 0 0)"
  gray-2: "oklch(88% 0 0)"
  ink: "oklch(13% 0 0)"
  text: "oklch(22% 0 0)"
  muted: "oklch(46% 0 0)"
  rule: "oklch(13% 0 0 / .16)"
  edge: "oklch(13% 0 0 / .48)"
  green: "#287548"
  red: "#9d3434"
  blue: "#315eb4"
  yellow: "#806100"
  signal-text: "#fff"
typography:
  headline:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(28px, 3vw, 38px)"
    fontWeight: 620
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "23px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-.02em"
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    lineHeight: 1.6
  button:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 570
    lineHeight: 1.6
  result:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(46px, 6vw, 72px)"
    fontWeight: 650
    lineHeight: 1.2
rounded:
  tag: "4px"
  signal: "5px"
  control: "6px"
  surface: "9px"
  circle: "50%"
spacing:
  tag-gap: "6px"
  control-gap: "12px"
  action-inline: "18px"
  card: "24px"
  stage: "32px"
components:
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-outline-hover:
    backgroundColor: "{colors.gray-2}"
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.raised}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.gray}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "{spacing.card}"
  tag:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  pager:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.circle}"
    width: "44px"
    height: "44px"
  play-surface:
    backgroundColor: "{colors.gray}"
    rounded: "{rounded.surface}"
    padding: "{spacing.stage}"
  signal-green:
    backgroundColor: "{colors.green}"
    textColor: "{colors.signal-text}"
    rounded: "{rounded.signal}"
---

# Design System: 天赋测试 · 卡片交互预览

## Overview

**Creative North Star: "灰纸挑战卡"**

轻微倾斜的灰卡像一组可以拿起、归正、翻看的挑战卡。系统字体、细描边与软阴影保持安静，题目和操作承担主要注意力；彩色只服务游戏信号。

本文件只约束 `frontends/teach/.impeccable/previews/talent-deck/` 的独立静态预览。数值从 `styles.css` 提取；前置 token 是规范，阴影、动态和断点保存在 `.impeccable/design.json`。不改写教学站或正式 `/talent` 的设计体系。

**Key Characteristics:**

- 中性灰卡、细边框和轻软阴影。
- 选中、悬停或聚焦时卡片归正；翻面展示玩法。
- 描边行动、圆形切换键、可见项目指示。
- 中英文可操作，移动端保留原生横向滑动。

## Colors

### Primary

深墨 `ink` 用于标题和焦点，正文墨色 `text` 用于正文与实心开始按钮。绿色用于反应信号；红、蓝、绿、黄用于颜色干扰题，绿色信号上的文字使用 `signal-text`。

### Neutral

`paper` 是页面底色，`raised` 是箭头和答案按钮底色，`gray` 是挑战卡与试玩面，`gray-2` 是按钮悬停和待机格子。`muted` 承担规则、标签和次要说明；`rule` 是常态细线，`edge` 强化选中或悬停描边。

**The Game Signal Rule.** 游戏色只表达真实信号或题目，不成为导航、挑战卡或排行榜的装饰底色。

## Typography

标题、正文和标签均用系统无衬线；数字成绩、序列与计时使用等宽数字宽度，答案键提示用 `ui-monospace, monospace`。标题层级与结果字号见前置 token。卡片说明使用（17px / 1.5），规则使用（14px / 1.6）；大标题不承担营销海报式的视觉重量。

## Layout

大厅是单行横向卡组：卡宽（`clamp(284px, 22vw, 342px)`），卡间距沿用 card 间距；卡片正背面最低高度（454px）。页面侧边距为（`max(32px, calc((100vw - 1440px) / 2))`）；试玩与排行榜容器最大宽度（1120px）。

在（760px）及以下，侧边距改为（24px），导航换行，卡宽为（`min(310px, calc(100vw - 64px))`），最低高度（430px）；圆形切换键移到卡组下方，答案网格从四列改为两列。在（380px）及以下，侧边距为（18px）。在（1700px）及以上，卡宽固定（342px）。

## Elevation & Depth

卡片和试玩面使用多层轻软阴影，圆形切换键使用顶部高光与短阴影；按下普通按钮有内阴影。阴影完整值在侧车记录，边框仍承担主要的状态辨识。卡片初始倾斜依次为（−.65° / .8° / −.6° / .65°）；选中、悬停和聚焦归正并上移（4px）。

**The Controlled Motion Rule.** 归正使用（260ms），翻面使用（650ms）与同一缓出曲线。减少动态时取消过渡、平滑滚动和卡片倾斜；游戏信号直接切换颜色。

## Shapes

卡片与试玩面沿用 surface 圆角，按钮与答案格沿用 control 圆角，标签沿用 tag 圆角。圆形只用于切换键、项目指示与反应玩法示意。容器和控件采用（1px）细边框。

## Components

- **按钮：** 大厅以描边按钮进入挑战；开始与重试使用实心墨色按钮。最小高度（44px）；辅助玩法入口是带下划线的文本按钮。键盘焦点为（2px）深墨描边，外偏（4px）；禁用态透明度（.35）。
- **挑战卡：** 灰面、轻软阴影、细描边。翻面绕 Y 轴（180°），透视（1400px）；隐藏一面通过 `inert` 和 `aria-hidden` 退出操作与阅读，焦点随翻面进入可见面的返回按钮。
- **切换与导航：** 桌面箭头（44px），移动端（40px）；指示按钮为（26px）触达区域与（6px）圆点，当前项实心。当前导航使用深墨文字和下划线，不能仅靠颜色识别。
- **游戏与结果：** 反应力用整面绿色信号；记忆力用 3×3 中性格；规律与颜色题用中央题面和四项答案。结果保留数值、单位、重试与返回；排行榜呈现明确的空状态。

## Do's and Don'ts

### Do:

- **Do** 保留灰卡、细边框、软阴影与描边行动的组合。
- **Do** 同时提供可见焦点、当前项标记、键盘操作与减少动态支持。
- **Do** 用真实中英文内容检验卡面、答案和移动端换行。

### Don't:

- **Don't** 将游戏色扩散成大厅或导航的装饰配色。
- **Don't** 把预览成绩或空排行榜描述为已保存的账号数据。
- **Don't** 将本预览的设计记录推广为课程或正式模块的全站规则。
