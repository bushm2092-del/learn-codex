# 宿主机先以 CGO_ENABLED=0、GOOS=linux、GOARCH=amd64 编译 server，再复用已有运行时镜像离线发布。
ARG BASE_IMAGE=learn-codex-api:talent-context-20261001
FROM ${BASE_IMAGE}
COPY --chown=app:app server /usr/local/bin/server
