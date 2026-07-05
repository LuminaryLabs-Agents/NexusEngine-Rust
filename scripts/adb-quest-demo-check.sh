#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ID="$(python3 - <<'PY'
import json
with open('build.json', 'r', encoding='utf-8') as handle:
    print(json.load(handle)['app']['applicationId'])
PY
)"
ACTIVITY="${PACKAGE_ID}/dev.luminarylabs.nexusrealtime.MainActivity"
APK_PATH="${APK_PATH:-app/android/app/build/outputs/apk/debug/app-debug.apk}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not installed or not on PATH."
  exit 2
fi

if [ ! -f "${APK_PATH}" ]; then
  echo "APK not found at ${APK_PATH}. Run make quest-apk first."
  exit 2
fi

DEVICE_COUNT="$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
if [ "${DEVICE_COUNT}" = "0" ]; then
  echo "No adb device is connected and authorized."
  adb devices
  if adb devices | awk 'NR > 1 && $2 == "unauthorized" { found=1 } END { exit found ? 0 : 1 }'; then
    echo "A device is connected but unauthorized. Accept the USB debugging prompt inside the headset/device, then rerun make adb-quest-check."
  fi
  exit 2
fi

adb install -r "${APK_PATH}"
adb logcat -c
adb shell am start -n "${ACTIVITY}"
sleep 6

LOG_OUTPUT="$(adb logcat -d -s NexusQuestDemo:I '*:S' || true)"
echo "${LOG_OUTPUT}"

echo "${LOG_OUTPUT}" | grep -F "quest-demo-frame" >/dev/null
echo "${LOG_OUTPUT}" | grep -F "initStatus=" >/dev/null
echo "ADB Quest demo check passed."
