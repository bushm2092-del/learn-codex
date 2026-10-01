# 天赋测试大厅状态栏删除 · 2026-10-01

删除四张挑战卡下方的“当前选择”与分页圆点，移除整栏占用的高度。手机左右箭头移到卡轨道底部现有留白，保留横向滑动、左右键与翻面行为。

## 发布

前端镜像为 `learn-codex-frontend:talent-deck-cleanup-20261001`。使用已通过类型检查与生产构建的 `frontends/teach/dist/`，连同现有 `nginx.conf` 和 `frontend-release.Dockerfile` 打包；基于服务器缓存的 `learn-codex-frontend:talent-login-20261001` 构建 linux/amd64 镜像，不拉取基础镜像，并保留旧静态资源。镜像记录源码提交的 `org.opencontainers.image.revision` 标签，发布包记录静态资源校验和。

服务器沿用 `/home/admin/learn-codex-releases/learn-codex-teach-copy-20260928-e2a5495` 中的 Compose 项目和配置。安装覆盖文件前，将现有文件保存为 `backups/frontend-before-talent-deck-cleanup-20261001.override.yaml`，然后将本目录的 `talent-deck-cleanup-20261001.override.yaml` 安装为 `frontend.override.yaml`。

```bash
sudo docker compose --env-file release.env --env-file .env \
  -f compose.yaml -f rust-sandbox.override.yaml -f frontend.override.yaml \
  up -d --force-recreate --no-deps --no-build --pull never --wait frontend
```

## 验证与回退

本次仅重建前端，无数据库迁移或数据写入。前端类型检查、构建及双语静态渲染检查通过；静态渲染确认状态栏已删除、四张卡片与两个箭头仍在。按用户要求不使用浏览器自动化。上线后检查容器健康、HTTPS 入口、发布静态资源校验和与 API 就绪状态。

回退时用备份恢复 `frontend.override.yaml`，重新执行上面的前端重建命令。
