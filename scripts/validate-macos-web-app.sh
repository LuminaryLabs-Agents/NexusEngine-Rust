#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-dist/packager/artifacts/macos-app/DefaultRustProject.app}"
MANIFEST="${APP_DIR}/Contents/Resources/app/nexus-package-manifest.json"
PROJECT_JSON="${APP_DIR}/Contents/Resources/app/project.json"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "macOS app validation requires Darwin/macOS." >&2
  exit 2
fi

if [ ! -d "${APP_DIR}" ]; then
  echo "App bundle not found: ${APP_DIR}" >&2
  exit 2
fi

EXECUTABLE="${APP_DIR}/Contents/MacOS/NexusPackagedWebApp"
if [ ! -x "${EXECUTABLE}" ]; then
  echo "App executable not found or not executable: ${EXECUTABLE}" >&2
  exit 2
fi
PROCESS_NAME="$(basename "${EXECUTABLE}")"

META="$(python3 - "${MANIFEST}" "${PROJECT_JSON}" <<'PY'
import json
import sys
from pathlib import Path

manifest = Path(sys.argv[1])
project = Path(sys.argv[2])
payload = json.loads(manifest.read_text())
project_payload = json.loads(project.read_text()) if project.exists() else {}
print(payload.get("appName") or "Nexus Packaged App")
print(payload.get("slug") or "nexus-packaged-app")
print(project_payload.get("validation", {}).get("expectedCubeId") or "")
PY
)"
APP_NAME="$(printf '%s\n' "${META}" | sed -n '1p')"
SLUG="$(printf '%s\n' "${META}" | sed -n '2p')"
EXPECTED_CUBE_ID="$(printf '%s\n' "${META}" | sed -n '3p')"
EXPECTED_SLUG="${EXPECTED_SLUG:-${SLUG}}"
EXPECTED_APP_NAME="${EXPECTED_APP_NAME:-${APP_NAME}}"
EXPECTED_KIT_HASHES="${EXPECTED_KIT_HASHES:-kits/primitive-cube-object-kit.mjs}"
OUT_DIR="${OUT_DIR:-output/${SLUG}/macos-app}"
SCREENSHOT="${OUT_DIR}/${SLUG}-macos-app.png"
LOG_FILE="${OUT_DIR}/${SLUG}-macos-app.log"

python3 - "${MANIFEST}" "${EXPECTED_SLUG}" "${EXPECTED_APP_NAME}" "${EXPECTED_KIT_HASHES}" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
expected_slug = sys.argv[2]
expected_app_name = sys.argv[3]
expected_hashes = [item for item in sys.argv[4].split(",") if item]
if payload.get("slug") != expected_slug:
    raise SystemExit(f"unexpected package slug: {payload.get('slug')}")
if payload.get("appName") != expected_app_name:
    raise SystemExit(f"unexpected app name: {payload.get('appName')}")
web_hashes = payload.get("webHashes", {})
for expected in expected_hashes:
    if expected not in web_hashes:
        raise SystemExit(f"{expected} was not packaged into webHashes")
PY

mkdir -p "${OUT_DIR}"
rm -f "${LOG_FILE}" "${SCREENSHOT}"

cleanup() {
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
}
trap cleanup EXIT

open -n "${APP_DIR}" >"${LOG_FILE}" 2>&1
sleep 3
if ! osascript -e "application \"${APP_NAME}\" is running" | grep -F true >/dev/null; then
  echo "Packaged macOS app did not stay running." >&2
  cat "${LOG_FILE}" >&2 || true
  exit 1
fi

osascript -e "tell application \"${APP_NAME}\" to activate" >/dev/null 2>&1 || true
WINDOW_BOUNDS="$(osascript - "${PROCESS_NAME}" "${APP_NAME}" <<'OSA' 2>/dev/null || true
on run argv
  set processName to item 1 of argv
  set appName to item 2 of argv
  tell application "System Events"
    if exists process processName then
      set targetProcess to process processName
    else if exists process appName then
      set targetProcess to process appName
    else
      return ""
    end if
    set frontmost of targetProcess to true
    delay 1
    if (count of windows of targetProcess) is 0 then
      return ""
    end if
    set targetWindow to front window of targetProcess
    set windowPosition to position of targetWindow
    set windowSize to size of targetWindow
    set windowX to (item 1 of windowPosition) as integer
    set windowY to (item 2 of windowPosition) as integer
    set windowWidth to (item 1 of windowSize) as integer
    set windowHeight to (item 2 of windowSize) as integer
    return (windowX as text) & "," & (windowY as text) & "," & (windowWidth as text) & "," & (windowHeight as text)
  end tell
end run
OSA
)"
sleep 1

if command -v screencapture >/dev/null 2>&1; then
  if [ -n "${WINDOW_BOUNDS}" ]; then
    screencapture -x -R"${WINDOW_BOUNDS}" "${SCREENSHOT}"
  else
    screencapture -x "${SCREENSHOT}"
  fi
  test -s "${SCREENSHOT}"
  echo "macOS app screenshot: ${SCREENSHOT}"
else
  echo "screencapture unavailable; process and manifest checks passed."
fi

echo "macOS packaged app validation passed: ${APP_DIR}"
