# 仅管理员构建阶段下载、编译锁定依赖；任务阶段不运行 Cargo。
FROM golang:1.26-bookworm AS bridge
WORKDIR /build
COPY bridge/main.go ./main.go
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /bridge main.go

FROM rust:1.90.0-slim-bookworm AS dependencies
WORKDIR /build
COPY dependencies/ ./
RUN cargo build --locked -j 2

FROM rust:1.90.0-slim-bookworm
COPY --from=dependencies /build/target/debug/deps /opt/deps
COPY --from=bridge /bridge /usr/local/bin/sandbox-bridge
COPY entrypoint.sh /usr/local/bin/sandbox-entrypoint
RUN chmod 0555 /usr/local/bin/sandbox-entrypoint
USER 65534:65534
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/sandbox-entrypoint"]
