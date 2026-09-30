# Function Calling 发布记录 · 2026-09-29

- 前端镜像：`learn-codex-frontend:s04-article-20260929`（linux/amd64）。在 `function-call-20260929` 上叠加本次 `pnpm build` 产物和带 `/source/` 的 Nginx 配置；旧静态资源保留，兼容尚未刷新的页面。第四章正文为 tools 模块说明，`crates/` 路径可打开本章源码。
- 上一版前端镜像 `learn-codex-frontend:function-call-20260929` 仍保留在服务器上。回退时把 `frontend.override.yaml` 的镜像改回该标签，再按下面的命令重建 frontend。
- 第三章 `/lessons/function-call` 标记正式；第四章 `/lessons/function-call-source` 新增源码解析草稿，基于本地 Codex `53446f90a5`，目录后续序号顺延。
- 发布目录：`/home/admin/learn-codex-releases/learn-codex-teach-copy-20260928-e2a5495`。
- 在原 compose 文件及 `rust-sandbox.override.yaml` 基础上追加 `frontend.override.yaml`，只重建 frontend；API、数据库镜像和 worker 未替换。
- 已在事务内应用 `backend/migrations/003_function_call_source.sql` 的章节登记数据。该迁移可重复执行，后续正常迁移再执行不会再次顺移章节。未手动更改 Goose 版本记录。
- 数据库备份：发布目录下 `backups/before-function-call-20260929.sql`，权限由 `umask 077` 限制；没有删除任何评论或学习数据。

## 后续重启与回退

在发布目录运行时必须包含前端覆盖文件，避免恢复旧前端：

```bash
sudo docker compose --env-file release.env --env-file .env \
  -f compose.yaml -f rust-sandbox.override.yaml -f frontend.override.yaml \
  up -d --no-deps --no-build --pull never --wait frontend
```

如需回退前端，省略 `-f frontend.override.yaml` 即可恢复原镜像 `teach-copy-20260928-e2a5495`。不要删除新章节数据或恢复整库来回退前端。

## 验证

- `pnpm check`、`pnpm build`、`git diff --check` 通过；构建仍有已知的大于 500 kB chunk 提示。
- 本地桌面：第三章显示 PUBLISHED，新章可访问；390px 下无横向溢出。
- 服务器 HTTPS 页面 HTML 的 SHA-256 与本地产物一致：`e321b067e05c7b454de9b50c8f7563b17ae59ee09fc6371b88926d67cb50aab9`。
- 新章 stats 和 learners 接口正常；frontend、api、postgres 健康，learn-rust-worker active。
- 当前电脑通过 Whistle 的公网浏览器复核被 TLS 连接错误阻断；不能据此声称公网浏览器或真实登录已验证。
