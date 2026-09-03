.PHONY: help install docs-dev docs-build rust-fmt rust-check rust-test test

SHELL := /bin/bash

help:
	@printf '%s\n' 'mini-codex 可用命令：'
	@printf '%s\n' '  make install     安装 VitePress 文档依赖'
	@printf '%s\n' '  make docs-dev    启动 VitePress 开发服务器'
	@printf '%s\n' '  make docs-build  构建 VitePress 静态站点'
	@printf '%s\n' '  make rust-fmt    检查 Rust 格式'
	@printf '%s\n' '  make rust-check  检查 Rust workspace'
	@printf '%s\n' '  make rust-test   运行 Rust workspace 测试'
	@printf '%s\n' '  make test        构建文档并运行 Rust 测试'

install:
	cd mini-codex-docs && pnpm install

docs-dev:
	cd mini-codex-docs && pnpm docs:dev

docs-build:
	cd mini-codex-docs && pnpm docs:build

rust-fmt:
	cd mini-codex-rs && cargo fmt --all -- --check

rust-check:
	cd mini-codex-rs && cargo check --workspace

rust-test:
	cd mini-codex-rs && cargo test --workspace

test: docs-build rust-test
