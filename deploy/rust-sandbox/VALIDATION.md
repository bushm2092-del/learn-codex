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
