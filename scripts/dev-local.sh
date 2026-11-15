#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PID=""
PROFILE_API_PORT="${PROFILE_API_PORT:-}"

PROFILE_API_PORT="$(python3 - "$PROFILE_API_PORT" <<'PY'
import socket
import sys

requested = sys.argv[1]
ports = [int(requested)] if requested else list(range(8010, 8021))
for port in ports:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        break
else:
    raise SystemExit("Aucun port API local disponible entre 8010 et 8020; définissez PROFILE_API_PORT.")
PY
)"
export PROFILE_API_PORT
export VITE_PROFILE_API_TARGET="http://127.0.0.1:${PROFILE_API_PORT}"

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

"$PROJECT_ROOT/scripts/dev-profile-api.sh" &
API_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:${PROFILE_API_PORT}/health" >/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "Le serveur API local s’est arrêté avant d’être prêt." >&2
    exit 1
  fi
  sleep 1
done

if [[ "$ready" != 1 ]]; then
  echo "Le serveur API local n’a pas répondu sur 127.0.0.1:${PROFILE_API_PORT}." >&2
  exit 1
fi
echo "API locale prête sur http://127.0.0.1:${PROFILE_API_PORT}"

cd "$PROJECT_ROOT"
npm run dev -w @investoros/web
