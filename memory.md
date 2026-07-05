# NexusEngine-Rust Memory

## Purpose

NexusEngine-Rust is the canonical native build, package, and distribution layer for NexusRealtime-compatible projects. Its long-term purpose is to take a recognized project folder as input and produce reproducible, downloadable, manifest-tracked artifacts for desktop, mobile, web, XR, and future device targets without modifying the source project.

This repo should not be treated as a playtest/gameplay repo. Gameplay truth remains in NexusRealtime apps, kits, DSKs, and sequences; this repo turns those inputs into native host artifacts.

## North Star

Any supported NexusRealtime project should be able to enter this repo as a folder or checkout and leave as a verified release set:

- recognized project metadata and warnings
- isolated staging copy
- normalized web/static bundle when applicable
- native app packages for supported devices
- host FFI libraries where useful
- artifact manifest with hashes, targets, platforms, and timestamps
- public download surface after branch-push CI

## Architecture Shape

- Rust workspace crates hold host/runtime/domain boundaries.
- `crates/nexus-host-ffi` exposes a C ABI dynamic-library surface for device/app wrappers.
- `app/macos/NexusEngineRustDemo` is the first small desktop wrapper that loads the Rust backend through `libnexus_host_ffi.dylib`.
- `crates/nexus-packager` is the Universal NexusRealtime Packager CLI. It recognizes NexusRealtime/Vite/static/Rust project shapes, stages source copies, normalizes web bundles, and writes `nexus-package-manifest.json`.
- `crates/nexus-static-server` serves packaged web bundles on localhost for native WebView hosts.
- `local-kits/quest-xr-frame-loop-kit.mjs` owns the Quest cube demo frame loop in JS: stereo frame packets, controller tracking packets, left-stick locomotion, throw/reset cube state, and snapshots. Keep this behavior out of Rust unless a low-level native adapter is truly required.
- `local-kits/primitive-cube-object-kit.mjs` owns the reusable primitive cube descriptor/state/tick/reset/snapshot proof plus shared cube mesh vertices, named faces, triangle winding, and winding validation used by cube demos.
- `local-kits/physics-cube-object-kit.mjs` composes primitive cube state with reusable gravity, velocity, floor collision, restitution, damping, reset, impulse, and snapshot behavior for `projects/physics-cube-demo`.
- `app/macos/NexusPackagedWebApp`, `app/android-webview`, `app/ios-webview`, and `tools/electron-host` are generic host templates consumed by packager scripts.
- `.github/workflows/build-apk.yml` is the branch-push artifact workflow for tests, dynamic libraries, macOS app packaging, Android APK packaging, and Pages downloads.

## Conventions

- Prefer build/package validation over runtime play validation.
- Keep platform outputs as downloadable artifacts from GitHub Actions and GitHub Pages.
- Evaluate future work by whether it makes more NexusRealtime-compatible projects easier to recognize, stage, package, verify, and distribute.
- For Quest/OpenXR demo behavior, prefer JS kits for frame-loop state and interaction logic; Rust should remain thin host/build/lifecycle glue.
- First-party sample projects can compose local kit files into their normalized web bundle with `nexus.pack.json` `kitFiles`; copied destinations must stay inside the web bundle.
- Track active build goals in `.agent/goal.md` and `.agent/goal-packets/`.
- Track durable repo decisions here only when they affect future work.
- Do not build in source app repos. Package inputs are copied into `dist/packager/work/<slug>/source` with `.git`, `node_modules`, `dist`, `target`, `output`, and `.playwright-cli` excluded.
- GoldRush is the first read-only sample input for universal packaging.
