import { createContext } from "react";

export type Locale = "zh" | "en";

export const LOCALE_STORAGE_KEY = "learn-codex-locale";

export const messages = {
  zh: {
    navigation: {
      timeline: "时间线",
      architecture: "架构",
      lessons: "课程",
      mainNav: "主导航",
      source: "打开 Codex 源码仓库",
      home: "回到 Learn Codex 首页",
      language: "语言",
      languageMenu: "选择显示语言",
      chinese: "中文",
      english: "English",
    },
    home: {
      note: "从 0 到 1 理解 Codex harness，每次只看清一个运行机制",
      start: "开始学习",
      coreTitle: "核心模式",
      coreDescription: "课程动画会把模型、工具和上下文之间的往返过程拆成可观察步骤。",
      codeAria: "Harness 代码占位区",
      codeComment: "// 具体运行过程将在下一步补充",
      timelineTitle: "执行时间线",
      timelineDescription: "用时间线查看一次 turn 如何推进；当前只保留动画容器。",
      waiting: "[ 等待课程流程 ]",
      pathTitle: "学习路径",
      pathDescription: "从 Harness 总览开始，后续课程会按真实 Codex 调用链逐步展开。",
      catalogAria: "课程目录",
      draft: "草稿",
      draftDescription: "交互架构已经就绪，等待补充流程",
      readyDescription: "可学习",
    },
    lesson: {
      sidebarAria: "课程章节",
      coreGroup: "HARNESS 核心",
      comingNext: "后续课程",
      comingPlaceholder: "后续章节等待规划",
      title: "Harness 运行原理",
      topic: "Harness 核心",
      kicker: "一次 Turn 是怎样真正跑起来的",
      session: "01 会话",
      interactive: "交互演示",
      draft: "草稿",
      summary: "这一节的具体流程尚未写入；当前页面只展示后续动画所使用的舞台与控制结构。",
      stageTitle: "Harness 动画舞台",
      stageStatus: "架构已就绪",
      stageAria: "待填充的 Harness 动画舞台",
      stageWaiting: "等待你提供演示过程",
      stageDescription: "后续步骤会被拆成可控制的 GSAP timeline 场景",
    },
    controls: {
      aria: "动画播放控制",
      play: "播放",
      pause: "暂停",
      restart: "重播",
    },
  },
  en: {
    navigation: {
      timeline: "Timeline",
      architecture: "Architecture",
      lessons: "Lessons",
      mainNav: "Primary navigation",
      source: "Open the Codex source repository",
      home: "Back to the Learn Codex homepage",
      language: "Language",
      languageMenu: "Choose display language",
      chinese: "中文",
      english: "English",
    },
    home: {
      note: "Understand the Codex harness from first principles, one mechanism at a time.",
      start: "Start learning",
      coreTitle: "The Core Pattern",
      coreDescription: "Course animations turn the exchange between model, tools, and context into observable steps.",
      codeAria: "Harness code placeholder",
      codeComment: "// The concrete execution flow comes next",
      timelineTitle: "Execution Timeline",
      timelineDescription: "Inspect how a turn advances over time; this is the animation scaffold for now.",
      waiting: "[ waiting for lesson flow ]",
      pathTitle: "Learning Path",
      pathDescription: "Start with the Harness overview, then follow the real Codex call chain lesson by lesson.",
      catalogAria: "Course catalog",
      draft: "DRAFT",
      draftDescription: "The interaction scaffold is ready for the execution flow.",
      readyDescription: "Ready to learn",
    },
    lesson: {
      sidebarAria: "Course chapters",
      coreGroup: "HARNESS CORE",
      comingNext: "COMING NEXT",
      comingPlaceholder: "More chapters are being planned",
      title: "How the Harness Runs",
      topic: "Harness Core",
      kicker: "How a turn actually comes to life",
      session: "01 SESSION",
      interactive: "INTERACTIVE",
      draft: "DRAFT",
      summary: "The detailed flow has not been added yet; this page currently shows the stage and controls prepared for the animation.",
      stageTitle: "Harness Animation Stage",
      stageStatus: "Architecture ready",
      stageAria: "Harness animation stage awaiting its lesson flow",
      stageWaiting: "Waiting for your walkthrough",
      stageDescription: "The next steps will become controllable scenes in a GSAP timeline.",
    },
    controls: {
      aria: "Animation playback controls",
      play: "Play",
      pause: "Pause",
      restart: "Replay",
    },
  },
} as const;

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  copy: (typeof messages)[Locale];
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);
