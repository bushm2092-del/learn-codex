export const LESSON_SOURCE_OPEN = "lesson-source-open";

export type LessonSourceOpen = { lesson: string; path: string };

// 正文里的源码路径通过这个事件打开章节源码面板，避免文章组件持有面板状态。
export function openLessonSource(lesson: string, path: string) {
  window.dispatchEvent(new CustomEvent<LessonSourceOpen>(LESSON_SOURCE_OPEN, { detail: { lesson, path } }));
}
