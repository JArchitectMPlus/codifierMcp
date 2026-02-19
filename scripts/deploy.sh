#!/usr/bin/env bash
set -euo pipefail

APP_NAME="codifier-mcp"
HEALTH_URL="https://${APP_NAME}.fly.dev/health"

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Pre-flight checks ──────────────────────────────────────────────
command -v flyctl >/dev/null 2>&1 || error "flyctl is not installed. Install from https://fly.io/docs/flyctl/install/"

# ── Load secrets from .env ─────────────────────────────────────────
ENV_FILE="${BASH_SOURCE[0]%/*}/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  error ".env file not found at $ENV_FILE — copy .env.example to .env and fill in your values"
fi

info "Loading secrets from .env"

SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
API_AUTH_TOKEN=""

while IFS='=' read -r key value; do
  # Skip comments and blank lines
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  case "$key" in
    SUPABASE_URL)              SUPABASE_URL="$value" ;;
    SUPABASE_SERVICE_ROLE_KEY) SUPABASE_SERVICE_ROLE_KEY="$value" ;;
    API_AUTH_TOKEN)             API_AUTH_TOKEN="$value" ;;
  esac
done < "$ENV_FILE"

# ── Generate API_AUTH_TOKEN if missing ─────────────────────────────
if [[ -z "$API_AUTH_TOKEN" ]]; then
  info "No API_AUTH_TOKEN found in .env — generating one"
  API_AUTH_TOKEN=$(openssl rand -base64 32)
  echo "" >> "$ENV_FILE"
  echo "API_AUTH_TOKEN=$API_AUTH_TOKEN" >> "$ENV_FILE"
  info "Token saved to .env"
fi

# ── Validate required secrets ──────────────────────────────────────
[[ -z "$SUPABASE_URL" ]]              && error "SUPABASE_URL is missing from .env"
[[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]] && error "SUPABASE_SERVICE_ROLE_KEY is missing from .env"

info "All required secrets present"

# ── Set secrets on Fly.io ──────────────────────────────────────────
info "Setting secrets on Fly.io (this does NOT require running machines)"
flyctl secrets set \
  API_AUTH_TOKEN="$API_AUTH_TOKEN" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  -a "$APP_NAME" --stage

info "Secrets staged successfully"

# ── Deploy ─────────────────────────────────────────────────────────
info "Deploying $APP_NAME to Fly.io..."
flyctl deploy -a "$APP_NAME"

info "Deploy complete"

# ── Health check ───────────────────────────────────────────────────
info "Waiting for health check at $HEALTH_URL ..."
RETRIES=10
DELAY=5
for i in $(seq 1 $RETRIES); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || true)
  if [[ "$STATUS" == "200" ]]; then
    info "Health check passed"
    break
  fi
  if [[ "$i" -eq "$RETRIES" ]]; then
    warn "Health check did not return 200 after $((RETRIES * DELAY))s (last status: $STATUS)"
    warn "Check logs with: flyctl logs -a $APP_NAME"
    exit 0
  fi
  echo "  Attempt $i/$RETRIES — status $STATUS, retrying in ${DELAY}s..."
  sleep "$DELAY"
done

# ── Summary ────────────────────────────────────────────────────────
echo ""
info "Deployment successful!"
echo ""
echo "  App:      https://${APP_NAME}.fly.dev"
echo "  Health:   ${HEALTH_URL}"
echo "  MCP:      https://${APP_NAME}.fly.dev/mcp"
echo ""
echo "  Your API token (for MCP clients):"
echo "  $API_AUTH_TOKEN"
echo ""
echo "  Connect with Claude Code:"
echo "  claude mcp add --transport http codifier https://${APP_NAME}.fly.dev/mcp --header \"Authorization: Bearer $API_AUTH_TOKEN\""
echo ""
