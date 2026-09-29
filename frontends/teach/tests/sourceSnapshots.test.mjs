import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSourceSnapshots } from "../scripts/source-snapshots.mjs";

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

    const result = await buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: null });

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
    await assert.rejects(buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: null }), /Invalid lesson branch: lesson\/Bad_Name/);
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

    const result = await buildSourceSnapshots({ repoRoot: git("rev-parse", "--show-toplevel"), outDir: out, iconTheme: { manifest, dir: themeDir } });

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
