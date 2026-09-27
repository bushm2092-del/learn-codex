#!/bin/sh
set -eu
umask 077
# stdin 仅作为源码数据，绝不插入 shell 命令。超时后外部 worker 还会强制销毁容器。
head -c 12289 > /work/main.rs
test "$(wc -c < /work/main.rs)" -le 12288
timeout -s KILL 30 rustc --edition=2021 --crate-name playground -C opt-level=0 -C debuginfo=0 -C codegen-units=1 /work/main.rs -o /work/program
timeout -s KILL 15 /work/program
