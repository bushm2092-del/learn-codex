import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSourceSnapshots, decodeScip } from "../scripts/source-snapshots.mjs";

async function withRepo(run) {
  const dir = await mkdtemp(join(tmpdir(), "source-snapshots-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const put = async (path, content) => {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), content);
  };
  try {
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    git("config", "commit.gpgsign", "false");
    await run({ dir, git, put, out: join(dir, "out") });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const readJson = async path => JSON.parse(await readFile(path, "utf8"));

test("snapshots each local lesson branch and shares unchanged blobs", async () => {
  await withRepo(async ({ git, put, out }) => {
    await put("mini-codex-rs/Cargo.toml", "[workspace]\n");
    await put("mini-codex-rs/crates/core/src/lib.rs", "pub fn v1() {}\n");
    await put("mini-codex-rs/logo.bin", Buffer.from([0, 1, 2]));
    await put("README.md", "outside source root\n");
    git("add", "-A");
    git("commit", "-qm", "v1");
    git("branch", "lesson/agent-loop");
    const v1 = git("rev-parse", "HEAD");
    const cargo = git("rev-parse", "HEAD:mini-codex-rs/Cargo.toml");

    await put("mini-codex-rs/crates/core/src/lib.rs", "pub fn v2() {}\n");
    git("commit", "-qam", "v2");
    git("branch", "lesson/function-call");
    git("update-ref", "refs/remotes/origin/lesson/remote-only", "HEAD");
    const v2 = git("rev-parse", "HEAD");
    const libV2 = git("rev-parse", "HEAD:mini-codex-rs/crates/core/src/lib.rs");
    await put("mini-codex-rs/crates/core/src/lib.rs", "uncommitted\n");

    const result = await buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: null, indexer: null });

    assert.equal(result.blobs, 3);
    assert.deepEqual((await readJson(join(out, "index.json"))).snapshots, [
      { lesson: "agent-loop", branch: "lesson/agent-loop", commit: v1 },
      { lesson: "function-call", branch: "lesson/function-call", commit: v2 },
    ]);
    assert.deepEqual(await readJson(join(out, "snapshots", "function-call.json")), {
      lesson: "function-call",
      branch: "lesson/function-call",
      commit: v2,
      root: "mini-codex-rs",
      files: [
        { path: "Cargo.toml", blob: cargo, size: 12 },
        { path: "crates/core/src/lib.rs", blob: libV2, size: 15 },
        { path: "logo.bin", blob: null, size: 3, skipped: "binary" },
      ],
    });
    assert.equal(await readFile(join(out, "blobs", `${libV2}.txt`), "utf8"), "pub fn v2() {}\n");
    assert.equal((await readdir(join(out, "blobs"))).length, 3);
  });
});

test("rejects lesson branches that are not lesson ids", async () => {
  await withRepo(async ({ git, put, out }) => {
    await put("mini-codex-rs/Cargo.toml", "[workspace]\n");
    git("add", "-A");
    git("commit", "-qm", "v1");
    git("branch", "lesson/Bad_Name");
    await assert.rejects(buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: null, indexer: null }), /Invalid lesson branch: lesson\/Bad_Name/);
  });
});

test("maps icons by file name, extension and folder name and copies only used icons", async () => {
  await withRepo(async ({ dir, git, put, out }) => {
    await put("mini-codex-rs/README.md", "# readme\n");
    await put("mini-codex-rs/crates/core/src/lib.rs", "pub fn f() {}\n");
    await put("mini-codex-rs/crates/core/data.unknown", "?\n");
    git("add", "-A");
    git("commit", "-qm", "v1");
    git("branch", "lesson/icons");
    const themeDir = join(dir, "theme");
    const names = ["readme", "markdown", "rust", "rust-light", "file", "folder", "folder-open", "folder-src", "folder-src-open", "unused"];
    for (const name of names) await put(`theme/icons/${name}.svg`, `<svg id="${name}"/>`);
    const manifest = {
      iconDefinitions: Object.fromEntries(names.map(name => [name, { iconPath: `./icons/${name}.svg` }])),
      fileNames: { "readme.md": "readme" },
      fileExtensions: { md: "markdown", rs: "rust" },
      folderNames: { src: "folder-src" },
      folderNamesExpanded: { src: "folder-src-open" },
      light: { fileExtensions: { rs: "rust-light" } },
      file: "file",
      folder: "folder",
      folderExpanded: "folder-open",
    };

    const result = await buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: { manifest, dir: themeDir }, indexer: null });

    const snapshot = await readJson(join(out, "snapshots", "icons.json"));
    assert.deepEqual(snapshot.files.map(file => [file.path, file.icon]), [
      ["README.md", "readme"],
      ["crates/core/data.unknown", "file"],
      ["crates/core/src/lib.rs", "rust-light"],
    ]);
    assert.deepEqual(snapshot.dirs, {
      crates: ["folder", "folder-open"],
      "crates/core": ["folder", "folder-open"],
      "crates/core/src": ["folder-src", "folder-src-open"],
    });
    assert.equal(result.icons, 7);
    assert.deepEqual((await readdir(join(out, "icons"))).sort(), ["file.svg", "folder-open.svg", "folder-src-open.svg", "folder-src.svg", "folder.svg", "readme.svg", "rust-light.svg"]);
    assert.equal(await readFile(join(out, "icons", "rust-light.svg"), "utf8"), '<svg id="rust-light"/>');
  });
});

