#!/bin/bash
set -euo pipefail

# Usage:
#   ./start.sh            build and run everything (database, backend, frontend)
#   ./start.sh docker       start only the Docker containers (database)
#   ./start.sh docker-down  stop the Docker containers (data is kept in the volume)
#   ./start.sh docker-init  create a starter ms_padashboard/compose.yaml, ONLY if the project has none

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REQUIRED_NODE_MAJOR=24
MIN_JAVA_MAJOR=21

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/ms_padashboard"
FRONTEND_DIR="$ROOT_DIR/webapp"
# The compose file lives with the backend. Docker names the project after its folder (ms_padashboard).
# Override with COMPOSE_FILE=/path/to/file ./start.sh if needed.
COMPOSE_FILE="${COMPOSE_FILE:-$BACKEND_DIR/compose.yaml}"
FRONTEND_DEV_CMD="start"
COMMAND="${1:-all}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info() { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
ok()   { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m  $*" >&2; exit 1; }

load_env() {
  [[ -f "$ROOT_DIR/.env" ]] || fail ".env not found in $ROOT_DIR"
  info "Loading environment from .env"
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
}

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "docker is not installed"
  docker info >/dev/null 2>&1 || fail "Docker daemon is not running"
}

# Returns 0 if the project already has a compose file under any of the standard names.
has_compose_file() {
  local f
  [[ -f "$COMPOSE_FILE" ]] && return 0
  for f in "$BACKEND_DIR"/compose.yaml "$BACKEND_DIR"/compose.yml "$BACKEND_DIR"/docker-compose.yml \
           "$BACKEND_DIR"/docker-compose.yaml "$ROOT_DIR"/compose.yaml "$ROOT_DIR"/docker-compose.yml; do
    if [[ -f "$f" ]]; then COMPOSE_FILE="$f"; return 0; fi
  done
  return 1
}

# Never runs automatically. Writes a starter PostgreSQL compose file, and only when none exists,
# so it can't create a second container next to an existing setup.
init_compose_file() {
  if has_compose_file; then
    fail "A compose file already exists ($COMPOSE_FILE); not creating another"
  fi
  COMPOSE_FILE="$BACKEND_DIR/compose.yaml"
  warn "Creating a starter compose.yaml (SQL Server). Set DB_PASSWORD (and optionally DB_PORT) in .env;"
  warn "the password must meet SQL Server complexity rules, and you still need to create your database."
  cat > "$COMPOSE_FILE" <<'YAML'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-padashboard}
      POSTGRES_USER: ${DB_USER:-padashboard}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Set DB_PASSWORD in .env}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-padashboard} -d ${DB_NAME:-padashboard}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 20s

volumes:
  db_data:
YAML
  ok "Created $COMPOSE_FILE (not started; run ./start.sh docker)"
}

# Starts the existing compose file exactly as the original script did.
# $1 = "required" makes a missing file an error (used by the docker command).
docker_up() {
  require_docker
  if ! has_compose_file; then
    [[ "${1:-}" == "required" ]] && fail "No compose file found in $BACKEND_DIR (run ./start.sh docker-init to create one)"
    warn "No compose file found in $BACKEND_DIR; skipping Docker Compose"
    return 0
  fi
  info "Starting Docker Compose ($COMPOSE_FILE)..."
  docker compose --env-file "$ROOT_DIR/.env" -f "$COMPOSE_FILE" up -d
  ok "Docker Compose is up"
}

docker_down() {
  require_docker
  has_compose_file || fail "No compose file found in $BACKEND_DIR"
  docker compose --env-file "$ROOT_DIR/.env" -f "$COMPOSE_FILE" down
  ok "Docker containers stopped"
}

# ---------------------------------------------------------------------------
# Docker-only commands
# ---------------------------------------------------------------------------
case "$COMMAND" in
  docker)      load_env; docker_up required; exit 0 ;;
  docker-down) load_env; docker_down;        exit 0 ;;
  docker-init) init_compose_file;            exit 0 ;;
  all)         ;;
  *)           fail "Unknown command '$COMMAND' (use: all | docker | docker-down | docker-init)" ;;
esac

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

for cmd in node npm java docker curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is not installed"
done

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

# ---------------------------------------------------------------------------
# 2. Load environment variables
# ---------------------------------------------------------------------------
load_env

# The PurpleAir key is read by the Spring backend (PURPLEAIR_API_KEY) and never by the frontend.
if [[ -z "${PURPLEAIR_API_KEY:-}" ]]; then
  warn "PURPLEAIR_API_KEY is not set in .env, so sensor data requests will fail"
fi
if [[ -n "${REACT_APP_PURPLEAIR_API_KEY:-}" ]]; then
  warn "REACT_APP_PURPLEAIR_API_KEY is still set; remove it, it would be exposed in the browser"
fi

# ---------------------------------------------------------------------------
# 3. Start Docker Compose (database)
# ---------------------------------------------------------------------------
docker_up

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

# The frontend must not start before the API answers, otherwise its first requests fail
# ("Failed to fetch") until the page is refreshed.
BACKEND_URL="${BACKEND_URL:-http://localhost:8080/api/v1/sensors}"
BACKEND_WAIT_SECONDS="${BACKEND_WAIT_SECONDS:-180}"
wait_for_backend() {
  local pid="$1" waited=0
  info "Waiting for backend at $BACKEND_URL ..."
  # Any HTTP status means the server is up; 000 means the connection failed.
  until [[ "$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND_URL" || true)" != "000" ]]; do
    kill -0 "$pid" 2>/dev/null || fail "Backend stopped before it became ready"
    waited=$((waited + 1))
    [[ "$waited" -lt "$BACKEND_WAIT_SECONDS" ]] || fail "Backend not ready after ${BACKEND_WAIT_SECONDS}s"
    sleep 1
  done
  ok "Backend is up"
}
wait_for_backend "${PIDS[0]}"

info "Starting React frontend..."
(cd "$FRONTEND_DIR" && exec npm run "$FRONTEND_DEV_CMD") &
PIDS+=("$!")

echo
echo "============================================"
echo "  Starting Lion Air Dashboard..."
echo "============================================"
echo
echo "  Frontend -> http://localhost:3000"
echo "  Backend  -> http://localhost:8080"
echo
echo "Press Ctrl+C to stop both services."

wait
