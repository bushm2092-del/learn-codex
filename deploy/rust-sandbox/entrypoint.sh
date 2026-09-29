#!/bin/sh
set -eu
umask 077
# stdin 仅作为源码数据，绝不插入 shell 命令。超时后外部 worker 还会强制销毁容器。
head -c 12289 > /work/main.rs
test "$(wc -c < /work/main.rs)" -le 12288
# 依赖路径来自只读镜像，不接受用户 Cargo 配置、build.rs 或编译参数。
set --
for crate in reqwest tokio serde_json; do
    for library in /opt/deps/lib"$crate"-*.rlib; do
        test -f "$library"
        set -- "$@" --extern "$crate=$library"
    done
done
timeout -s KILL 30 rustc --edition=2021 --crate-name playground -C opt-level=0 -C debuginfo=0 -C codegen-units=1 -L dependency=/opt/deps "$@" /work/main.rs -o /work/program
# 真实 reqwest 使用标准代理与证书配置；不修改用户源码、不关闭 TLS 校验。
/usr/local/bin/sandbox-bridge &
bridge_pid=$!
trap 'kill "$bridge_pid" 2>/dev/null || true' EXIT
attempt=0
while [ ! -f /tmp/sandbox-ca.pem ]; do
    kill -0 "$bridge_pid"
    attempt=$((attempt + 1))
    test "$attempt" -lt 40
    sleep 0.05
done
export HTTPS_PROXY=http://127.0.0.1:18080
export SSL_CERT_FILE=/tmp/sandbox-ca.pem
# 此值只是示例占位符；真实 Key 永不进入容器，宿主转发时才添加。
export DEEPSEEK_API_KEY=provided-by-relay
timeout -s KILL 55 /work/program
