# Learn Codex

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
