---
version: 1
slug: "frontends-teach-src-talent-talentpage-tsx"
primary_target: "frontends/teach/src/talent/TalentPage.tsx"
related_targets: ["frontends/teach/src/ui/TalentTests.css"]
---

# 天赋测试

Mode: Operate。课程间隙的登录用户完成短挑战，查看该项个人最佳与排名。独立于学习打卡；中英文切换保留正在进行的挑战。

## Direction contract

THESIS: 四种可重复的短测试共用一个实验台；选择项目、读规则、开始、查看成绩与榜单。

OWN-WORLD: 继承 Learn Codex 白底、黑字、细边框、系统字体。游戏舞台承担信号色：反应力的蓝色待机、红色等待、绿色点击来自用户参考。

STORY: 登录后在项目导航选择测试。反应力完成五轮；顺序记忆逐关加长；规律判断与颜色干扰各 60 秒。结束时自动保存，失败可重试同一成绩。

FIRST VIEWPORT: 顶部大标题与简短说明，下方四项横向导航；左侧宽游戏舞台，右侧规则与个人最佳；排行榜在舞台下。手机单列，导航两行，无横向滚动。

FORM: 用户指定交互的现有站点扩展，直接实现，无概念抽签。标志性交互为整面舞台即时变色与九宫格有节奏的顺序闪烁；反应信号不做过渡动画。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
