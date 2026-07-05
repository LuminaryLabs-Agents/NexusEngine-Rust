# Intention

Status: active

## Purpose

Track this repository as the long-term native build, package, and distribution layer for NexusRealtime-compatible projects.

## North Star

NexusEngine-Rust should eventually accept any recognized NexusRealtime/Vite/static/Rust project folder, build it in an isolated staging copy, and emit reproducible, downloadable, manifest-tracked artifacts for desktop, mobile, web, XR, and future device targets.

The repo's thinking over time should prioritize repeatable packaging systems over one-off demos. Each future change should make recognition, staging, packaging, verification, or distribution more general, more reliable, or easier to audit.

## Notes

- This is a build-only repo. Do not turn it into a gameplay engine or a playtest workspace.
- Gameplay truth remains in NexusRealtime apps, kits, DSKs, and sequences.
- Quest/OpenXR-compatible demo behavior should live in JS kits as much as possible. Rust should stay thin: native lifecycle, JNI status, build/package surfaces, and future low-level adapters only where JS cannot own the behavior.
- First target: build a small macOS `.app` that uses the Rust host backend and can be opened on the user's Mac.
- Follow-on target: build dynamic-library artifacts for platform lanes through GitHub Actions.
- Workflow output should be downloadable from the repository after branch pushes.
- Current target: make `NexusEngine-Rust` a Universal NexusRealtime Packager that can recognize a NexusRealtime/Vite/static entrypoint, build in an isolated staging copy, and emit downloadable cross-device packages.
- Current default proof target: package `projects/default-rust-project` through web-static, Electron, and macOS app lanes using `primitive-cube-object-kit` as the reusable data/state kit.
- Current physics proof target: package `projects/physics-cube-demo` through the same lanes using `physics-cube-object-kit` composed on `primitive-cube-object-kit`.
- Current Quest target: ship a Quest cube demo APK whose frame loop, stereo packets, controller tracking packets, locomotion, throw, and reset behavior are owned by `local-kits/quest-xr-frame-loop-kit.mjs`.
- Game/app repos such as `NexusEngine-GoldRush` are package inputs only and must remain read-only unless the user explicitly requests changes there.
