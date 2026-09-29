# 2026-09-27 验证记录

目标服务器：2 vCPU，Linux 6.8.0-63-generic，系统可用总内存 3499 MiB，无 swap。gVisor release-20260921.0，专用 Docker runtime `learn-rust`。

## 实测

- 标准库 Rust hello：真实编译执行成功，约 2 秒（包含轮询粒度）。
- `/etc` 写入失败；网站 `.env`、Docker socket 不可见。
- 169.254.169.254、172.17.0.1、1.1.1.1 的 TCP 直连均被阻断。
- 超量输出终止；不断分配内存的任务终止。
- 死循环约 17 秒结束（包括编译与轮询）；运行时抽样 CPU 约 75%，符合 0.75 CPU 配额。
- 批量创建子进程触发限制，测试主动清理已启动子进程。
- `/tmp` 超量写入失败。
- 本任务 Unix socket 转发可连接；未提供 Key 返回 401。**未用真实 Key 请求付费模型，不声称已验证模型正常回答。**
- 最终 worker 取消任务后，带沙箱标签的容器列表为空。
- 测试后服务器可用内存 2869 MiB，网站 HTTP 200。该读数不是编译峰值；1 GiB 是硬上限，不是已测平均需求。

Go 单元测试、PostgreSQL 集成测试、sandbox race 测试、go vet、前端 check/build 均通过。浏览器 DOM 已确认密码输入、登录入口、代码编辑器及 320px 宽度无页面横向溢出；页面截图两次超时，视觉验收未完成。官方文档截图已成功抓取并检查。

初次验收仅安装运行时、镜像与默认禁用的 worker unit，临时测试进程随后停止。

## 部署验收

经用户确认提交部署后，代码 `43507ba` 已推送，发布目录为 `/home/admin/learn-codex-releases/learn-codex-rust-sandbox-20260927`。部署前已备份数据库。

- 显式启用 systemd worker 与网站 sandbox override；worker active，前端、API、PostgreSQL 均 healthy。
- 公网临时账号端到端验证：真实 Rust 编译运行成功；未登录返回 401，错误 Origin 返回 403，重复提交返回 429。
- 验证后已删除本次创建的临时账号；无残留沙箱容器。
- 课程页面、文档截图及新前端资源均返回 HTTP 200；验收后可用内存 2831 MiB。
- 尚未使用真实 API Key 调用付费模型，模型回答链路仍需用户自愿提供 Key 验证。

上述测试覆盖已列出的限制，不代表执行不可信代码不存在风险。

## 预编译依赖与编辑器升级（尚未发布）

构建 `learn-rust-sandbox:deps-v1`，锁定 reqwest 0.12.28、tokio 1.48.0、serde_json 1.0.145 并预编译。用户任务仍由 rustc 编译单个文件；不运行 Cargo 或下载依赖。

`smoke.py` 在本地 Docker 和目标服务器 gVisor 上均通过。服务器使用原有 1 GiB、0.75 CPU、64 PIDs、64 MiB 工作目录等限制：

- 页面原始示例真实编译，通过容器内测试 HTTP 响应验证请求 JSON 和回答解析：3.4 秒。
- HTTP 401 正确返回失败：2.8 秒；无效 Rust 编译失败：0.7 秒。
- 只读根目录、无 Docker socket、元数据地址网络阻断检查通过：1.2 秒。
- 测试没有调用真实付费 API，也没有替换线上 worker 或网站；新镜像仅预先导入。

前端 check/build、Go tests、sandbox race tests 与 go vet 通过。CodeMirror 编辑、撤销、Tab 移出已通过浏览器验证；390px 宽度无页面溢出，Rust 高亮与替换图片加载正常。截图超时，未完成截图视觉验收。前端构建提示章节 chunk 超过 500 kB（压缩约 169 kB），仅在访问该章节时加载。

## 纯示例代码与环境代理升级（deps-v2，已发布）

