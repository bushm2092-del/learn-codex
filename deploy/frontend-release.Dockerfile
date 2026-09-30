# 仅更新静态站点，保留上一版资源和源码快照，兼容尚未刷新的浏览器。
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
