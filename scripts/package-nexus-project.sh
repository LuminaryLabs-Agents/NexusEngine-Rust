#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-${1:-}}"
TARGETS="${TARGETS:-${2:-web-static,macos-app,android-apk,ios-sim,electron,windows-exe}}"
OUT_ROOT="${OUT_ROOT:-dist/packager}"
STRICT="${STRICT:-0}"

if [ -z "${PROJECT}" ]; then
  echo "PROJECT=/path/to/repo or first argument is required." >&2
  exit 1
fi

run_optional() {
  local label="$1"
  local status
  shift
  echo "==> Packaging ${label}"
  if "$@"; then
    return 0
  else
    status=$?
  fi
  if [ "${STRICT}" = "1" ]; then
    echo "${label} failed with status ${status}" >&2
    exit "${status}"
  fi
  echo "WARNING: ${label} failed with status ${status}; continuing because STRICT=0." >&2
}

electron_target_for_host() {
  case "$(uname -s)" in
    Darwin) echo "electron-mac" ;;
    Linux) echo "electron-linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "electron-win" ;;
    *) echo "electron" ;;
  esac
}

BUILD_JSON="$(cargo run --quiet -p nexus-packager -- package "${PROJECT}" --targets "${TARGETS}" --out "${OUT_ROOT}")"
echo "${BUILD_JSON}"

PACKAGE_DIR="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["packageDir"])' <<<"${BUILD_JSON}")"

IFS=',' read -r -a TARGET_ARRAY <<<"${TARGETS}"
for raw_target in "${TARGET_ARRAY[@]}"; do
  target="$(echo "${raw_target}" | xargs)"
  case "${target}" in
    ""|web-static)
      ;;
    native-rust-headless)
      run_optional native-rust-headless node scripts/compile-nexus-project.mjs "${PROJECT}" "${OUT_ROOT}"
      ;;
    macos-app)
      if [ "$(uname -s)" = "Darwin" ]; then
        run_optional macos-app bash scripts/package-macos-web-app.sh "${PACKAGE_DIR}" "${OUT_ROOT}"
      elif [ "${STRICT}" = "1" ]; then
        echo "macos-app requires macOS." >&2
        exit 1
      else
        echo "Skipping macos-app on non-macOS host."
      fi
      ;;
    android-apk)
      run_optional android-apk bash scripts/package-android-webview.sh "${PACKAGE_DIR}" "${OUT_ROOT}"
      ;;
    ios-sim)
      if [ "$(uname -s)" = "Darwin" ]; then
        run_optional ios-sim bash scripts/package-ios-sim-webview.sh "${PACKAGE_DIR}" "${OUT_ROOT}"
      elif [ "${STRICT}" = "1" ]; then
        echo "ios-sim requires macOS." >&2
        exit 1
      else
        echo "Skipping ios-sim on non-macOS host."
      fi
      ;;
    electron)
      run_optional electron env PACKAGE_TARGET="$(electron_target_for_host)" bash scripts/package-electron-web-app.sh "${PACKAGE_DIR}" "${OUT_ROOT}"
      ;;
    electron-mac|electron-linux|electron-win)
      run_optional "${target}" env PACKAGE_TARGET="${target}" bash scripts/package-electron-web-app.sh "${PACKAGE_DIR}" "${OUT_ROOT}"
      ;;
    windows-exe)
      case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
          run_optional windows-exe env PACKAGE_TARGET=windows-exe ELECTRON_PLATFORM=win32 bash scripts/package-electron-web-app.sh "${PACKAGE_DIR}" "${OUT_ROOT}"
          ;;
        *)
          if [ "${STRICT}" = "1" ]; then
            echo "windows-exe is built on a Windows runner." >&2
            exit 1
          fi
          echo "Skipping windows-exe on non-Windows host."
          ;;
      esac
      ;;
    *)
      if [ "${STRICT}" = "1" ]; then
        echo "Unknown package target: ${target}" >&2
        exit 1
      fi
      echo "Skipping unknown package target: ${target}" >&2
      ;;
  esac
done

find "${OUT_ROOT}/artifacts" -type f -maxdepth 3 2>/dev/null | sort || true
