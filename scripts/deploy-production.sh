#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PIGOU_APP_DIR:-/opt/pigou-os}"
if [[ -n "${PIGOU_CONTENT_DIR:-}" ]]; then
  CONTENT_DIR="$PIGOU_CONTENT_DIR"
elif [[ -d "$APP_DIR/.runtime/content" ]]; then
  CONTENT_DIR="$APP_DIR/.runtime/content"
else
  CONTENT_DIR="$APP_DIR/content"
fi
BRANCH="${PIGOU_DEPLOY_BRANCH:-main}"
REMOTE="${PIGOU_DEPLOY_REMOTE:-origin}"
OPS_DIR="$CONTENT_DIR/ops"

cd "$APP_DIR"

mkdir -p "$OPS_DIR"

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BEFORE="$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

write_deploy_status() {
  local status="$1"
  local error="${2:-}"
  local finished_at
  local after
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  after="$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  cat > "$OPS_DIR/deploy.json" <<JSON
{
  "generatedAt": "$finished_at",
  "status": "$status",
  "startedAt": "$STARTED_AT",
  "finishedAt": "$finished_at",
  "branch": "$BRANCH",
  "remote": "$REMOTE",
  "before": "$BEFORE",
  "after": "$after",
  "error": "$error"
}
JSON
  printf '{"createdAt":"%s","type":"deploy-%s","branch":"%s","before":"%s","after":"%s","error":"%s"}\n' "$finished_at" "$status" "$BRANCH" "$BEFORE" "$after" "$error" >> "$OPS_DIR/events.jsonl"
}

on_error() {
  local exit_code=$?
  write_deploy_status "failed" "deploy script exited with $exit_code"
  exit "$exit_code"
}
trap on_error ERR

write_deploy_status "running"

if [[ -x "$APP_DIR/scripts/backup-content.sh" ]]; then
  PIGOU_APP_DIR="$APP_DIR" PIGOU_CONTENT_DIR="$CONTENT_DIR" "$APP_DIR/scripts/backup-content.sh"
fi

if [[ "$CONTENT_DIR" == "$APP_DIR/content" && -d "$APP_DIR/content" && ! -L "$APP_DIR/content" ]]; then
  mkdir -p "$APP_DIR/.runtime"
  if [[ ! -d "$APP_DIR/.runtime/content" ]]; then
    mv "$APP_DIR/content" "$APP_DIR/.runtime/content"
  else
    tar -cf - -C "$APP_DIR/content" . | tar --skip-old-files -xf - -C "$APP_DIR/.runtime/content"
    rm -rf "$APP_DIR/content"
  fi
  CONTENT_DIR="$APP_DIR/.runtime/content"
  OPS_DIR="$CONTENT_DIR/ops"
  mkdir -p "$OPS_DIR"
fi

export PIGOU_CONTENT_DIR="$CONTENT_DIR"

git fetch "$REMOTE" "$BRANCH" --prune
git checkout "$BRANCH"
git reset --hard "$REMOTE/$BRANCH"

mkdir -p "$OPS_DIR"

docker compose up -d --build pigou-os
docker compose --profile worker up -d --build pigou-os-worker

for attempt in {1..20}; do
  if docker compose exec -T pigou-os wget -qO- http://127.0.0.1:3888/api/auth/session >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == "20" ]]; then
    echo "[deploy-production] app healthcheck did not pass" >&2
    exit 1
  fi
  sleep 3
done

write_deploy_status "success"

docker compose ps