const varint = value => {
  const bytes = [];
  do {
    const low = value % 128;
    value = Math.floor(value / 128);
    bytes.push(value ? low | 0x80 : low);
  } while (value);
  return bytes;
};
const proto = (field, value) => typeof value === "number"
  ? [...varint(field * 8), ...varint(value)]
  : [...varint(field * 8 + 2), ...varint(value.length), ...value];
const utf8 = text => [...Buffer.from(text)];

test("decodes scip documents and skips fields it does not use", () => {
  const occurrence = [...proto(1, [0, 4, 10].flatMap(varint)), ...proto(2, utf8("rust-analyzer cargo core 0.1.0 Router#")), ...proto(3, 1), ...proto(5, 7)];
  const document = [...proto(1, utf8("crates/core/src/lib.rs")), ...proto(4, utf8("rust")), ...proto(2, occurrence), ...proto(6, 1)];
  const index = Buffer.from([...proto(1, proto(3, utf8("file:///tmp/root"))), ...proto(2, document), ...proto(3, proto(1, utf8("external")))]);

  assert.deepEqual(decodeScip(index), {
    documents: [{
      path: "crates/core/src/lib.rs",
      encoding: 1,
      occurrences: [{ range: [0, 4, 10], symbol: "rust-analyzer cargo core 0.1.0 Router#", roles: 1 }],
    }],
  });
});

test("writes definition links with utf-16 columns and reuses the per-commit cache", async () => {
  await withRepo(async ({ dir, git, put, out }) => {
    await put("mini-codex-rs/crates/core/src/lib.rs", "/* 路由 */ pub struct Router;\nfn a() { let x = 1; x; }\n");
    await put("mini-codex-rs/crates/core/src/main.rs", "// 入口\nfn b() -> Router { let x = 2; x; String::new() }\n");
    git("add", "-A");
    git("commit", "-qm", "v1");
    git("branch", "lesson/refs");
    const router = "rust-analyzer cargo core 0.1.0 Router#";
    const occurrence = (range, symbol, roles = 0) => ({ range, symbol, roles });
    const index = {
      documents: [
        // rust-analyzer 的列为 UTF-8 字节："/* 路由 */ pub struct " 占 24 字节、20 个 UTF-16 单元。
        { path: "crates/core/src/lib.rs", encoding: 1, occurrences: [
          occurrence([0, 0, 2, 0], "rust-analyzer cargo core 0.1.0 lib/", 1),
          occurrence([0, 24, 30], router, 1),
          occurrence([1, 13, 14], "local 0", 1),
          occurrence([1, 20, 21], "local 0"),
        ] },
        { path: "crates/core/src/main.rs", encoding: 1, occurrences: [
          occurrence([1, 10, 16], router),
          occurrence([1, 23, 24], "local 0", 1),
          occurrence([1, 30, 31], "local 0"),
          occurrence([1, 33, 39], "rust-analyzer cargo std 1.0.0 string/String#"),
          occurrence([1, 10, 2, 0], router),
        ] },
        { path: "crates/core/src/missing.rs", encoding: 1, occurrences: [occurrence([0, 0, 6], router)] },
      ],
    };
    let calls = 0;
    const indexer = async () => { calls++; return index; };
    const cacheDir = join(dir, "cache");
    const build = () => buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: null, indexer, cacheDir });

    const result = await build();

    const files = (await readJson(join(out, "snapshots", "refs.json"))).files;
    const refsOf = path => readJson(join(out, "refs", `${files.find(file => file.path === path).refs}.json`));
    assert.equal(result.refs, 2);
    assert.deepEqual(await refsOf("crates/core/src/lib.rs"), {
      targets: [["crates/core/src/lib.rs", 1, 13]],
      refs: [[1, 20, 21, 0]],
    });
    assert.deepEqual(await refsOf("crates/core/src/main.rs"), {
      targets: [["crates/core/src/lib.rs", 0, 20], ["crates/core/src/main.rs", 1, 23]],
      refs: [[1, 10, 16, 0], [1, 30, 31, 1]],
    });

    await build();
    assert.equal(calls, 1);
    assert.deepEqual((await readJson(join(out, "snapshots", "refs.json"))).files, files);
  });
});

test("keeps snapshots browsable when indexing fails", async () => {
  await withRepo(async ({ git, put, out }) => {
    await put("mini-codex-rs/crates/core/src/lib.rs", "pub fn f() {}\n");
    git("add", "-A");
    git("commit", "-qm", "v1");
    git("branch", "lesson/broken");
    const indexer = async () => { throw new Error("rust-analyzer not found"); };

    const result = await buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: null, indexer });

    assert.equal(result.refs, 0);
    assert.deepEqual((await readJson(join(out, "snapshots", "broken.json"))).files.map(file => file.refs), [undefined]);
  });
});
