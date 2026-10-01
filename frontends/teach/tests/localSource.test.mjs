import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildLocalSource } from "../scripts/local-source.mjs";
import { loadIconTheme, fileIcon, dirIcons } from "../scripts/source-snapshots.mjs";

test("current-source icons and semantic links share snapshot inputs; edits invalidate cached positions", async () => {
  const root = await mkdtemp(join(tmpdir(), "lesson-current-"));
  const put = async (path, text) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), text); };
  try {
    for (const name of ["Cargo.toml", "Cargo.lock", "README.md"]) await put(name, "fixture\n");
    await put("crates/core/src/lib.rs", "pub struct Session;\n");
    await put("crates/core/src/turn.rs", "fn run(s: Session) {}\n");
    await put("crates/core/.env", "PRIVATE\n");
    await put("target/private.rs", "PRIVATE\n");
    await symlink(join(root, "crates/core/.env"), join(root, "crates/core/src/private.rs"));
    let calls = 0;
    const symbol = "rust-analyzer cargo mini-core 0.1.0 Session#";
    const indexer = async dir => {
      calls++;
      const text = await readFile(join(dir, "crates/core/src/turn.rs"), "utf8");
      const line = text.startsWith("//") ? 1 : 0;
      return { documents: [
        { path: "crates/core/src/lib.rs", encoding: 2, occurrences: [{ range: [0, 11, 18], symbol, roles: 1 }] },
        { path: "crates/core/src/turn.rs", encoding: 2, occurrences: [{ range: [line, 10, 17], symbol, roles: 0 }] },
      ] };
    };
    const options = { root, cacheDir: join(root, "cache"), indexer };
    const data = await buildLocalSource(options);
    const theme = loadIconTheme();
    assert.deepEqual(data.snapshot.dirs["crates/core"], dirIcons(theme.manifest, "crates/core"));
    const file = data.snapshot.files.find(f => f.path === "crates/core/src/turn.rs");
    assert.equal(file.icon, fileIcon(theme.manifest, file.path));
    assert.match(data.icons[file.icon], /^data:image\/svg\+xml;base64,/);
    assert.deepEqual(data.refs[file.refs], { targets: [["crates/core/src/lib.rs", 0, 11]], refs: [[0, 10, 17, 0]] });
    assert.equal(Object.values(data.texts).some(text => text.includes("PRIVATE")), false);
    assert.deepEqual(await buildLocalSource(options), data);
    assert.equal(calls, 1);
    await put("crates/core/src/turn.rs", "// change\nfn run(s: Session) {}\n");
    const edited = await buildLocalSource(options);
    assert.equal(calls, 2);
    assert.deepEqual(edited.refs[file.refs].refs, [[1, 10, 17, 0]]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("SCIP crate roots do not turn path keywords into misleading definition links", async () => {
  const { buildRefs } = await import("../scripts/source-snapshots.mjs");
  const symbol = "root";
  const refs = buildRefs({ documents: [
    { path: "lib.rs", encoding: 2, occurrences: [{ range: [0, 0, 5], symbol, roles: 1 }] },
    { path: "turn.rs", encoding: 2, occurrences: [{ range: [0, 4, 9], symbol, roles: 0 }] },
  ] }, new Map([["lib.rs", "// root"], ["turn.rs", "use crate::Session;"]]));
  assert.equal(refs.has("turn.rs"), false);
});
