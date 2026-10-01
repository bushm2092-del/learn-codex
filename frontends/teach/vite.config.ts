import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localSourcePlugin } from "./scripts/local-source.mjs";

export default defineConfig({
  plugins: [react(), localSourcePlugin(new URL("../../mini-codex-rs", import.meta.url).pathname, new URL("./.source-cache", import.meta.url).pathname)],
  // Rust 源码作为 raw 模块供章节源码面板读取。
  assetsInclude: ["**/*.rs", "**/*.toml"],
  server: { fs: { allow: [".", "../../mini-codex-rs"] }, port: 4173, proxy: { "/api": { target: "http://localhost:8080" } } },
  preview: { port: 4173, proxy: { "/api": { target: "http://localhost:8080" } } },
});
