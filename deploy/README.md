# 前后端离线部署

本包包含 React 静态站点 + Nginx、Go API（兼任迁移入口）、PostgreSQL 17 的完整镜像。
构建机需要联网、Docker Buildx；目标服务器只需 Docker Engine 28+ 和支持 `--wait` 的 Compose v2+、Bash、tar、sha256sum。目标机无需 Node、Go、源码或镜像仓库。GitHub 登录本身仍需服务器能访问 GitHub，这不属于部署依赖。

## 本地打包

仓库根目录执行：

```bash
make offline-pack VERSION=v1
# Apple Silicon 也默认生成服务器需要的 linux/amd64；arm64 服务器可显式指定：
# make offline-pack VERSION=v1-arm PLATFORM=linux/arm64
```

产物：`dist-offline/learn-codex-v1-amd64.tar.gz` 及其 `.sha256` 校验文件。
包内不含 .env、生产凭据或数据库数据；`release.env` 只有镜像版本和架构。
构建使用当前工作区（包含未提交代码），正式发布前请确认版本与工作区。每次使用新版本号，脚本拒绝覆盖已有包。

## 上传与首次启动

域名、证书暂停期间，不需要更改它们。以下命令由运维手动执行，打包不会自动连接服务器：

```bash
scp dist-offline/learn-codex-v1-amd64.tar.gz* admin@39.96.68.108:~/
ssh admin@39.96.68.108
sha256sum -c learn-codex-v1-amd64.tar.gz.sha256
mkdir -p ~/learn-codex-releases
tar -xzf learn-codex-v1-amd64.tar.gz -C ~/learn-codex-releases
cd ~/learn-codex-releases/learn-codex-v1
bash deploy.sh init
# 修改 .env 中的端口、站点地址与 OAuth 配置，再运行：
bash deploy.sh up
bash deploy.sh status
```

有 make 时，上述脚本也可写为 `make init`、`make up`、`make status`。
up 校验包、校验 CPU 架构、导入镜像，等待数据库健康，执行迁移，再启动 API/前端并检查健康状态。所有服务设置 `pull_policy: never`，启动不拉镜像、不构建。

默认 `127.0.0.1:8088` 只允许服务器本机连接，避免未配置 HTTPS 就暴露账号接口。可以在自己电脑开 SSH 隧道：

```bash
ssh -L 8088:127.0.0.1:8088 admin@39.96.68.108
# 浏览器打开 http://localhost:8088
```

后续有 HTTPS 入口后，让反向代理转发至此端口，设置：

```dotenv
FRONTEND_ORIGIN=https://learn-codex.tech
COOKIE_SECURE=true
```

同时更新 GitHub OAuth App 的准确回调 `https://learn-codex.tech/api/v1/auth/github/callback`。
Nginx 的 /api/ 代理保留 Origin，API 与数据库不暴露宿主机端口。
如确需直接对公网提供 HTTP，可以修改 BIND_ADDRESS/HTTP_PORT，但不建议在明文 HTTP 开放登录。

## 配置与秘密

### 域名 HTTPS 入口（宿主机 Caddy）

生产域名为 `learn-codex.tech`，A 记录指向服务器；云防火墙放行 TCP 80、443。
Ubuntu 24.04 可安装发行版维护的 Caddy：`sudo apt-get install -y caddy`。
将本目录 `Caddyfile` 上传至服务器，先备份 `/etc/caddy/Caddyfile`，再安装配置：

```bash
sudo caddy validate --config ./Caddyfile --adapter caddyfile
sudo install -m 644 ./Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy 自动申请并续期证书、将 HTTP 重定向到 HTTPS；证书数据保存在宿主机
`/var/lib/caddy`，不要在升级应用时删除。Caddy 作为独立宿主机服务安装，不包含在离线镜像包中；
首次安装与证书签发/续期需要联网。默认不启用访问日志，避免记录 OAuth 查询参数。

证书正常后在部署目录 `.env` 设置 `BIND_ADDRESS=127.0.0.1`、
`FRONTEND_ORIGIN=https://learn-codex.tech`、`COOKIE_SECURE=true`，保留数据库密码，
再重建前后端（不重建数据库）：

```bash
sudo docker compose --env-file release.env --env-file .env -f compose.yaml \
  up -d --force-recreate --no-deps --no-build --pull never --wait api frontend
curl -I https://learn-codex.tech/
```

生产 GitHub OAuth App 的首页和回调也必须使用该域名；密钥仍只放在部署目录 `.env`。
中国大陆服务器正式上线需完成 ICP 备案，HTTPS 签发成功不代表备案完成。

- `init` 以 0600 权限生成 .env 和随机十六进制数据库密码，已有文件不覆盖。
- 本地保存的生产 OAuth 凭据需单独通过受保护的渠道交给目标机，不要混入离线包。
- FRONTEND_ORIGIN 必须与用户实际访问地址完全一致，不带末尾斜杠。
- 数据库密码使用十六进制或 URL 安全字符，避免连接串转义问题。
- 默认不配置 GitHub，普通注册登录仍可工作。OAuth callback 由 FRONTEND_ORIGIN 推导。
- 不要公开 `docker compose config` 或 `docker inspect` 的完整输出，其中可能有密钥。
- 当前限流按直连 IP；前置 Nginx 后请求共享代理 IP 的额度。大规模上线需另做可信代理边界和入口限流，不要直接信任任意 X-Forwarded-For。

## 升级、备份与停止

```bash
bash deploy.sh backup  # 生成权限受限的 backups/*.sql
bash deploy.sh logs
bash deploy.sh stop    # 只停容器，保留数据库
```

升级前在旧版本目录备份，解压新版到另一目录，将旧 .env 安全复制过去，保持 COMPOSE_PROJECT_NAME 和 POSTGRES_PASSWORD 不变，再执行新版 up。
固定项目名让不同版本目录使用同一个命名数据卷；换项目名会创建独立数据库。
脚本不执行 down -v，不删除镜像、旧包或数据；备份文件应另行离机保存。
迁移失败会停止上线。迁移可能已经改变数据库，旧程序也可能与新结构不兼容；不承诺自动回滚。恢复前需维护窗口和备份验证，勿盲目回退镜像或执行 Down 迁移。

停止后可再次 up；每次都会检查迁移。重复 up 不重复插入初始化数据。
仅容器健康不代表真实 GitHub OAuth/公网 DNS 可用，上线仍需验证浏览器访问与登录。
# 可选 Rust 沙箱

默认不开放代码执行。先独立安装并验收 [gVisor worker](rust-sandbox/README.md)，再在离线发布目录运行 `sudo bash deploy.sh sandbox-enable` 和 `sudo bash deploy.sh up`。开关只对当前发布目录有效，新 release 必须重新明确启用；worker socket 缺失时拒绝部署，不回退普通容器。网站 API 只挂载 worker 的 Unix socket，不拥有 Docker 权限。
