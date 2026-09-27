# 只提供标准库；用户不能提交 Cargo.toml、build.rs 或下载依赖。
FROM rust:1.90.0-slim-bookworm
COPY entrypoint.sh /usr/local/bin/sandbox-entrypoint
RUN chmod 0555 /usr/local/bin/sandbox-entrypoint
USER 65534:65534
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/sandbox-entrypoint"]
