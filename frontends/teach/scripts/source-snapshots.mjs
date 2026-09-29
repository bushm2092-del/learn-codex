// 从 lesson/<章节 id> 分支导出各章节对应版本的 mini-codex-rs 源码，生成随前端部署的静态快照。
// 只读取 commit 中被 git 跟踪的文件，工作区里未提交的内容、target/ 与 .env 不会进入快照。
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_ROOT = "mini-codex-rs";
// 读取本地分支：快照内容取决于执行构建的这台机器上 lesson/* 分支的状态。
export const BRANCH_REFS = "refs/heads/lesson/";
export const MAX_FILE_BYTES = 512 * 1024;
const LESSON_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function git(repoRoot, args, encoding = "utf8") {
  return execFileSync("git", args, { cwd: repoRoot, encoding, maxBuffer: 64 * 1024 * 1024 });
}

function listLessonBranches(repoRoot) {
  const output = git(repoRoot, ["for-each-ref", "--sort=refname", "--format=%(refname) %(objectname)", BRANCH_REFS]);
  return output.split("\n").filter(Boolean).map(line => {
    const [refname, commit] = line.split(" ");
    const lesson = refname.slice(BRANCH_REFS.length);
    const branch = `lesson/${lesson}`;
    if (!LESSON_ID.test(lesson)) throw new Error(`Invalid lesson branch: ${branch}`);
    return { lesson, branch, commit };
  });
}

// 普通文件（100644/100755）才导出；符号链接与子模块不属于可展示的源码。
function listSourceFiles(repoRoot, commit) {
  const output = git(repoRoot, ["ls-tree", "-r", "-l", "-z", commit, "--", `${SOURCE_ROOT}/`]);
  return output.split("\0").filter(Boolean).flatMap(entry => {
    const [meta, path] = entry.split("\t");
    const [mode, type, blob, size] = meta.split(/\s+/);
    if (type !== "blob" || (mode !== "100644" && mode !== "100755")) return [];
    return [{ path: path.slice(SOURCE_ROOT.length + 1), blob, size: Number(size) }];
  });
}

// 文件树图标沿用 Material Icon Theme 的名称映射（light 变体优先）。映射表约 450 KB，
// 只在生成快照时解析，并仅复制用到的 SVG；未安装该包时不生成图标，前端退回无图标样式。
function loadIconTheme() {
  const require = createRequire(import.meta.url);
  try {
    const manifestPath = require.resolve("material-icon-theme/dist/material-icons.json");
    return { manifest: require(manifestPath), dir: dirname(manifestPath) };
  } catch {
    return undefined;
  }
}

function themeLookup(manifest, table, key) {
  return manifest.light?.[table]?.[key] ?? manifest[table][key];
}

function fileIcon(manifest, path) {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const parts = name.split(".");
  let icon = themeLookup(manifest, "fileNames", name);
  for (let i = 1; !icon && i < parts.length; i++) icon = themeLookup(manifest, "fileExtensions", parts.slice(i).join("."));
  return icon ?? manifest.file;
}

function dirIcons(manifest, path) {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  return [themeLookup(manifest, "folderNames", name) ?? manifest.folder, themeLookup(manifest, "folderNamesExpanded", name) ?? manifest.folderExpanded];
}

function decodeText(buffer) {
  if (buffer.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

export async function buildSourceSnapshots({ repoRoot, outDir, iconTheme = loadIconTheme() }) {
  const snapshots = listLessonBranches(repoRoot);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "snapshots"), { recursive: true });
  await mkdir(join(outDir, "blobs"), { recursive: true });

  // 不同章节中未修改的文件 blob sha 相同，只写一份。
  const written = new Map();
  const icons = new Set();
  for (const snapshot of snapshots) {
    const files = [];
    for (const file of listSourceFiles(repoRoot, snapshot.commit)) {
      const entry = iconTheme ? { ...file, icon: fileIcon(iconTheme.manifest, file.path) } : file;
      if (file.size > MAX_FILE_BYTES) {
        files.push({ ...entry, blob: null, skipped: "too_large" });
        continue;
      }
      if (!written.has(file.blob)) {
        const text = decodeText(git(repoRoot, ["cat-file", "blob", file.blob], "buffer"));
        if (text !== undefined) await writeFile(join(outDir, "blobs", `${file.blob}.txt`), text);
        written.set(file.blob, text !== undefined);
      }
      files.push(written.get(file.blob) ? entry : { ...entry, blob: null, skipped: "binary" });
    }
    const data = { ...snapshot, root: SOURCE_ROOT, files };
    if (iconTheme) {
      const paths = new Set(files.flatMap(file => file.path.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
      data.dirs = Object.fromEntries([...paths].sort().map(path => [path, dirIcons(iconTheme.manifest, path)]));
      files.forEach(file => icons.add(file.icon));
      Object.values(data.dirs).flat().forEach(icon => icons.add(icon));
    }
    await writeFile(join(outDir, "snapshots", `${snapshot.lesson}.json`), JSON.stringify(data));
  }
  if (iconTheme && icons.size) {
    await mkdir(join(outDir, "icons"), { recursive: true });
    for (const icon of icons) await copyFile(resolve(iconTheme.dir, iconTheme.manifest.iconDefinitions[icon].iconPath), join(outDir, "icons", `${icon}.svg`));
  }
  await writeFile(join(outDir, "index.json"), JSON.stringify({ snapshots }));
  return { snapshots, blobs: [...written.values()].filter(Boolean).length, icons: icons.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const teachRoot = fileURLToPath(new URL("..", import.meta.url));
  const repoRoot = git(teachRoot, ["rev-parse", "--show-toplevel"]).trim();
  const { snapshots, blobs, icons } = await buildSourceSnapshots({ repoRoot, outDir: join(teachRoot, "public", "source") });
  console.log(`source snapshots from lesson/* branches: ${snapshots.map(s => s.lesson).join(", ") || "(none)"}; ${blobs} blobs; ${icons} icons`);
}
