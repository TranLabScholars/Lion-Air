#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REQUIRED_NODE="24.1.0"
REQUIRED_JDK="25.0.4.1"
REQUIRED_REACT="19.3.0"

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

check_version() {
  local name="$1" actual="$2" required="$3"

  if [[ "${actual%%.*}" != "${required%%.*}" ]]; then
    fail "$name $required required (major ${required%%.*}), found $actual"
  elif [[ "$actual" != "$required" ]]; then
    warn "$name $required expected, found $actual (same major version, continuing)"
  else
    ok "$name $actual"
  fi
}

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

command -v node >/dev/null 2>&1 || fail "Node.js is not installed"
command -v npm >/dev/null 2>&1 || fail "npm is not installed"
command -v java >/dev/null 2>&1 || fail "Java is not installed"
command -v docker >/dev/null 2>&1 || fail "Docker is not installed"

docker compose version >/dev/null 2>&1 ||
  fail "Docker Compose plugin is not available"

docker info >/dev/null 2>&1 ||
  fail "Docker daemon is not running"

NODE_VERSION="$(node -v | sed 's/^v//')"
check_version "Node.js" "$NODE_VERSION" "$REQUIRED_NODE"

JDK_VERSION="$(java -version 2>&1 | awk -F'"' '/version/ {print $2; exit}')"
[[ -n "$JDK_VERSION" ]] || fail "Unable to determine JDK version"
check_version "JDK" "$JDK_VERSION" "$REQUIRED_JDK"

[[ -d "$BACKEND_DIR" ]] || fail "Backend directory not found: $BACKEND_DIR"
[[ -d "$FRONTEND_DIR" ]] || fail "Frontend directory not found: $FRONTEND_DIR"
[[ -x "$BACKEND_DIR/mvnw" ]] ||
  fail "mvnw not found or not executable in $BACKEND_DIR"
[[ -f "$ROOT_DIR/.env" ]] || fail ".env not found in $ROOT_DIR"
[[ -f "$FRONTEND_DIR/package.json" ]] ||
  fail "package.json not found in $FRONTEND_DIR"

# ---------------------------------------------------------------------------
# 2. Check React version
# ---------------------------------------------------------------------------
REACT_VERSION="$(
  cd "$FRONTEND_DIR" &&
  node -p "require('./package.json').dependencies?.react || ''" |
    sed 's/^[^0-9]*//'
)"

[[ -n "$REACT_VERSION" ]] ||
  fail "React is not listed in $FRONTEND_DIR/package.json dependencies"

check_version "React" "$REACT_VERSION" "$REQUIRED_REACT"

# ---------------------------------------------------------------------------
# 3. Load environment variables
# ---------------------------------------------------------------------------
info "Loading environment from .env"

set -a
source "$ROOT_DIR/.env"
set +a

# ---------------------------------------------------------------------------
# 4. Start Docker Compose
# ---------------------------------------------------------------------------
if [[ -f "$COMPOSE_FILE" ]]; then
  info "Starting Docker Compose..."

  docker compose \
    --env-file "$ROOT_DIR/.env" \
    -f "$COMPOSE_FILE" \
    up -d

  ok "Docker Compose is up"
else
  warn "No docker-compose.yml found; skipping Docker Compose"
fi

# ---------------------------------------------------------------------------
# 5. Install frontend dependencies and synchronize lock file
# ---------------------------------------------------------------------------
info "Installing frontend dependencies..."

(
  cd "$FRONTEND_DIR"

  npm install ||
    fail "npm install failed. Check package.json and npm errors."

  [[ -f package-lock.json ]] ||
    fail "package-lock.json was not generated"

  npm ls --depth=0 ||
    fail "Frontend dependencies are missing or invalid"

  ok "Frontend dependencies installed and lock file synchronized"
)

# ---------------------------------------------------------------------------
# 6. Build backend
# ---------------------------------------------------------------------------
info "Building backend (Maven)..."

(
  cd "$BACKEND_DIR"
  ./mvnw clean install -DskipTests
)

ok "Backend build finished"

# ---------------------------------------------------------------------------
# 7. Build frontend
# ---------------------------------------------------------------------------
info "Building frontend..."

(
  cd "$FRONTEND_DIR"
  npm run build
)

ok "Frontend build finished"

# ---------------------------------------------------------------------------
# 8. Start backend and frontend
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

(
  cd "$BACKEND_DIR"
  exec ./mvnw spring-boot:run
) &
PIDS+=("$!")

info "Starting React frontend..."

(
  cd "$FRONTEND_DIR"
  exec npm run "$FRONTEND_DEV_CMD"
) &
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
