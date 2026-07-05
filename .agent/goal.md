# Goal

Status: active

## Purpose

Maintain NexusEngine-Rust as the native build, package, and distribution system for NexusRealtime-compatible projects.

## Long-Term Goal

Any recognized NexusRealtime-compatible folder should be packageable from this repo into reproducible, downloadable, manifest-tracked artifacts for supported platforms without modifying the source project.

## Current Baseline

- GoldRush is the first proof input.
- Branch-push workflows publish artifacts and download metadata.
- Native wrappers, Electron wrappers, static web bundles, mobile templates, and host FFI outputs are the current target surface.

## Active Success Criteria

- Build/package work happens in isolated staging copies, never inside dirty source app repos.
- `nexus-packager` recognition stays broad enough for NexusRealtime, Vite, static web, configured `nexus.pack.json`, and future project shapes.
- Packager outputs include normalized static web zips, macOS `.app`, Android debug APK, iOS simulator `.app`, Windows `.exe` via Electron, and Electron desktop bundles.
- Each packaged app emits `nexus-package-manifest.json` with source metadata, targets, hashes, timestamps, and warnings.
- GitHub Actions can build supported targets from branch pushes and publish them to the Pages download surface.
- README links point to deployed workflow output, not only local build paths.
- Validation favors command proof, artifact inspection, app launch only where needed, and public URL checks after deploy.

## Active Default Project Goal

- Add `projects/default-rust-project/` as the smallest first-party package proof.
- Keep cube behavior in `local-kits/primitive-cube-object-kit.mjs`.
- Use `nexus.pack.json` `kitFiles` to compose local kit files into the normalized web bundle.
- Validate the packaged cube through web-static, Electron, and macOS `.app` outputs before escalating headset OS work.

## Active Physics Cube Goal

- Add `projects/physics-cube-demo/` as the next first-party package proof.
- Compose `physics-cube-object-kit` on top of `primitive-cube-object-kit`.
- Keep physics behavior in the reusable kit: gravity, velocity, floor bounce, damping, impulse, reset, and snapshots.
- Validate the packaged physics cube through Electron and macOS `.app` screenshots.

## Active Cube Mesh Winding Goal

- Keep shared cube vertices, named faces, triangle indices, normals, material slots, and winding validation in `primitive-cube-object-kit`.
- Make `projects/default-rust-project` and `projects/physics-cube-demo` project that shared mesh instead of duplicating face polygons.
- Require Electron render validation to prove kit mesh winding and renderer face proof for both cube demos.

## Active Quest Demo Goal

- Add a Quest-compatible APK lane for a cube throw/reset demo.
- Keep the OpenXR/XR-compatible frame loop in JS kits as much as possible.
- Rust should remain a thin host/JNI lifecycle bridge for this lane.
- Demo behavior should include stereo rendering/fallback, controller tracking packets, left-stick locomotion, cube grab/throw, and cube reset.
- Validate through JS kit tests, APK build, and ADB launch/logcat proof when a Quest or Android device is connected.

## Headset Bare-Metal Gate

- Do not start persistent headset OS modification until the stock OS app path is validated.
- Keep Armada as an external reference or prebuilt-media target only after hardware support is proven.
- Avoid local Armada builds while disk is constrained.
- Keep the durable sequence in `docs/HEADSET_BARE_METAL_TRACK.md`.
