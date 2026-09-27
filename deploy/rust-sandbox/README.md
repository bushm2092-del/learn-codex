# Rust 教学沙箱

独立 Go worker 通过宿主 Unix socket 接收已登录网站用户的任务，容器用 gVisor `learn-rust` runtime 编译和运行真实 Rust。**默认不启用，禁止回退普通 runc。** 不是 Codex 内核功能，也不声称可防御所有容器逃逸。

## 边界

- 只接受单个最多 12 KiB 的 Rust 源文件；标准库、固定编译命令，不接收 Cargo.toml、build.rs、依赖、镜像名、shell 参数或宿主路径。
- 全局一个 worker，最多 5 个待处理任务；每用户一个未结束任务、30 秒冷却，全局提交间隔 5 秒。队列 2 分钟过期，结果 5 分钟过期，最多保留 128 个任务。取消后等待容器清理再释放执行名额。
- 启动前可用内存至少 2 GiB；容器 1 GiB memory/swap 上限（不额外使用 swap）、0.75 CPU、64 PIDs、64 文件描述符、无 core dump。编译 30 秒，运行 15 秒，外部总时限 50 秒。
- 只读根目录，非 root、drop ALL capabilities、no-new-privileges、禁用 Docker 日志。仅 `/work` 64 MiB、`/tmp` 16 MiB 可写；合计也受容器内存上限约束。
- `--network=none`。唯一宿主挂载是本任务专用只读 socket 目录；不挂载仓库、数据卷、Docker socket 或其他宿主目录。
- 每任务 socket 转发器仅接受 `POST /chat/completions`，固定 HTTPS 主机 `api.deepseek.com`；禁代理和重定向，DNS 地址校验后直接连接公网 IP，拒绝私网、回环、链路本地和元数据地址。
- 每任务最多一次请求，仅 deepseek-flash、非流式、16 条文本消息、8 KiB 请求、最多 256 输出 tokens、32 KiB 响应。模型服务有单独的 12 秒超时。
- 用户 Key 不落库、不写日志、不存浏览器、不放容器环境变量，由转发器保存在内存中并注入 Authorization。源码和输出也是短期内存数据；不要将秘密写入源码。Go 字符串无法保证内存物理擦除；宿主管理员仍属于信任边界。
- 输出上限 32 KiB，超限取消；输出按文本显示。清理失败会锁止后续任务。启动时清理带本服务专用标签的孤儿容器。
- worker 本身拥有 Docker 权限，是高信任组件；Unix socket 仅 root 和网站 API 的组 10001 可访问，不能暴露为公网 HTTP 服务。

## 构建与安装（管理员操作）

1. 按官方 gVisor 文档安装完整发行包并核对 SHA512。注册专用 runtime：`runsc install --runtime=learn-rust -- --host-uds=open`，reload Docker。`host-uds=open` 仅用于显式挂载的本任务转发 socket，不允许扩大挂载范围。
2. 在开发机器构建 `docker build --platform linux/amd64 -t learn-rust-sandbox:preflight deploy/rust-sandbox`，离线 `docker save/load` 传入服务器。生产应固定审核后的镜像 ID，不允许用户选择镜像或 runtime。
3. 在 backend 执行 `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o rust-worker ./cmd/rust-worker`，管理员安装到 `/opt/learn-rust-worker/rust-worker`。
4. 安装 `worker.service` 为单实例 systemd 服务。通过隔离测试后才将 `RUST_SANDBOX_ENABLED` 设为 `true`。先不添加网站 compose override，以保持公网执行入口关闭。
5. `sudo python3 probe.py` 验证真实编译、文件/网络隔离、输出、内存、超时与本地转发（不用真实 Key）。同时检查网站健康和余量。
6. 通过验收后，将 `enable.conf` 安装到 `/etc/systemd/system/learn-rust-worker.service.d/enable.conf`，daemon-reload 并启动 worker。离线包内执行 `bash deploy.sh sandbox-enable`，再执行 `bash deploy.sh up`。只有 api 挂载 worker socket，前端与用户容器不接触管理 socket。未启用时接口返回 503。后续新 release 需要显式启用，不能只复制 `.env`。

当前普通离线部署脚本不会自动安装 worker 或开启沙箱；不得因网站部署自动开放代码执行。

## 验证与剩余风险

`go test -race ./internal/sandbox` 覆盖队列容量、身份隔离、取消串行、过期、资源参数、IP 拦截、请求预算和 Key 脱敏；服务器 `probe.py` 是有界烟测，不是完整安全审计。上线前还应验证端到端登录/API 调用、取消、断电重启恢复和真实 Key 的调用（由用户自愿提供）。

需要持续升级 Linux、Docker、gVisor 和工具链；共享宿主仍有内核漏洞、侧信道和资源争抢风险。不要存放高价值秘密或宣称绝对安全。
