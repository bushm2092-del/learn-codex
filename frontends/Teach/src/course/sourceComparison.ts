// 已核对两个仓库中的实际相对路径；这里只展示已移植的核心文件。
const paths = ["thread_manager.rs", "client.rs", "session/session.rs", "session/turn.rs", "tools/router.rs"];
export const sourceComparison = {
  zh: {
    mapping: "同名文件，同一职责，逐个对照",
    caption: "已移植核心文件节选。顶层目录按项目映射，core/src 下保留对应路径；并非完整仓库清单。",
    rows: paths.map((path, i) => ({ path, label: ["线程管理", "模型请求", "会话状态", "执行循环", "工具路由"][i]! })),
  },
  en: {
    mapping: "Matching names and responsibilities, file by file",
    caption: "Selected ported core files. The workspace root is mapped; corresponding paths under core/src are preserved. Not a complete repository listing.",
    rows: paths.map((path, i) => ({ path, label: ["Threads", "Model client", "Session state", "Turn loop", "Tool routing"][i]! })),
  },
};
