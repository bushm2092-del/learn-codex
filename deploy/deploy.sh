#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
action="${1:-help}"
verify() { sha256sum -c SHA256SUMS; }
compose() {
 local extra=()
 if [[ -f sandbox.enabled ]]; then
  [[ -S /run/learn-rust-worker/worker.sock ]] || { echo "Sandbox socket unavailable; deployment stopped" >&2; return 1; }
  extra=(-f rust-sandbox.override.yaml)
 fi
 docker compose --env-file release.env --env-file .env -f compose.yaml "${extra[@]}" "$@"
}
require_config() {
 [[ -f .env ]] || { echo "Run: bash deploy.sh init, then edit .env" >&2; exit 1; }
 if grep -q '^POSTGRES_PASSWORD=REPLACE_ME$' .env; then echo "Set a database password first" >&2; exit 1; fi
 docker compose version >/dev/null
 compose config --quiet
}
case "$action" in
 sandbox-enable)
  [[ -S /run/learn-rust-worker/worker.sock ]] || { echo "Start and validate the Rust worker first" >&2; exit 1; }
  touch sandbox.enabled
  echo "Sandbox selected for this release. Run deploy.sh up to apply."
  ;;
 init)
  [[ ! -e .env ]] || { echo ".env already exists; not overwritten"; exit 1; }
  umask 077
  password="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  sed "s/POSTGRES_PASSWORD=REPLACE_ME/POSTGRES_PASSWORD=$password/" .env.example > .env
  echo "Created .env with a random database password. Review origin, port and OAuth settings."
  ;;
 load)
  verify
  docker load -i images.tar
  ;;
 up)
  verify
  require_config
  expected="$(sed -n 's/^RELEASE_PLATFORM=linux\///p' release.env)"
  case "$(uname -m)" in x86_64) actual=amd64;; aarch64|arm64) actual=arm64;; *) actual=unknown;; esac
  [[ "$actual" == "$expected" || "${ALLOW_EMULATION:-0}" == 1 ]] || { echo "Architecture mismatch: package=$expected host=$actual" >&2; exit 1; }
  docker load -i images.tar
  compose up -d --no-build --pull never --wait --wait-timeout 120 postgres
  # 每次上线都运行迁移；失败时不替换正在运行的应用。
  compose run --rm --no-deps --pull never migrate
  # 同时重建代理容器，让 Nginx 重新解析新 API 容器地址。
  compose up -d --force-recreate --no-build --pull never --wait --wait-timeout 120 api frontend
  compose ps
  ;;
 status) require_config; compose ps ;;
 logs) require_config; compose logs --tail 100 -f api frontend ;;
 stop) require_config; compose stop ;;
 backup)
  require_config
  umask 077
  mkdir -p backups
  target="backups/learn-$(date -u +%Y%m%dT%H%M%SZ).sql"
  compose exec -T postgres pg_dump -U learn -d learn > "$target.tmp"
  mv "$target.tmp" "$target"
  echo "Backup: $target"
  ;;
 *) printf '%s\n' 'Usage: bash deploy.sh init|load|up|status|logs|stop|backup' ;;
esac
