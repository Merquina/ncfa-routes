#!/usr/bin/env bash
set -euo pipefail

# Launch Vite dev server and open the page in Flatpak Chromium
# with Chrome DevTools remote debugging enabled.
#
# Env vars:
#   PORT          - Dev server port (default: 5173)
#   DEV_URL       - Full URL to open (overrides PORT), e.g. http://localhost:5173
#   DEBUG_PORT    - Remote debugging port for Chromium (default: 9222)
#   VITE_BIN      - Vite binary (default: npm run dev)

PORT="${PORT:-5173}"
DEV_URL="${DEV_URL:-http://localhost:${PORT}}"
DEBUG_PORT="${DEBUG_PORT:-9222}"
VITE_BIN="${VITE_BIN:-npm run dev}"

echo "[dev-chromium] Using dev URL: ${DEV_URL}"

# Verify flatpak and Chromium flatpak are available
if ! command -v flatpak >/dev/null 2>&1; then
  echo "[dev-chromium] Error: flatpak not found in PATH" >&2
  exit 1
fi

if ! flatpak info org.chromium.Chromium >/dev/null 2>&1; then
  echo "[dev-chromium] Error: Flatpak app 'org.chromium.Chromium' not found. Install via:"
  echo "  flatpak install flathub org.chromium.Chromium" >&2
  exit 1
fi

# Start Vite dev server in background; disable auto-open
echo "[dev-chromium] Starting Vite dev server..."
set -m
DISABLE_OPEN=1 VITE_OPEN=false ${VITE_BIN} &
DEV_PID=$!

# Ensure we clean up on exit
cleanup() {
  echo "\n[dev-chromium] Shutting down dev server (pid ${DEV_PID})..."
  if ps -p ${DEV_PID} >/dev/null 2>&1; then
    kill ${DEV_PID} || true
    wait ${DEV_PID} 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Wait for dev server to respond
echo -n "[dev-chromium] Waiting for dev server at ${DEV_URL} "
for i in $(seq 1 120); do
  if curl -sSf -o /dev/null "${DEV_URL}"; then
    echo "\n[dev-chromium] Dev server is up."
    break
  fi
  echo -n "."
  sleep 0.5
done

# Launch Flatpak Chromium with remote debugging and open the dev URL
echo "[dev-chromium] Launching Chromium (remote debugging port ${DEBUG_PORT})..."
flatpak run org.chromium.Chromium \
  --remote-debugging-port="${DEBUG_PORT}" \
  "${DEV_URL}" &
CHROME_PID=$!

echo "[dev-chromium] Chromium PID: ${CHROME_PID}  |  Dev server PID: ${DEV_PID}"
echo "[dev-chromium] Press Ctrl+C to stop."

# Keep foreground attached to dev server; exit when it does
wait ${DEV_PID}

