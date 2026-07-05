# Change Log

Status: active

## Purpose

TBD from repo context and user request.

## Notes

- Created by agent-it because the workspace expected this file.
- 2026-06-30 20:33:07 America/New_York - Created `.agent/` tracking workspace for build-only artifact goals.
- 2026-06-30 20:33:07 America/New_York - Added goal packet for macOS `.app`, platform dynamic libraries, and workflow downloads.
- 2026-06-30 20:37:02 America/New_York - Added Rust FFI crate, macOS app source, packaging scripts, branch-push artifact workflow, and README download links.
- 2026-06-30 20:37:02 America/New_York - Ran `cargo fmt --all` and `cargo test --workspace`; workspace tests passed locally.
- 2026-06-30 20:40:00 America/New_York - Built `dist/macos/NexusEngineRustDemo.app`; initial launch reached macOS Documents access prompt, then user allowed access for retest.
- 2026-06-30 20:41:00 America/New_York - Retested `NexusEngineRustDemo.app`; app opened and displayed Rust backend status from `libnexus_host_ffi.dylib`.
- 2026-06-30 20:41:00 America/New_York - Ran `make host-ffi`, YAML parse validation, local download-page generation, and GitHub Pages config check; all passed locally.
- 2026-06-30 20:42:00 America/New_York - Removed formatting-only churn from existing Rust crates and added root `memory.md` for durable build-only repo conventions.
- 2026-06-30 20:42:00 America/New_York - Committed and pushed `Build downloadable native artifacts` to `origin/main` as `32d0d29`.
- 2026-06-30 20:50:00 America/New_York - GitHub Actions run `28485616343` passed all jobs and deployed Pages downloads.
- 2026-06-30 20:50:00 America/New_York - Public download page, manifest, macOS app zip, macOS/Linux/Windows FFI zips, and Android APK zip all returned HTTP 200.
- 2026-07-01 00:00:00 America/New_York - Started Universal NexusRealtime Packager implementation: Rust recognizer/stager, web bundle normalization, generic native wrappers, target packaging scripts, CI lanes, README downloads, and `.agent` tracking.
- 2026-07-01 00:00:00 America/New_York - `cargo test --workspace` passed after adding `nexus-packager` and `nexus-static-server`; focused `cargo test -p nexus-packager -p nexus-static-server` also passed after final edits.
- 2026-07-01 00:00:00 America/New_York - `nexus-packager inspect` recognized GoldRush as `nexusrealtime-vite` without modifying the GoldRush worktree.
- 2026-07-01 00:00:00 America/New_York - `make package-goldrush` produced local web-static and macOS app artifacts; follow-up direct wrapper runs produced iOS simulator and Electron macOS zips.
- 2026-07-01 00:00:00 America/New_York - Android WebView APK packaging is wired but local validation was blocked by missing `ANDROID_HOME`; CI Android runner is configured to provide the SDK.
- 2026-07-01 00:00:00 America/New_York - Launched generated GoldRush macOS `.app`; visible screenshot proof showed the GoldRush 3D scene rendering in the packaged app.
- 2026-07-01 00:00:00 America/New_York - First pushed packager workflow showed Windows-only GoldRush clone failures; added sparse clone helper with `core.longpaths` and build-needed checkout exclusions for retry.
- 2026-07-01 00:00:00 America/New_York - Second pushed packager workflow reached Windows Electron packaging but failed to resolve `npm`; patched Rust packager and Electron wrapper to use `npm.cmd`/`npx.cmd` on Windows.
- 2026-07-01 02:16:15 America/New_York - Updated `.agent` and README north-star wording so long-term packager intention guides future work over time.
- 2026-07-01 05:04:29 America/New_York - Added Quest JS frame-loop goal tracking; Quest demo behavior should live in JS kits with Rust kept as thin host/JNI glue.
- 2026-07-01 05:15:10 America/New_York - Verified `make quest-apk` builds locally and Playwright renders the Quest stereo JS kit; ADB device proof remains blocked by unauthorized device `340YC10G750FT1`.
- 2026-07-01 05:17:41 America/New_York - Re-ran `make adb-quest-check`; device `340YC10G750FT1` still reports `unauthorized`, so install/launch/logcat proof needs headset-side USB debugging approval.
- 2026-07-04 06:13:06 America/New_York - Added default Rust cube project goal tracking for a `primitive-cube-object-kit`, `projects/default-rust-project`, `kitFiles` packaging, and Electron/macOS app validation before headset bare-metal work.
- 2026-07-04 06:19:00 America/New_York - Added `docs/HEADSET_BARE_METAL_TRACK.md` to keep Armada/Linux headset work gated behind stock OS app proof, hardware facts, backups, and recoverability.
- 2026-07-04 06:52:36 America/New_York - Added physics cube demo goal tracking for `physics-cube-object-kit`, `projects/physics-cube-demo`, and packaged Electron/macOS visual validation.
- 2026-07-05 00:00:00 America/New_York - Promoted shared cube mesh vertices/faces/triangle winding into `primitive-cube-object-kit` and made both cube demos render from that kit mesh with Electron render proof.
