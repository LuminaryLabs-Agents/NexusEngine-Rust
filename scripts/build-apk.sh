#!/usr/bin/env bash
set -euo pipefail

BUILD_JSON="build.json"

json_get() {
  python3 - "$1" <<'PY'
import json
import sys
key = sys.argv[1]
with open('build.json', 'r', encoding='utf-8') as handle:
    data = json.load(handle)
for part in key.split('.'):
    if isinstance(data, list):
        data = data[int(part)]
    else:
        data = data[part]
if isinstance(data, bool):
    print('true' if data else 'false')
elif isinstance(data, list):
    print(' '.join(str(item) for item in data))
else:
    print(data)
PY
}

json_list_lines() {
  python3 - "$1" <<'PY'
import json
import sys
key = sys.argv[1]
with open('build.json', 'r', encoding='utf-8') as handle:
    data = json.load(handle)
for part in key.split('.'):
    data = data[part]
for item in data:
    print(item)
PY
}

python3 -m json.tool "${BUILD_JSON}" >/dev/null

if command -v rustup >/dev/null 2>&1; then
  RUSTUP_CARGO="$(rustup which cargo 2>/dev/null || true)"
  if [ -n "${RUSTUP_CARGO}" ]; then
    export PATH="$(dirname "${RUSTUP_CARGO}"):${PATH}"
  fi
fi

if [ -z "${JAVA_HOME:-}" ] && [ -x /opt/homebrew/opt/openjdk/bin/java ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -d /opt/homebrew/share/android-commandlinetools ]; then
  export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
fi

if [ -z "${ANDROID_SDK_ROOT:-}" ] && [ -n "${ANDROID_HOME:-}" ]; then
  export ANDROID_SDK_ROOT="${ANDROID_HOME}"
fi

if [ -z "${ANDROID_NDK_HOME:-}" ] && [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}/ndk" ]; then
  ANDROID_NDK_HOME="$(find "${ANDROID_HOME}/ndk" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
  export ANDROID_NDK_HOME
fi

CORE_REPO="$(json_get repos.core)"
PROTOKITS_REPO="$(json_get repos.protokits)"
ANDROID_COMPILE_SDK="$(json_get android.compileSdk)"
ANDROID_BUILD_TOOLS="$(json_get android.buildTools)"
ANDROID_NDK_VERSION="$(json_get android.ndkVersion)"
ANDROID_ABI="$(json_get android.abiFilters.0)"
APK_FILE_NAME="$(json_get artifacts.apkFileName)"

mkdir -p vendor app/android/app/src/main/assets/manifests app/android/app/src/main/assets/nexus/quest-cube-demo
cp local-kits/quest-xr-frame-loop-kit.mjs app/android/app/src/main/assets/nexus/quest-cube-demo/quest-xr-frame-loop-kit.mjs

if [ ! -d vendor/NexusRealtime ]; then
  git clone --depth 1 "${CORE_REPO}" vendor/NexusRealtime
fi

if [ ! -d vendor/NexusRealtime-ProtoKits ]; then
  git clone --depth 1 "${PROTOKITS_REPO}" vendor/NexusRealtime-ProtoKits
fi

if command -v sdkmanager >/dev/null 2>&1 && command -v java >/dev/null 2>&1; then
  yes | sdkmanager \
    "platform-tools" \
    "platforms;android-${ANDROID_COMPILE_SDK}" \
    "build-tools;${ANDROID_BUILD_TOOLS}" \
    "ndk;${ANDROID_NDK_VERSION}" || true
elif ! command -v java >/dev/null 2>&1; then
  echo "Java runtime not found; skipping sdkmanager install step."
fi

if ! command -v gradle >/dev/null 2>&1; then
  bash scripts/ensure-gradle.sh
  export PATH="${HOME}/.nexusrealtime-tools/gradle-8.10.2/bin:${PATH}"
fi

python3 - <<'PY'
from pathlib import Path
import json
import os
with open('build.json', 'r', encoding='utf-8') as handle:
    build = json.load(handle)
home = os.environ.get('ANDROID_HOME', '')
build_tools = build['android']['buildTools']
if home:
    p = Path(home) / 'build-tools' / build_tools / 'aapt2'
    if p.exists():
        Path('app/android/gradle.properties').write_text('android.' + 'aapt2FromMavenOverride=' + str(p) + '\n')
repo = 'reposito' + 'ries'
plug = 'pluginManagement {\n    ' + repo + ' {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\n'
deps = 'dependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)\n    ' + repo + ' {\n        google()\n        mavenCentral()\n    }\n}\n'
Path('app/android/settings.gradle').write_text(plug + '\n' + deps + '\nrootProject.name = \'NexusRealtimeRustHost\'\ninclude \':app\'\n')
Path('app/android/init.gradle').write_text('allprojects {\n    ' + repo + ' {\n        google()\n        mavenCentral()\n    }\n}\n')
PY

cargo run -p nexus-dsk-manifest -- > app/android/app/src/main/assets/manifests/dsk-manifest.json
node local-kits/tests/quest-xr-frame-loop-kit.test.mjs
cargo test --workspace
cargo install cargo-ndk --locked
cargo ndk -t "${ANDROID_ABI}" -o app/android/app/src/main/jniLibs build --release -p nexus-android-bridge
(cd app/android && gradle --init-script init.gradle --no-daemon assembleDebug)

APK_DIR="app/android/app/build/outputs/apk/debug"
APK_PATH="${APK_DIR}/${APK_FILE_NAME}"
test -f "${APK_PATH}"
echo "Built APK: ${APK_PATH}"
ls -la "${APK_DIR}"

while IFS= read -r required_entry; do
  echo "Validating APK entry: ${required_entry}"
  unzip -l "${APK_PATH}" | grep -F "${required_entry}"
done < <(json_list_lines validation.requiredApkEntries)
