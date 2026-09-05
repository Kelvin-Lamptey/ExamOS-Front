#!/usr/bin/env bash

set -Eeuo pipefail

# Start the student UI and the standalone seeded Exam OS service for local demos.
# Set EXAMOS_BACKEND_DIR when the Rust service is checked out elsewhere.

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${EXAMOS_BACKEND_DIR:-"$ROOT_DIR/../script"}"
BACKEND_URL="http://127.0.0.1:43100/v1"
FRONTEND_URL="http://127.0.0.1:1420"
STATE_DIR="${EXAMOS_STATE_DIR:-/tmp/examos-local}"
BACKEND_LOG="$STATE_DIR/backend.log"
FRONTEND_LOG="$STATE_DIR/frontend.log"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"
BACKEND_UNIT="examos-backend.service"
FRONTEND_UNIT="examos-frontend.service"
OPEN_BROWSER=0

mkdir -p "$STATE_DIR"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"
[ -d "$BACKEND_DIR" ] || die "backend directory not found: $BACKEND_DIR"

CARGO_BIN="${CARGO_BIN:-$(command -v cargo || true)}"
NPM_BIN="${NPM_BIN:-$(command -v npm || true)}"
[ -n "$CARGO_BIN" ] || die "cargo is required (set CARGO_BIN to its absolute path)"
[ -n "$NPM_BIN" ] || die "npm is required (set NPM_BIN to its absolute path)"

http_ok() {
  curl -fsS --max-time 2 "$1" >/dev/null 2>&1
}

port_busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | rg -q ":$1[[:space:]]"
  else
    return 1
  fi
}

systemd_user_available() {
  command -v systemd-run >/dev/null 2>&1 &&
    command -v systemctl >/dev/null 2>&1 &&
    systemctl --user show-environment >/dev/null 2>&1
}

unit_active() {
  systemctl --user is-active --quiet "$1" 2>/dev/null
}

clear_unit_failure() {
  systemctl --user stop "$1" >/dev/null 2>&1 || true
  systemctl --user reset-failed "$1" >/dev/null 2>&1 || true
}

start_backend_systemd() {
  clear_unit_failure "$BACKEND_UNIT"
  for _ in 1 2 3; do
    if systemd-run --user --unit=examos-backend --collect \
      --working-directory="$BACKEND_DIR" \
      /bin/sh -lc "unset SMARTSCRIPT_URL; exec '$CARGO_BIN' run" \
      >>"$BACKEND_LOG" 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_frontend_systemd() {
  clear_unit_failure "$FRONTEND_UNIT"
  for _ in 1 2 3; do
    if systemd-run --user --unit=examos-frontend --collect \
      --working-directory="$ROOT_DIR" \
      /bin/sh -lc "exec '$NPM_BIN' run dev -- --host 127.0.0.1 --port 1420" \
      >>"$FRONTEND_LOG" 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_backend_background() {
  (
    cd "$BACKEND_DIR"
    exec nohup env -u SMARTSCRIPT_URL "$CARGO_BIN" run \
      >>"$BACKEND_LOG" 2>&1 < /dev/null
  ) &
  printf '%s\n' "$!" >"$BACKEND_PID_FILE"
}

start_frontend_background() {
  (
    cd "$ROOT_DIR"
    exec nohup "$NPM_BIN" run dev -- --host 127.0.0.1 --port 1420 \
      >>"$FRONTEND_LOG" 2>&1 < /dev/null
  ) &
  printf '%s\n' "$!" >"$FRONTEND_PID_FILE"
}

stop_pid_file() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(<"$pid_file")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

stop_services() {
  if systemd_user_available; then
    systemctl --user stop "$BACKEND_UNIT" "$FRONTEND_UNIT" >/dev/null 2>&1 || true
  fi
  stop_pid_file "$BACKEND_PID_FILE"
  stop_pid_file "$FRONTEND_PID_FILE"
  printf 'Exam OS local services stopped.\n'
}

wait_for_service() {
  local url="$1"
  local label="$2"
  local attempts=30
  until http_ok "$url"; do
    attempts=$((attempts - 1))
    if [ "$attempts" -le 0 ]; then
      printf '%s\n' "--- $label log ---" >&2
      if [ "$label" = "backend" ] && systemd_user_available; then
        journalctl --user -u "$BACKEND_UNIT" --no-pager -n 30 >&2 || true
      elif [ "$label" = "frontend" ] && systemd_user_available; then
        journalctl --user -u "$FRONTEND_UNIT" --no-pager -n 30 >&2 || true
      else
        tail -30 "$STATE_DIR/$label.log" >&2 || true
      fi
      die "$label did not become ready"
    fi
    sleep 1
  done
}

start_services() {
  if ! http_ok "$BACKEND_URL/health"; then
    if port_busy 43100; then
      die "port 43100 is already in use by a service that is not Exam OS"
    fi
    if systemd_user_available && ! start_backend_systemd; then
      printf 'systemd user service unavailable; using a detached process instead.\n' >&2
      start_backend_background
    elif ! systemd_user_available; then
      start_backend_background
    fi
    wait_for_service "$BACKEND_URL/health" backend
  fi

  if ! http_ok "$FRONTEND_URL/"; then
    if port_busy 1420; then
      die "port 1420 is already in use by another service"
    fi
    if systemd_user_available && ! start_frontend_systemd; then
      printf 'systemd user service unavailable; using a detached process instead.\n' >&2
      start_frontend_background
    elif ! systemd_user_available; then
      start_frontend_background
    fi
    wait_for_service "$FRONTEND_URL/" frontend
  fi

  printf '\nExam OS is running locally with seeded mock data.\n'
  printf 'Frontend:      %s\n' "$FRONTEND_URL"
  printf 'Backend health: %s/health\n' "$BACKEND_URL"
  printf 'Demo student:  GCTU-CS-001\n'
  printf 'Access code:   A7K2\n'
  printf '\nUse %s --stop to stop both services.\n' "$(basename "$0")"

  if [ "$OPEN_BROWSER" -eq 1 ] && command -v xdg-open >/dev/null 2>&1 &&
    [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
  fi
}

case "${1:-start}" in
  start)
    start_services
    ;;
  --open)
    OPEN_BROWSER=1
    start_services
    ;;
  stop|--stop)
    stop_services
    ;;
  restart|--restart)
    stop_services
    start_services
    ;;
  *)
    printf 'Usage: %s [start|--open|stop|--stop|restart|--restart]\n' "$(basename "$0")"
    exit 2
    ;;
esac
