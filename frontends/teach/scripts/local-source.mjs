// 当前工作区章节沿用提交快照的图标与 SCIP 定义索引；源码和引用从同一份输入生成。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, mkdtemp, rm, mkdir, writeFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildRefs, decodeScip, loadIconTheme, fileIcon, dirIcons, MAX_FILE_BYTES } from "./source-snapshots.mjs";

export function isLocalSource(path) {
  return path === "Cargo.toml" || path === "Cargo.lock" || path === "README.md" || path === "crates/models-manager/models.json" ||
    (path.startsWith("crates/") && (path.endsWith(".rs") || path.endsWith("/Cargo.toml") ||
      (path.startsWith("crates/prompts/templates/compact/") && path.endsWith(".md"))));
}

export async function buildLocalSource({ root, cacheDir, indexer, iconTheme = loadIconTheme() }) {
  const texts = new Map();
  // 不递归 target，不跟随符号链接，也不读取 .env；仅收集允许展示的普通文件。
  const candidates = ["Cargo.toml", "Cargo.lock", "README.md", ...(await readdir(join(root, "crates"), { recursive: true })).map(p => `crates/${p}`)];
  for (const path of candidates.filter(isLocalSource).sort()) {
    const stat = await lstat(join(root, path));
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
    texts.set(path, await readFile(join(root, path), "utf8"));
  }
  const digest = createHash("sha256").update(JSON.stringify([...texts])).digest("hex");
  const cachePath = cacheDir && join(cacheDir, `${digest}.v2.json`);
  let refs;
  try { refs = new Map(Object.entries(JSON.parse(await readFile(cachePath, "utf8")))); } catch { /* 无缓存 */ }
  if (!refs) {
    const workDir = await mkdtemp(join(tmpdir(), "local-source-"));
    try {
      // 对展示输入创建隔离工作副本，防止生成索引期间的编辑造成行号与源码错位。
      for (const [path, text] of texts) {
        const destination = join(workDir, path);
        await mkdir(resolve(destination, ".."), { recursive: true });
        await writeFile(destination, text);
      }
      const output = join(workDir, "index.scip");
      const index = indexer ? await indexer(workDir) : await (async () => {
        execFileSync("rust-analyzer", ["scip", ".", "--output", output], { cwd: workDir, stdio: "ignore" });
        return decodeScip(await readFile(output));
      })();
      refs = buildRefs(index, texts);
      if (cachePath) {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cachePath, JSON.stringify(Object.fromEntries(refs)));
      }
    } finally { await rm(workDir, { recursive: true, force: true }); }
  }
  const files = [...texts].map(([path, text]) => ({ path, blob: path, size: Buffer.byteLength(text),
    ...(iconTheme ? { icon: fileIcon(iconTheme.manifest, path) } : {}), ...(refs.has(path) ? { refs: path } : {}) }));
  const dirs = {};
  const icons = {};
  if (iconTheme) {
    for (const file of files) {
      const parts = file.path.split("/").slice(0, -1);
      parts.forEach((_, i) => { const path = parts.slice(0, i + 1).join("/"); dirs[path] = dirIcons(iconTheme.manifest, path); });
    }
    const names = new Set([...files.map(f => f.icon), ...Object.values(dirs).flat()]);
    for (const name of names) {
      const svg = await readFile(resolve(iconTheme.dir, iconTheme.manifest.iconDefinitions[name].iconPath));
      icons[name] = `data:image/svg+xml;base64,${svg.toString("base64")}`;
    }
  }
  return { snapshot: { lesson: "context", branch: "codex/lesson-context", commit: "", root: "mini-codex-rs", files, dirs },
    texts: Object.fromEntries(texts), refs: Object.fromEntries(refs), icons };
}

export function localSourcePlugin(root, cacheDir) {
  const id = "virtual:context-source";
  const resolvedId = `\0${id}`;
  const contentId = `${id}-content`;
  const resolvedContentId = `\0${contentId}`;
  let pending;
  const generate = () => pending ??= buildLocalSource({ root, cacheDir });
  return {
    name: "lesson-local-source",
    resolveId: source => source === id ? resolvedId : source === contentId ? resolvedContentId : undefined,
    async load(source) {
      if (source !== resolvedId && source !== resolvedContentId) return;
      const data = await generate();
      data.snapshot.files.forEach(file => this.addWatchFile(join(root, file.path)));
      const output = source === resolvedId ? { snapshot: data.snapshot, icons: data.icons } : { texts: data.texts, refs: data.refs };
      return `export default ${JSON.stringify(output)};`;
    },
    async handleHotUpdate({ file, server }) {
      const relative = file.startsWith(`${root}/`) ? file.slice(root.length + 1) : "";
      if (!isLocalSource(relative)) return;
      pending = undefined;
      await generate();
      for (const id of [resolvedId, resolvedContentId]) {
        const module = server.moduleGraph.getModuleById(id);
        if (module) server.moduleGraph.invalidateModule(module);
      }
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
