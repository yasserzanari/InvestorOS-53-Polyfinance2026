#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_API_VENV="${PROFILE_API_VENV:-$PROJECT_ROOT/.venv/profile-api}"
PROFILE_API_PYTHON="${PROFILE_API_PYTHON:-$PROFILE_API_VENV/bin/python}"

if [[ ! -x "$PROFILE_API_PYTHON" ]]; then
  python3 -m venv "$PROFILE_API_VENV"
fi
if ! "$PROFILE_API_PYTHON" -c 'import fastapi, uvicorn, boto3, mangum' >/dev/null 2>&1; then
  "$PROFILE_API_PYTHON" -m pip install -r "$PROJECT_ROOT/apps/api/requirements.txt" 'uvicorn>=0.30,<1'
fi

export AWS_REGION="${AWS_REGION:-us-east-1}"
export BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-amazon.nova-pro-v1:0}"
export PYTHONPATH="$PROJECT_ROOT/apps/api/src${PYTHONPATH:+:$PYTHONPATH}"
exec "$PROFILE_API_PYTHON" -m uvicorn investoros_api.main:app \
  --host 127.0.0.1 --port "${PROFILE_API_PORT:-8010}" --reload \
  --reload-dir "$PROJECT_ROOT/apps/api/src"
