---
version: 1
slug: "mpeccable-previews-talent-deck-index-html-39392a51"
primary_target: "frontends/teach/.impeccable/previews/talent-deck/index.html"
related_targets: ["frontends/teach/.impeccable/previews/talent-deck/styles.css","frontends/teach/.impeccable/previews/talent-deck/preview.js"]
---

# 天赋测试卡片交互预览

Mode: Operate。用户先查看独立模块的视觉和交互效果；正式模块的登录、成绩 API 和排行榜数据暂不接入此预览。范围为静态预览 HTML/CSS/JavaScript，保留原四项玩法语义，展示真实本地试玩结果并明确不保存。

## Direction contract

THESIS: 用户选中了方案选择页本身的灰色卡片与交互，将其转为四项测试的选择大厅。

OWN-WORLD: 直接继承参考页 paper/instruments 的中性 OKLCH 灰阶、系统字型、细边框、9px 卡片、轻偏移软阴影、描边按钮与圆形切换键；游戏信号是唯一语义颜色。

STORY: 左右切换或点选挑战；翻面读玩法；进入试玩；查看本轮结果；排行榜明确为空状态预览。手机保留原生滑动和可见切换键，中英文均可操作。

FIRST VIEWPORT: 小型独立品牌与挑战/排行榜入口，下方适中标题、短说明；四张文字灰卡片单行轻微倾斜，选中卡片归正并突出描边；圆形箭头位于两侧，项目指示与当前选择在下方。没有课程导航。

FORM: 用户截图与 http://127.0.0.1:49565/ 的实际 CSS 是明确指定的世界，覆盖此前 adb59107 的掌机候选。采用原生代码交互预览，签名为卡片归正与前后翻面；减少动态时取消倾斜与过渡。不生成新的页面图片。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
