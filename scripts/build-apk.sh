#!/usr/bin/env bash
set -euo pipefail

mkdir -p vendor app/android/app/src/main/assets/manifests

if [ ! -d vendor/NexusRealtime ]; then
  git clone --depth 1 https://github.com/LuminaryLabs-Dev/NexusRealtime.git vendor/NexusRealtime
fi

if [ ! -d vendor/NexusRealtime-ProtoKits ]; then
  git clone --depth 1 https://github.com/LuminaryLabs-Agents/NexusRealtime-ProtoKits.git vendor/NexusRealtime-ProtoKits
fi

cargo run -p nexus-dsk-manifest -- > app/android/app/src/main/assets/manifests/dsk-manifest.json
cargo test --workspace
cargo install cargo-ndk --locked
cargo ndk -t arm64-v8a -o app/android/app/src/main/jniLibs build --release -p nexus-android-bridge
(cd app/android && gradle --no-daemon assembleDebug)
