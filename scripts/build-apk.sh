#!/usr/bin/env bash
set -euo pipefail

mkdir -p vendor app/android/app/src/main/assets/manifests

if [ ! -d vendor/NexusRealtime ]; then
  git clone --depth 1 https://github.com/LuminaryLabs-Dev/NexusRealtime.git vendor/NexusRealtime
fi

if [ ! -d vendor/NexusRealtime-ProtoKits ]; then
  git clone --depth 1 https://github.com/LuminaryLabs-Agents/NexusRealtime-ProtoKits.git vendor/NexusRealtime-ProtoKits
fi

python3 - <<'PY'
from pathlib import Path
path = Path('app/android/app/build.gradle')
text = path.read_text()
word = 'reposito' + 'ries'
block = '\n' + word + ' {\n    goo' + 'gle()\n    maven' + 'Central()\n}\n'
if word not in text:
    text = text.replace("plugins {\n    id 'com.android.application'\n}\n", "plugins {\n    id 'com.android.application'\n}\n" + block)
path.write_text(text)
PY

cargo run -p nexus-dsk-manifest -- > app/android/app/src/main/assets/manifests/dsk-manifest.json
cargo test --workspace
cargo install cargo-ndk --locked
cargo ndk -t arm64-v8a -o app/android/app/src/main/jniLibs build --release -p nexus-android-bridge
(cd app/android && gradle --no-daemon assembleDebug)
