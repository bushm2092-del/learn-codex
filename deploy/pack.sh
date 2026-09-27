#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
tag="${VERSION:-$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$repo" rev-parse --short HEAD)}"
platform="${PLATFORM:-linux/amd64}"
[[ "$tag" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$ ]] || { echo "Invalid VERSION" >&2; exit 1; }
case "$platform" in linux/amd64|linux/arm64) ;; *) echo "Use linux/amd64 or linux/arm64" >&2; exit 1;; esac
docker info >/dev/null
docker buildx version >/dev/null
out="$repo/dist-offline"
mkdir -p "$out"
archive="$out/learn-codex-$tag-${platform#linux/}.tar.gz"
[[ ! -e "$archive" ]] || { echo "Release already exists: $archive" >&2; exit 1; }
stage="$(mktemp -d "${TMPDIR:-/tmp}/learn-codex-pack.XXXXXX")"
trap 'rm -rf -- "$stage"' EXIT
bundle="$stage/learn-codex-$tag"
mkdir "$bundle"
docker buildx build --platform "$platform" --load -t "learn-codex-api:$tag" "$repo/backend"
docker buildx build --platform "$platform" --load -t "learn-codex-frontend:$tag" "$repo/frontends/Teach"
docker pull --platform "$platform" postgres:17-alpine
docker tag postgres:17-alpine "learn-codex-postgres:$tag"
docker image save --platform "$platform" -o "$bundle/images.tar" "learn-codex-api:$tag" "learn-codex-frontend:$tag" "learn-codex-postgres:$tag"
cp "$repo/deploy/compose.yaml" "$repo/deploy/deploy.sh" "$repo/deploy/README.md" "$repo/deploy/Makefile" "$bundle/"
cp "$repo/deploy/.env.example" "$bundle/.env.example"
printf 'RELEASE_TAG=%s\nRELEASE_PLATFORM=%s\n' "$tag" "$platform" > "$bundle/release.env"
chmod +x "$bundle/deploy.sh"
(
 cd "$bundle"
 if command -v sha256sum >/dev/null; then sha256sum images.tar compose.yaml deploy.sh Makefile release.env .env.example README.md > SHA256SUMS
 else shasum -a 256 images.tar compose.yaml deploy.sh Makefile release.env .env.example README.md > SHA256SUMS; fi
)
COPYFILE_DISABLE=1 tar -czf "$archive" -C "$stage" "learn-codex-$tag"
if command -v sha256sum >/dev/null; then (cd "$out" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
else (cd "$out" && shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256"); fi
printf 'Offline release: %s\n' "$archive"
