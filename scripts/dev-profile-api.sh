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

# Read only known development settings as literal values, without shell evaluation.
profile_settings="$PROJECT_ROOT/apps/api/.env.profile-api"
if [[ -f "$profile_settings" ]]; then
  while IFS='=' read -r setting value; do
    case "$setting" in
      RESEARCH_API_URL|RESEARCH_LAMBDA_FUNCTION|AWS_PROFILE|AWS_REGION|BEDROCK_MODEL_ID|PROFILE_API_PORT|ADMIN_CONSOLE_TOKEN_SECRET_ARN|RESEARCH_ADMIN_TOKEN_SECRET_ARN)
        if [[ -z "${!setting:-}" ]]; then export "$setting=$value"; fi ;;
    esac
  done < "$profile_settings"
fi

# Local-only Admin credential. This file is ignored by Git and parsed literally.
admin_settings="$PROJECT_ROOT/apps/api/.env.admin.local"
if [[ -f "$admin_settings" ]]; then
  while IFS='=' read -r setting value; do
    case "$setting" in
      INVESTOROS_ADMIN_TOKEN)
        if [[ -z "${INVESTOROS_ADMIN_TOKEN:-}" ]]; then export "INVESTOROS_ADMIN_TOKEN=$value"; fi ;;
    esac
  done < "$admin_settings"
fi

export AWS_REGION="${AWS_REGION:-us-east-1}"
export BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-us.amazon.nova-lite-v1:0}"
# Use the existing, least-privilege IAM entry for research by default. An explicit
# API URL or function name from the environment/local settings always wins.
if [[ -z "${RESEARCH_LAMBDA_FUNCTION:-}" && -z "${RESEARCH_API_URL:-}" ]]; then
  export RESEARCH_LAMBDA_FUNCTION="investoros-dev-api"
fi
export DEMO_PORTFOLIO_MODE="${DEMO_PORTFOLIO_MODE:-local_fixture}"
export PYTHONPATH="$PROJECT_ROOT/apps/api/src${PYTHONPATH:+:$PYTHONPATH}"
if [[ -n "${RESEARCH_LAMBDA_FUNCTION:-}" ]]; then
  echo "Recherche locale : Lambda IAM ${RESEARCH_LAMBDA_FUNCTION} (${AWS_REGION})"
else
  echo "Recherche locale : API HTTPS configurée"
fi
echo "Bedrock local : ${BEDROCK_MODEL_ID} (${AWS_REGION}); credentials depuis la chaîne AWS standard"
exec "$PROFILE_API_PYTHON" -m uvicorn investoros_api.main:app \
  --host 127.0.0.1 --port "${PROFILE_API_PORT:-8010}" --reload \
  --reload-dir "$PROJECT_ROOT/apps/api/src"
