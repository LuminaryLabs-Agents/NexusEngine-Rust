# Android host

Gradle project for the NexusRealtime Rust APK.

## Quest cube demo

The default APK loads `assets/nexus/quest-cube-demo/index.html` in a thin
Android WebView host. The XR-compatible frame-loop behavior lives in
`local-kits/quest-xr-frame-loop-kit.mjs` and is copied into APK assets by
`scripts/build-apk.sh`.

Rust should stay limited to native lifecycle/JNI status for this demo. The JS kit
owns stereo frame packets, controller tracking packets, left-stick locomotion,
cube grab/throw/reset, and snapshots.

Build and device-check:

```bash
make quest-apk
make adb-quest-check
```
