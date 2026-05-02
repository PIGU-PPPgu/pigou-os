#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PIGOU_APP_DIR:-$(pwd)}"
CONTENT_DIR="${PIGOU_CONTENT_DIR:-$APP_DIR/content}"
BACKUP_DIR="${PIGOU_BACKUP_DIR:-$APP_DIR/backups/content}"
OPS_DIR="$CONTENT_DIR/ops"
CONTENT_UID="${PIGOU_CONTENT_UID:-1001}"
CONTENT_GID="${PIGOU_CONTENT_GID:-1001}"

if [[ ! -d "$CONTENT_DIR" ]]; then
  echo "[backup-content] content directory not found: $CONTENT_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR" "$OPS_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/content-$STAMP.tgz"

tar \
  --exclude='./ops/events.jsonl' \
  --exclude='./ops/worker-heartbeat.json' \
  -czf "$ARCHIVE" \
  -C "$CONTENT_DIR" .

BYTES="$(wc -c < "$ARCHIVE" | tr -d ' ')"
SHA256="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "$OPS_DIR/last-content-backup.json" <<JSON
{
  "generatedAt": "$CREATED_AT",
  "archive": "$ARCHIVE",
  "bytes": $BYTES,
  "sha256": "$SHA256"
}
JSON

printf '{"createdAt":"%s","type":"content-backup-success","archive":"%s","bytes":%s,"sha256":"%s"}\n' "$CREATED_AT" "$ARCHIVE" "$BYTES" "$SHA256" >> "$OPS_DIR/events.jsonl"

if [[ "$(id -u)" == "0" ]]; then
  chown -R "$CONTENT_UID:$CONTENT_GID" "$OPS_DIR"
fi

echo "[backup-content] wrote $ARCHIVE ($BYTES bytes)"
