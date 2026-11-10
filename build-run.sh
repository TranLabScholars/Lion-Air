#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REQUIRED_NODE_MAJOR=24
MIN_JAVA_MAJOR=21

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/ms_padashboard"
FRONTEND_DIR="$ROOT_DIR/webapp"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
FRONTEND_DEV_CMD="start"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info() { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
ok()   { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m  $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

for cmd in node npm java docker; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is not installed"
done

docker info >/dev/null 2>&1 || fail "Docker daemon is not running"

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[[ "$NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" ]] ||
  fail "Node.js $REQUIRED_NODE_MAJOR required, found $(node -v)"
ok "Node.js $(node -v)"

JAVA_MAJOR="$(java -version 2>&1 | awk -F'"' '/version/ {print $2; exit}' | cut -d. -f1)"
[[ "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || fail "Unable to determine Java version"
[[ "$JAVA_MAJOR" -ge "$MIN_JAVA_MAJOR" ]] ||
  fail "Java $MIN_JAVA_MAJOR+ required, found $JAVA_MAJOR"
ok "Java $JAVA_MAJOR"

[[ -x "$BACKEND_DIR/mvnw" ]]          || fail "mvnw not found or not executable in $BACKEND_DIR"
[[ -f "$FRONTEND_DIR/package.json" ]] || fail "package.json not found in $FRONTEND_DIR"
[[ -f "$ROOT_DIR/.env" ]]             || fail ".env not found in $ROOT_DIR"

# ---------------------------------------------------------------------------
# 2. Load environment variables
# ---------------------------------------------------------------------------
info "Loading environment from .env"
set -a
source "$ROOT_DIR/.env"
set +a

# ---------------------------------------------------------------------------
# 3. Start Docker Compose
# ---------------------------------------------------------------------------
if [[ -f "$COMPOSE_FILE" ]]; then
  info "Starting Docker Compose..."
  docker compose --env-file "$ROOT_DIR/.env" -f "$COMPOSE_FILE" up -d
  ok "Docker Compose is up"
else
  warn "No docker-compose.yml found; skipping Docker Compose"
fi

# ---------------------------------------------------------------------------
# 4. Install frontend dependencies (only if missing)
# ---------------------------------------------------------------------------
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  info "node_modules not found, installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
else
  ok "Frontend dependencies already installed"
fi

# ---------------------------------------------------------------------------
# 5. Build
# ---------------------------------------------------------------------------
info "Building backend (Maven)..."
(cd "$BACKEND_DIR" && ./mvnw clean install -DskipTests)
ok "Backend build finished"

info "Building frontend..."
(cd "$FRONTEND_DIR" && npm run build)
ok "Frontend build finished"

# ---------------------------------------------------------------------------
# 6. Start backend and frontend
# ---------------------------------------------------------------------------
PIDS=()

cleanup() {
  echo
  info "Stopping services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

info "Starting backend..."
(cd "$BACKEND_DIR" && exec ./mvnw spring-boot:run) &
PIDS+=("$!")

info "Starting React frontend..."
(cd "$FRONTEND_DIR" && exec npm run "$FRONTEND_DEV_CMD") &
PIDS+=("$!")

echo
echo "============================================"
echo "  Starting Farmer Dashboard..."
echo "============================================"
echo
echo "  Frontend -> http://localhost:3000"
echo "  Backend  -> http://localhost:8080"
echo
echo "Press Ctrl+C to stop both services."

wait
