// 从 lesson/<章节 id> 分支导出各章节对应版本的 mini-codex-rs 源码，生成随前端部署的静态快照。
// 只读取 commit 中被 git 跟踪的文件，工作区里未提交的内容、target/ 与 .env 不会进入快照。
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

function decodeText(buffer) {
  if (buffer.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return undefined;
  }
}

export async function buildSourceSnapshots({ repoRoot, outDir }) {
  const snapshots = listLessonBranches(repoRoot);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "snapshots"), { recursive: true });
  await mkdir(join(outDir, "blobs"), { recursive: true });

  // 不同章节中未修改的文件 blob sha 相同，只写一份。
  const written = new Map();
  for (const snapshot of snapshots) {
    const files = [];
    for (const file of listSourceFiles(repoRoot, snapshot.commit)) {
      if (file.size > MAX_FILE_BYTES) {
        files.push({ ...file, blob: null, skipped: "too_large" });
        continue;
      }
      if (!written.has(file.blob)) {
        const text = decodeText(git(repoRoot, ["cat-file", "blob", file.blob], "buffer"));
        if (text !== undefined) await writeFile(join(outDir, "blobs", `${file.blob}.txt`), text);
        written.set(file.blob, text !== undefined);
      }
      files.push(written.get(file.blob) ? file : { ...file, blob: null, skipped: "binary" });
    }
    await writeFile(join(outDir, "snapshots", `${snapshot.lesson}.json`), JSON.stringify({ ...snapshot, root: SOURCE_ROOT, files }));
  }
  await writeFile(join(outDir, "index.json"), JSON.stringify({ snapshots }));
  return { snapshots, blobs: [...written.values()].filter(Boolean).length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const teachRoot = fileURLToPath(new URL("..", import.meta.url));
  const repoRoot = git(teachRoot, ["rev-parse", "--show-toplevel"]).trim();
  const { snapshots, blobs } = await buildSourceSnapshots({ repoRoot, outDir: join(teachRoot, "public", "source") });
  console.log(`source snapshots from lesson/* branches: ${snapshots.map(s => s.lesson).join(", ") || "(none)"}; ${blobs} blobs`);
}
