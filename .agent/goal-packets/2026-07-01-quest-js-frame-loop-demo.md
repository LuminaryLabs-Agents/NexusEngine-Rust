# Quest JS Frame Loop Demo

Status: active

## Purpose

Add a Quest-compatible cube throw/reset demo while keeping the XR/OpenXR-compatible frame loop in JS kits instead of Rust.

## Architecture Decision

- `local-kits/quest-xr-frame-loop-kit.mjs` owns frame-loop state.
- Android hosts the JS kit from APK assets in a thin WebView activity.
- Java forwards Android/Quest/gamepad input into JS.
- Rust remains a JNI lifecycle/status bridge and does not own locomotion, throw, reset, or stereo frame-loop state.

## Required Behavior

- Stereo side-by-side fallback rendering.
- WebXR immersive-vr frame-loop hook when `navigator.xr` supports it.
- Controller tracking packets for left/right controllers.
- Left joystick locomotion.
- Right grip grab/release throw for a cube.
- Cube reset by button or fall-below-plane.
- Snapshot/frame packet output for tests and future promotion.

## Validation

- `node local-kits/tests/quest-xr-frame-loop-kit.test.mjs`
- `make test`
- `make quest-apk`
- `make adb-quest-check` when a Quest or Android device is connected and authorized.

## Current Local Blocker

Local Java, Android SDK, and NDK discovery are handled by `scripts/build-apk.sh`, and `make quest-apk` builds the debug APK locally. The remaining device-proof blocker is ADB authorization: device `340YC10G750FT1` is connected but reports `unauthorized`.