移除示例中的 cfg/Unix socket 配置，改由容器内部受限 HTTPS 代理适配，不改写源码。证书链与拒绝非法 CONNECT 目标的 Go 测试（含 race）通过。

本地 Docker 功能测试、服务器 gVisor 测试均通过。服务器结果：正常 JSON 回答 3.5 秒、401 2.8 秒、编译错误 0.7 秒、非法域名及路径分别 2.8 秒、基础隔离 1.3 秒。保持原资源配额，使用测试响应，不调用真实付费模型。新镜像仅导入，没有切换线上 worker 或网站。

浏览器确认编辑器焦点 outline 为 none，代码不再含 cfg；问号说明支持键盘打开、Escape 关闭与焦点返回。鼠标自动点击被页面元素拦截，未据此声称完成鼠标交互验收。

## Responses API 升级（2026-09-28）

容器 bridge 与宿主 relay 从 `POST /chat/completions` 同步切换到 DeepSeek Responses API 的 `POST /responses`；relay 使用 `input` 和 `max_output_tokens` 做固定模型、非流式和输出预算校验，其余协议字段原样转发。页面默认示例使用 Responses 的顶层 function tool 结构。

本地 Docker 烟测通过正常 Responses JSON、401、编译错误、非法域名、非法路径和基础隔离。服务器导入镜像 `sha256:7c20e0a29721984a28b7797acd8186e41e1563b16177a1c19d656c287178c4a4` 并替换 worker 后，systemd 服务为 active，gVisor 在线 relay 探针通过。旧镜像保留为 `learn-rust-sandbox:backup-before-responses-20260928`，旧 worker 保留为 `/opt/learn-rust-worker/rust-worker.backup-20260928-responses`。

## 多轮工具闭环升级（2026-09-29，沙箱已发布）

为支持 `function_call → 本地工具 → function_call_output → 再次请求模型`，宿主 relay 的单任务请求预算从 1 次调整为最多 3 次；每次请求仍固定为 `deepseek-flash`、非流式、最多 16 条输入项、8 KiB 请求、256 输出 tokens 和 32 KiB 响应。模型单次请求超时调整为 25 秒，容器运行时限调整为 55 秒，worker 外部总时限调整为 95 秒，其余网络隔离、Key 转发与资源边界不变。

第三章第二个 Rust 沙箱已改为真实 Responses API 循环，并按轮次打印 `function_call`、工具结果和最终消息；天气工具继续使用明确标注的固定教学数据。DeepSeek Responses API 是无状态协议，示例会把上一轮完整 `output` 与同 `call_id` 的 `function_call_output` 一起放入下一轮 `input`。非成功 HTTP 响应会保留状态码和正文，便于区分上游、relay 与 bridge 错误。

线上 worker 已替换为 SHA-256 `ed1887c43fdc905381bcae22081fb5b6f79c92e7ed04885bb49b93bcce7a6cfd`，沙箱镜像为 `sha256:a715cbba6c0598f34ea8add3b42ea94172f2e0b8e91d98a541c0817dd316b9e7`。旧 worker 备份为 `/opt/learn-rust-worker/rust-worker.backup-20260929-multiround`，首次多轮 worker 备份为 `/opt/learn-rust-worker/rust-worker.backup-20260929-before-body-drain`，旧镜像保留为 `learn-rust-sandbox:backup-before-multiround-20260929`。服务器 gVisor 探针通过真实 Rust、网络/文件隔离、relay 和 HTTPS bridge 三次请求预算测试；超出预算的第四次请求会稳定返回 429，不再因提前关闭 Unix socket 被转换成 502。worker、站点本机健康检查及公网健康检查均正常；未使用真实 Key 调用付费模型。

示例源码使用沙箱同类 reqwest、tokio、serde_json 依赖编译通过；`go test ./...`、sandbox race、`go vet ./...`、bridge 测试、前端 `pnpm check` / `pnpm build`、入口脚本语法和 `git diff --check` 均通过。页面源码修正尚未随完整站点发布，供本地开发站与下一次站点发布使用。
