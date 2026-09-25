.PHONY: help install teach-dev teach-build rust-fmt rust-check rust-test test

SHELL := /bin/bash

help:
	@printf '%s\n' 'mini-codex 可用命令：'
	@printf '%s\n' '  make install     安装教学站与 Ink TUI 依赖'
	@printf '%s\n' '  make teach-dev   启动 React 教学站'
	@printf '%s\n' '  make teach-build 检查并构建 React 教学站'
	@printf '%s\n' '  make rust-fmt    检查 Rust 格式'
	@printf '%s\n' '  make rust-check  检查 Rust workspace'
	@printf '%s\n' '  make rust-test   运行 Rust workspace 测试'
	@printf '%s\n' '  make tui         构建服务并启动 Ink TUI' '  make test        验证 Rust、Ink 与教学站'

install:
	cd frontends/Teach && pnpm install
	cd mini-codex-tui && pnpm install

teach-dev:
	cd frontends/Teach && pnpm dev

teach-build:
	cd frontends/Teach && pnpm check && pnpm build

rust-fmt:
	cd mini-codex-rs && cargo fmt --all -- --check

rust-check:
	cd mini-codex-rs && cargo check --workspace

rust-test:
	cd mini-codex-rs && cargo test --workspace

test: rust-fmt rust-check teach-build rust-test tui-test

.PHONY: app-server-build tui-install tui tui-test
app-server-build:
	cd mini-codex-rs && cargo build -p mini-codex-app-server

tui-install:
	cd mini-codex-tui && pnpm install

tui: app-server-build tui-install
	cd mini-codex-tui && pnpm dev "$(CURDIR)"

tui-test: app-server-build
	cd mini-codex-tui && pnpm check && pnpm build && pnpm test
