import type { LocalLessonSource } from "../../ui/LessonSourceButton";
import data from "virtual:context-source";

// Vite 从同一份白名单工作区输入生成源码、Material 图标和 SCIP 跳转表。
export const contextSource: LocalLessonSource = {
  snapshot: data.snapshot,
  loadFile: async path => (await import("virtual:context-source-content")).default.texts[path],
  loadRefs: async path => (await import("virtual:context-source-content")).default.refs[path],
  iconUrl: icon => data.icons[icon],
};
