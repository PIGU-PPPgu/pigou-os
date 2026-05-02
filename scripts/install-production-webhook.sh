#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${PIGOU_APP_DIR:-/opt/pigou-os}"
HOOK_PATH="${PIGOU_DEPLOY_HOOK_PATH:-/usr/local/bin/pigou-os-deploy-hook}"
SECRET="${PIGOU_DEPLOY_WEBHOOK_SECRET:-}"
PORT="${PIGOU_DEPLOY_WEBHOOK_PORT:-3899}"

if [[ -z "$SECRET" ]]; then
  echo "[install-production-webhook] set PIGOU_DEPLOY_WEBHOOK_SECRET before installing." >&2
  exit 1
fi

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

SECRET="${PIGOU_DEPLOY_WEBHOOK_SECRET:?missing PIGOU_DEPLOY_WEBHOOK_SECRET}"
APP_DIR="${PIGOU_APP_DIR:-/opt/pigou-os}"
PORT="${PIGOU_DEPLOY_WEBHOOK_PORT:-3899}"

while true; do
  {
    read -r request_line || exit 0
    content_length=0
    signature=""
    event=""
    while IFS= read -r header && [[ "$header" != $'\r' ]]; do
      lower="$(printf '%s' "$header" | tr '[:upper:]' '[:lower:]')"
      case "$lower" in
        content-length:*) content_length="$(printf '%s' "$header" | awk -F': ' '{print $2}' | tr -d '\r')" ;;
        x-hub-signature-256:*) signature="$(printf '%s' "$header" | awk -F': ' '{print $2}' | tr -d '\r')" ;;
        x-github-event:*) event="$(printf '%s' "$header" | awk -F': ' '{print $2}' | tr -d '\r')" ;;
      esac
    done

    body=""
    if [[ "${content_length:-0}" -gt 0 ]]; then
      body="$(dd bs=1 count="$content_length" 2>/dev/null)"
    fi

    expected="sha256=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)"
    if [[ "$request_line" == POST* && "$signature" == "$expected" && "$event" == "push" ]]; then
      nohup "$APP_DIR/scripts/deploy-production.sh" >> "$APP_DIR/content/ops/deploy.log" 2>&1 &
      printf 'HTTP/1.1 202 Accepted\r\nContent-Type: text/plain\r\n\r\nqueued\n'
    else
      printf 'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nforbidden\n'
    fi
  } | nc -l 127.0.0.1 "$PORT"
done
HOOK

chmod +x "$HOOK_PATH"

cat > /etc/systemd/system/pigou-os-deploy-hook.service <<SERVICE
[Unit]
Description=Pigou OS production deploy webhook
After=network.target

[Service]
Type=simple
Environment=PIGOU_APP_DIR=$APP_DIR
Environment=PIGOU_DEPLOY_WEBHOOK_PORT=$PORT
Environment=PIGOU_DEPLOY_WEBHOOK_SECRET=$SECRET
ExecStart=$HOOK_PATH
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now pigou-os-deploy-hook.service
systemctl status pigou-os-deploy-hook.service --no-pager
