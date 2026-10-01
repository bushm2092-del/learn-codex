---
version: 1
slug: talent-color-cards
primary_target: frontends/teach/src/talent/TalentHomePage.tsx
related_targets: [frontends/teach/src/ui/TalentShell.tsx, frontends/teach/src/ui/TalentChallengeCards.tsx, frontends/teach/src/ui/TalentTests.css, frontends/teach/src/talent/TalentPage.tsx, frontends/teach/src/talent/TalentLeaderboardPage.tsx]
---

# 天赋测试 · 彩色挑战卡

Mode: Operate。用户确认彩色错落卡片效果图并授权实现正式模块。沿用账号、玩法、成绩接口，登录后才能玩。中英文和手机可操作。

Approved reference: `frontends/teach/.impeccable/concepts/talent-color-stagger.png`。本轮为已确定卡片世界的代码实现；像素中的文字、图标、格子与平面卡片均用语义 HTML/CSS/SVG 表达，没有图片材质或插画需要作为栅格交付。

## Direction contract

THESIS: 四种柔和彩色的挑战卡，以高低错落与独立小倾角表达可选玩法；去掉大厅大标题。

OWN-WORLD: 暖白页面，薄荷绿、奶油黄、淡紫、浅蓝卡面；细着色边框、9px 卡角、短软阴影、系统字型和描边按钮。四颜色放射 SVG 配小号品牌。与课程框架独立。

STORY: 先看四卡，左右选、翻面读玩法，再进入登录后的挑战。游戏区域聚焦计时与答案，结果保存到现有个人最佳和独立排行榜。

FIRST VIEWPORT: 紧凑单行品牌与导航；一行完整四卡，记忆卡最高、思考卡最低、其他两卡在中间；图示为绿信号、九宫格、2/4/8/?、蓝墨红字；两侧圆箭头、下方项目点。手机横向滑动并保留箭头、语言入口。

FORM: 用户指定灰卡交互，随后批准彩色错落效果图；覆盖此前灰色预览规范。悬停归正仍保留高低差，翻面显示规则；减少动态时保持静态可操作。新增独立 SVG 标识。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 后续尺寸调整

用户于 2026-10-01 要求整体缩小，并进一步降低 header 高度。此指令覆盖批准效果图中的原尺寸：桌面卡组最大 1120px，卡高 352–392px，header 最小 56px／上下内边距 4px、品牌 16px／SVG 24px。保留四颜色、错落、倾角和翻面；长背面按内容自然撑高。

## 窄长卡片比例

用户后续以灰色方案卡截图指定细长比例。仅采用几何比例：桌面卡组最大 1000px，典型卡宽约 228px，卡高 412–446px；手机卡宽上限 232px、卡高 396–430px，首尾保持居中。配色、倾角、错落和 56px header 延续当前实现。用户要求不运行浏览器自动化，验证限于源码、类型检查和构建。

## 一屏大厅布局

用户要求删除“选一张卡片，开始挑战。”，让 header、content、footer 同时出现。大厅在壳层的纵向 flex 内容区居中，上下内边距改为 8px，卡轨道改为 20px 12px 60px，登录说明上间距 8px；保留卡片尺寸、错落、配色与翻面。矮屏、放大或长背面按内容自然滚动，不固定裁剪。按用户要求直接修改，不使用子代理或浏览器自动化；验证为源码检查、类型检查及构建。

## 游戏页 · 居中舞台

用户选定第一张布局图 A，并授权修改：`.impeccable/mocks/decision/talent-game-layout/a-centered-stage.png`。四项游戏统一为 960px 居中舞台，下方并列玩法与个人最佳，以细竖线分隔；手机改为下方纵向信息区。舞台随视口高度在 320–420px 之间适配，手机 340px；成绩、计时、抢点、失焦、登录及保存状态继续使用现有真实逻辑。验证限于源码、类型检查与构建，不使用子代理和浏览器自动化。

## 游戏主区域放大

用户要求游戏内容占据更多空间。保留 A 的居中舞台与下方信息结构，游戏页宽度上限由 960px 增至 1120px，舞台以 52dvh 为目标、最高 520px，并按视口剩余空间收紧；手机舞台为 360–420px。只调整游戏主区域的空间比例。

用户随后要求继续增高：桌面舞台改为 400–640px、目标 62dvh，手机改为 400–480px。宽度与布局保持当前值；高度不足时允许正常页面滚动。
