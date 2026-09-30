import { useEffect, useState } from "react";

// 数据由 scripts/source-snapshots.mjs 按本地 lesson/<章节 id> 分支生成，随前端静态部署。
// refs 为跳转表文件名；构建机缺少 rust-analyzer 或文件没有可跳转标识符时缺省。
export type SourceFile = { path: string; blob: string | null; size: number; skipped?: "binary" | "too_large"; icon?: string; refs?: string };
// targets 为 [路径, 行, 列]，refs 为 [行, 起始列, 结束列, target 下标]；行列从 0 开始，列按 UTF-16 计。
export type SourceRefs = { targets: [string, number, number][]; refs: [number, number, number, number][] };
export type SnapshotEntry = { lesson: string; branch: string; commit: string };
// dirs 为目录路径到 [收起, 展开] 图标名的映射；构建机未安装图标主题时缺省。
export type SourceSnapshot = SnapshotEntry & { root: string; files: SourceFile[]; dirs?: Record<string, [string, string]> };

const base = `${import.meta.env.BASE_URL}source`;
const REPOSITORY = "https://github.com/bushm2092-del/learn-codex";

// 按快照提交生成固定链接，与面板展示的内容一致；该提交需已推送到 GitHub 才能打开。
export function sourceFileUrl(entry: SnapshotEntry, path: string) {
  return `${REPOSITORY}/blob/${entry.commit}/mini-codex-rs/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function sourceTreeUrl(entry: SnapshotEntry) {
  return `${REPOSITORY}/tree/${entry.commit}/mini-codex-rs`;
}
let index: Promise<SnapshotEntry[]> | undefined;
const snapshots = new Map<string, Promise<SourceSnapshot>>();
const blobs = new Map<string, Promise<string>>();
const refTables = new Map<string, Promise<SourceRefs>>();

// 开发服务器与 nginx 的 SPA 回退都可能以 200 返回 index.html，不能把它当作快照内容。
async function fetchStatic(path: string) {
  const response = await fetch(`${base}/${path}`);
  if (!response.ok || response.headers.get("content-type")?.startsWith("text/html")) throw new Error(`source snapshot unavailable: ${path}`);
  return response;
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let value = cache.get(key);
  if (!value) {
    value = load().catch(error => { cache.delete(key); throw error; });
    cache.set(key, value);
  }
  return value;
}

function loadIndex() {
  index ??= fetchStatic("index.json")
    .then(response => response.json() as Promise<{ snapshots: SnapshotEntry[] }>)
    .then(data => data.snapshots)
    .catch(() => []);
  return index;
}

export function loadSnapshot(lesson: string) {
  return cached(snapshots, lesson, () => fetchStatic(`snapshots/${lesson}.json`).then(response => response.json() as Promise<SourceSnapshot>));
}

export function sourceIconUrl(icon: string) {
  return `${base}/icons/${icon}.svg`;
}

export function loadSourceBlob(blob: string) {
  return cached(blobs, blob, () => fetchStatic(`blobs/${blob}.txt`).then(response => response.text()));
}

export function loadSourceRefs(refs: string) {
  return cached(refTables, refs, () => fetchStatic(`refs/${refs}.json`).then(response => response.json() as Promise<SourceRefs>));
}

// 没有快照或清单不可用时返回 undefined，调用方据此不展示源码入口。
export function useLessonSnapshot(lesson: string | undefined) {
  const [entry, setEntry] = useState<SnapshotEntry>();
  useEffect(() => {
    let active = true;
    setEntry(undefined);
    if (lesson) loadIndex().then(entries => { if (active) setEntry(entries.find(item => item.lesson === lesson)); });
    return () => { active = false; };
  }, [lesson]);
  return entry;
}
