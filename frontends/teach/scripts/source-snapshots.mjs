// 从 lesson/<章节 id> 分支导出各章节对应版本的 mini-codex-rs 源码，生成随前端部署的静态快照。
// 只读取 commit 中被 git 跟踪的文件，工作区里未提交的内容、target/ 与 .env 不会进入快照。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_ROOT = "mini-codex-rs";
// 读取本地分支：快照内容取决于执行构建的这台机器上 lesson/* 分支的状态。
export const BRANCH_REFS = "refs/heads/lesson/";
export const MAX_FILE_BYTES = 512 * 1024;
// 跳转表格式变化时递增，使旧的按提交缓存失效。
const REFS_CACHE_VERSION = 1;
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

// SCIP 索引是 protobuf；这里只解码跳转需要的字段：Index.documents(2)，
// Document.relative_path(1)/occurrences(2)/position_encoding(6)，Occurrence.range(1)/symbol(2)/symbol_roles(3)。
function readVarint(buffer, cursor) {
  let value = 0;
  for (let scale = 1; ; scale *= 128) {
    const byte = buffer[cursor.pos++];
    value += (byte & 0x7f) * scale;
    if (byte < 0x80) return value;
  }
}

function* protoFields(buffer, start = 0, end = buffer.length) {
  const cursor = { pos: start };
  while (cursor.pos < end) {
    const key = readVarint(buffer, cursor);
    const field = Math.floor(key / 8);
    const wire = key & 7;
    if (wire === 0) yield { field, value: readVarint(buffer, cursor) };
    else if (wire === 2) {
      const length = readVarint(buffer, cursor);
      yield { field, start: cursor.pos, end: cursor.pos + length };
      cursor.pos += length;
    } else if (wire === 1) cursor.pos += 8;
    else if (wire === 5) cursor.pos += 4;
    else throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}

function packedVarints(buffer, { start, end }) {
  const cursor = { pos: start };
  const values = [];
  while (cursor.pos < end) values.push(readVarint(buffer, cursor));
  return values;
}

export function decodeScip(buffer) {
  const text = ({ start, end }) => buffer.toString("utf8", start, end);
  const documents = [];
  for (const item of protoFields(buffer)) {
    if (item.field !== 2) continue;
    const document = { path: "", encoding: 0, occurrences: [] };
    for (const part of protoFields(buffer, item.start, item.end)) {
      if (part.field === 1) document.path = text(part);
      else if (part.field === 6) document.encoding = part.value;
      else if (part.field === 2) {
        const occurrence = { range: [], symbol: "", roles: 0 };
        for (const field of protoFields(buffer, part.start, part.end)) {
          if (field.field === 1) occurrence.range.push(...(field.value === undefined ? packedVarints(buffer, field) : [field.value]));
          else if (field.field === 2) occurrence.symbol = text(field);
          else if (field.field === 3) occurrence.roles = field.value;
        }
        document.occurrences.push(occurrence);
      }
    }
    documents.push(document);
  }
  return { documents };
}

const SCIP_DEFINITION = 1;
const SCIP_UTF16 = 2;
const SCIP_UTF32 = 3;

// 前端按 JS 字符串（UTF-16）切分高亮 token；rust-analyzer 输出 UTF-8 字节列，中文注释之后必须换算。
function toUtf16(line, column, encoding) {
  if (encoding === SCIP_UTF16) return column;
  if (encoding === SCIP_UTF32) return [...line].slice(0, column).join("").length;
  return Buffer.from(line).subarray(0, column).toString().length;
}

// 输出每个文件的跳转表：targets 为 [路径, 行, 列]，refs 为 [行, 起始列, 结束列, target 下标]，行列从 0 开始。
// SCIP range 为 [行, 起始列, 结束列] 或 [起始行, 起始列, 结束行, 结束列]；跨行的引用不生成链接。
export function buildRefs(index, texts) {
  const lines = new Map([...texts].map(([path, text]) => [path, text.split("\n")]));
  const documents = index.documents.filter(document => lines.has(document.path));
  const position = (document, line, column) => [line, toUtf16(lines.get(document.path)[line] ?? "", column, document.encoding)];
  // local 符号只在所属文件内唯一。
  const key = (document, symbol) => (symbol.startsWith("local ") ? `${document.path}\0${symbol}` : symbol);

  const definitions = new Map();
  for (const document of documents) {
    for (const { range, symbol, roles } of document.occurrences) {
      if (!symbol || !(roles & SCIP_DEFINITION) || definitions.has(key(document, symbol))) continue;
      definitions.set(key(document, symbol), [document.path, ...position(document, range[0], range[1])]);
    }
  }

  const result = new Map();
  for (const document of documents) {
    const targets = [];
    const targetIndex = new Map();
    const refs = [];
    for (const { range, symbol, roles } of document.occurrences) {
      if (roles & SCIP_DEFINITION || (range.length === 4 && range[0] !== range[2])) continue;
      const target = definitions.get(key(document, symbol));
      if (!target) continue;
      const id = target.join("\0");
      if (!targetIndex.has(id)) {
        targetIndex.set(id, targets.length);
        targets.push(target);
      }
      const [line, start] = position(document, range[0], range[1]);
      refs.push([line, start, position(document, range[0], range.at(-1))[1], targetIndex.get(id)]);
    }
    refs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    // 宏展开可能产生重叠区间，前端要求同一行的链接互不重叠。
    const links = refs.filter((ref, i) => ref[2] > ref[1] && (i === 0 || refs[i - 1][0] !== ref[0] || refs[i - 1][2] <= ref[1]));
    if (links.length) result.set(document.path, { targets, refs: links });
  }
  return result;
}

// 解包提交中的 mini-codex-rs 后运行 rust-analyzer scip，只索引已提交内容，不读取工作区。
export async function rustAnalyzerIndexer(repoRoot, commit, workDir) {
  git(repoRoot, ["archive", "--format=tar", "-o", join(workDir, "source.tar"), commit, SOURCE_ROOT]);
  execFileSync("tar", ["-xf", "source.tar"], { cwd: workDir });
  const output = join(workDir, "index.scip");
  execFileSync("rust-analyzer", ["scip", ".", "--output", output], { cwd: join(workDir, SOURCE_ROOT), stdio: "ignore" });
  return decodeScip(await readFile(output));
}

// 索引耗时较长，按提交缓存；失败时只提示，该章节源码仍可浏览，只是没有跳转。
async function snapshotRefs({ repoRoot, snapshot, texts, indexer, cacheDir }) {
  const cachePath = cacheDir && join(cacheDir, `${snapshot.commit}.v${REFS_CACHE_VERSION}.json`);
  if (cachePath) {
    try {
      return new Map(Object.entries(JSON.parse(await readFile(cachePath, "utf8"))));
    } catch { /* 未缓存 */ }
  }
  const workDir = await mkdtemp(join(tmpdir(), "source-refs-"));
  try {
    const refs = buildRefs(await indexer(repoRoot, snapshot.commit, workDir), texts);
    if (cachePath) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cachePath, JSON.stringify(Object.fromEntries(refs)));
    }
    return refs;
  } catch (error) {
    console.warn(`source snapshots: ${snapshot.branch} has no definition links (${error.message})`);
    return new Map();
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function buildSourceSnapshots({ repoRoot, outDir, iconTheme = loadIconTheme(), indexer = rustAnalyzerIndexer, cacheDir }) {
  const snapshots = listLessonBranches(repoRoot);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "snapshots"), { recursive: true });
  await mkdir(join(outDir, "blobs"), { recursive: true });
  if (indexer) await mkdir(join(outDir, "refs"), { recursive: true });

  // 不同章节中未修改的文件 blob sha 相同，只写一份；跳转表以内容 sha 命名，同样去重。
  const written = new Map();
  const writtenRefs = new Set();
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
        written.set(file.blob, text);
      }
      files.push(written.get(file.blob) !== undefined ? entry : { ...entry, blob: null, skipped: "binary" });
    }
    if (indexer) {
      const texts = new Map(files.filter(file => file.blob).map(file => [file.path, written.get(file.blob)]));
      const refs = await snapshotRefs({ repoRoot, snapshot, texts, indexer, cacheDir });
      for (const file of files) {
        if (!refs.has(file.path)) continue;
        const json = JSON.stringify(refs.get(file.path));
        file.refs = createHash("sha1").update(json).digest("hex");
        if (!writtenRefs.has(file.refs)) await writeFile(join(outDir, "refs", `${file.refs}.json`), json);
        writtenRefs.add(file.refs);
      }
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
  return { snapshots, blobs: [...written.values()].filter(text => text !== undefined).length, icons: icons.size, refs: writtenRefs.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const teachRoot = fileURLToPath(new URL("..", import.meta.url));
  const repoRoot = git(teachRoot, ["rev-parse", "--show-toplevel"]).trim();
  const cacheDir = join(teachRoot, "node_modules", ".cache", "source-refs");
  const { snapshots, blobs, icons, refs } = await buildSourceSnapshots({ repoRoot, outDir: join(teachRoot, "public", "source"), cacheDir });
  console.log(`source snapshots from lesson/* branches: ${snapshots.map(s => s.lesson).join(", ") || "(none)"}; ${blobs} blobs; ${refs} ref tables; ${icons} icons`);
}
