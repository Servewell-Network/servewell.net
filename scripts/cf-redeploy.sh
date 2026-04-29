#!/usr/bin/env bash
# cf-redeploy.sh — Re-promote the latest Worker deployment via Cloudflare API.
# Useful for recovering from intermittent asset 404s without running wrangler deploy.
#
# Usage: ./scripts/cf-redeploy.sh
# Requires: CF_WORKER_API_TOKEN in .env

set -euo pipefail

ACCOUNT_ID="0c909b900ea10618976ab9d43c3613b5"
SCRIPT_NAME="servewellnet"

# Load token from .env
if [[ ! -f .env ]]; then
  echo "Error: .env file not found" >&2
  exit 1
fi
TOKEN="$(grep '^CF_WORKER_API_TOKEN=' .env | cut -d= -f2)"
if [[ -z "$TOKEN" ]]; then
  echo "Error: CF_WORKER_API_TOKEN not found in .env" >&2
  exit 1
fi

# Get the latest deployed version ID
echo "Fetching latest deployment version..."
LATEST_VERSION="$(curl -s \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/deployments" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['deployments'][0]['versions'][0]['version_id'])")"

if [[ -z "$LATEST_VERSION" ]]; then
  echo "Error: could not determine latest version ID" >&2
  exit 1
fi

echo "Re-promoting version: ${LATEST_VERSION}"

RESULT="$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/deployments" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"versions\":[{\"version_id\":\"${LATEST_VERSION}\",\"percentage\":100}]}")"

SUCCESS="$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['success'])")"

if [[ "$SUCCESS" == "True" ]]; then
  echo "✅ Redeploy succeeded."
  echo "Verifying site..."
  sleep 5
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" https://servewell.net/-/Genesis/1)"
  echo "  /-/Genesis/1 → HTTP ${STATUS}"
else
  echo "❌ Redeploy failed:" >&2
  echo "$RESULT" >&2
  exit 1
fi
