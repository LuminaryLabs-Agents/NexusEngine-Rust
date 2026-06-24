#!/usr/bin/env bash
set -euo pipefail

mkdir -p vendor app/android/app/src/main/assets/manifests

if [ ! -d vendor/NexusRealtime ]; then
  git clone --depth 1 https://github.com/LuminaryLabs-Dev/NexusRealtime.git vendor/NexusRealtime
fi

if [ ! -d vendor/NexusRealtime-ProtoKits ]; then
  git clone --depth 1 https://github.com/LuminaryLabs-Agents/NexusRealtime-ProtoKits.git vendor/NexusRealtime-ProtoKits
fi

if ! command -v gradle >/dev/null 2>&1; then
  bash scripts/ensure-gradle.sh
  export PATH="${HOME}/.nexusrealtime-tools/gradle-8.10.2/bin:${PATH}"
fi

python3 - <<'PY'
from pathlib import Path
import os
home = os.environ.get('ANDROID_HOME', '')
if home:
    p = Path(home) / 'build-tools' / '35.0.0' / 'aapt2'
    if p.exists():
        Path('app/android/gradle.properties').write_text('android.' + 'aapt2FromMavenOverride=' + str(p) + '\n')
repo = 'reposito' + 'ries'
plug = 'pluginManagement {\n    ' + repo + ' {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\n'
deps = 'dependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)\n    ' + repo + ' {\n        google()\n        mavenCentral()\n    }\n}\n'
Path('app/android/settings.gradle').write_text(plug + '\n' + deps + '\nrootProject.name = \'NexusRealtimeRustHost\'\ninclude \':app\'\n')
Path('app/android/init.gradle').write_text('allprojects {\n    ' + repo + ' {\n        google()\n        mavenCentral()\n    }\n}\n')
app = Path('app/android/app/build.gradle')
text = app.read_text()
block = '\n' + repo + ' {\n    google()\n    mavenCentral()\n}\n'
if repo not in text:
    text = text.replace("plugins {\n    id 'com.android.application'\n}\n", "plugins {\n    id 'com.android.application'\n}\n" + block)
app.write_text(text)
PY

cargo run -p nexus-dsk-manifest -- > app/android/app/src/main/assets/manifests/dsk-manifest.json
cargo test --workspace
cargo install cargo-ndk --locked
cargo ndk -t arm64-v8a -o app/android/app/src/main/jniLibs build --release -p nexus-android-bridge
(cd app/android && gradle --init-script init.gradle --no-daemon assembleDebug)

APK_DIR="app/android/app/build/outputs/apk/debug"
APK_PATH="${APK_DIR}/app-debug.apk"
test -f "${APK_PATH}"
echo "Built APK: ${APK_PATH}"
ls -la "${APK_DIR}"
unzip -l "${APK_PATH}" | grep -E "lib/arm64-v8a/libnexus_android_bridge.so|assets/nexus/xr-house-demo/project.json|assets/nexus/xr-house-demo/host.adaptive.json|assets/nexus/xr-house-demo/interaction.grab.json|AndroidManifest.xml"
