# NexusRealtime-Rust

Lightweight native Rust host surface for NexusRealtime with Android APK build workflow.

## North star

NexusEngine-Rust is the native build, package, and distribution layer for
NexusRealtime-compatible projects. Its long-term goal is to take a recognized
project folder, build it in an isolated staging copy, and produce reproducible,
downloadable, manifest-tracked artifacts for desktop, mobile, web, XR, and
future device targets.

This is a build-only repo. Gameplay truth should remain in NexusRealtime apps,
kits, DSKs, and sequences; this repo turns those inputs into native host
artifacts and public downloads.

## Current implementation status

This repository is a native host scaffold for NexusRealtime. It is intended to host NexusRealtime-authored experiences across native targets such as Android, Quest/OpenXR, headless replay, and renderer-specific presentation backends.

It should not become a separate gameplay engine. Gameplay truth remains in the NexusRealtime core runtime, kits, DSKs, and sequences.

## Local domain kit staging

The `local-kits/` folder contains the current local staging contracts for the native host/domain kit plan.

These kits model the host architecture as domain boundaries:

```txt
NexusRealtime Core Runtime
  kits / DSKs / sequences
        ↓
Rust Host Kernel Domain
  project loading
  host profile selection
  input routing
  command buffer output
  diagnostics / logs
        ↓
Host / presentation / artifact domains
  Android lifecycle
  OpenXR session
  XR input
  GLES renderer
  stereo renderer
  headless replay
  build artifact logs
```

Important local kit files:

```txt
local-kits/README.md
local-kits/ARCHITECTURE.md
local-kits/PROMOTION_MAP.md
local-kits/native-host-domain-kits.mjs
local-kits/primitive-cube-object-kit.mjs
local-kits/physics-cube-object-kit.mjs
local-kits/examples/native-host-composition.mjs
local-kits/tests/native-host-domain-kits.test.mjs
local-kits/targets/README.md
```

Run the local kit smoke test with:

```bash
node local-kits/tests/native-host-domain-kits.test.mjs
node local-kits/tests/primitive-cube-object-kit.test.mjs
node local-kits/tests/physics-cube-object-kit.test.mjs
```

Run the composition example with:

```bash
node local-kits/examples/native-host-composition.mjs
```

## Downloads

Branch pushes build deployable artifacts through GitHub Actions and publish the latest download page here:

- Downloads page: [https://luminarylabs-agents.github.io/NexusEngine-Rust/downloads/](https://luminarylabs-agents.github.io/NexusEngine-Rust/downloads/)
- Artifact manifest: [https://luminarylabs-agents.github.io/NexusEngine-Rust/downloads/index.json](https://luminarylabs-agents.github.io/NexusEngine-Rust/downloads/index.json)

Expected latest files after a successful workflow run:

- `nexusengine-rust-macos-app.zip`
- `nexus-host-ffi-macos-aarch64.zip`
- `nexus-host-ffi-linux-x64.zip`
- `nexus-host-ffi-windows-x64.zip`
- `nexusrealtime-rust-debug-apk.zip`
- `default-rust-project-web-static.zip`
- `default-rust-project-macos-app.zip`
- `default-rust-project-electron-mac.zip`
- `physics-cube-demo-web-static.zip`
- `physics-cube-demo-macos-app.zip`
- `physics-cube-demo-electron-mac.zip`
- `nexusengine-goldrush-web-static.zip`
- `nexusengine-goldrush-macos-app.zip`
- `nexusengine-goldrush-android-debug.apk`
- `nexusengine-goldrush-ios-simulator-app.zip`
- `nexusengine-goldrush-windows-exe.zip`
- `nexusengine-goldrush-electron-mac.zip`
- `nexusengine-goldrush-electron-win.zip`
- `nexusengine-goldrush-electron-linux.zip`
- `nexusengine-goldrush-nexus-package-manifest.json`

Local build commands:

```bash
make macos-app
make host-ffi
make quest-apk
make adb-quest-check
make package-nexus PROJECT=/path/to/nexus-project
make package-goldrush
make package-default-rust-project
make validate-default-rust-project
make package-physics-cube-demo
make validate-physics-cube-demo
make package-downloads
```

## Default Rust Project cube proof

`projects/default-rust-project/` is the smallest first-party packaging proof. It
defines one primitive cube through data and composes
`local-kits/primitive-cube-object-kit.mjs` into the packaged web bundle through
`nexus.pack.json`.

The kit owns cube state, deterministic tick/reset behavior, reusable cube mesh
vertices/faces/triangle winding, and snapshots. The sample `index.html` owns
only the visible canvas projection shell used by Electron and the macOS WebView
app.

Run the full local proof with:

```bash
node local-kits/tests/primitive-cube-object-kit.test.mjs
make validate-default-rust-project
```

## Physics Cube Demo

`projects/physics-cube-demo/` is the next first-party sample. It composes the
primitive cube kit with `local-kits/physics-cube-object-kit.mjs` to prove
gravity, floor collision, bounce restitution, damping, reset, impulse, and
snapshot state through the same web-static, Electron, and macOS app package
lanes. It reuses the primitive kit mesh so cube winding stays identical across
both demos.

Run the local proof with:

```bash
node local-kits/tests/physics-cube-object-kit.test.mjs
make validate-physics-cube-demo
```

## Quest JS frame-loop demo

The default Android APK now targets a Quest cube demo that keeps the XR frame
loop in a JS kit:

```txt
local-kits/quest-xr-frame-loop-kit.mjs
  -> copied into APK assets by scripts/build-apk.sh
  -> loaded by app/android MainActivity WebView
  -> renders side-by-side stereo fallback
  -> uses WebXR immersive-vr frame loop when available
  -> accepts Android-forwarded controller/gamepad input
```

Rust remains the thin native host/JNI lifecycle bridge for this lane. The JS kit
owns controller tracking packets, left-stick locomotion, cube grab/throw/reset,
stereo frame packets, and snapshots.

Run the pure JS proof with:

```bash
node local-kits/tests/quest-xr-frame-loop-kit.test.mjs
```

Run device proof after building and connecting an authorized Quest over ADB:

```bash
make quest-apk
make adb-quest-check
```

Headset OS work is tracked separately in
[`docs/HEADSET_BARE_METAL_TRACK.md`](docs/HEADSET_BARE_METAL_TRACK.md). Keep it
gated behind stock OS app proof, hardware facts, backups, and recoverability.

Direct packager commands:

```bash
cargo run -p nexus-packager -- inspect /path/to/repo --json
cargo run -p nexus-packager -- build /path/to/repo --target web-static --out dist/packager
cargo run -p nexus-packager -- package /path/to/repo --targets macos-app,android-apk,ios-sim,windows-exe,electron,web-static
```

`nexus-packager` never builds inside the input project. It stages a copy in
`dist/packager/work/<slug>/source`, excluding `.git`, `node_modules`, `dist`,
`target`, `output`, and `.playwright-cli`, then writes a normalized web bundle
and `nexus-package-manifest.json` under `dist/packager/packages/<slug>/`.

Optional project config can be supplied in `nexus.pack.json`:

```json
{
  "name": "NexusEngine GoldRush",
  "appId": "dev.luminarylabs.nexuspackaged.goldrush",
  "entry": "index.html",
  "kind": "nexusrealtime-vite",
  "buildCommand": "npm run build",
  "webOutDir": "dist",
  "targets": ["web-static", "macos-app"],
  "assetBase": "./",
  "kitFiles": [
    {
      "source": "../../local-kits/primitive-cube-object-kit.mjs",
      "dest": "kits/primitive-cube-object-kit.mjs"
    }
  ]
}
```

`kitFiles` entries are copied into the normalized web bundle after staging. The
`source` path resolves from the input project first, then the repo root. The
`dest` path must stay inside the packaged web bundle.

## Build branch policy

```txt
main  = normal development branch
build = controlled full-build trigger branch
```

The long-term build pipeline should run every supported platform lane from `build`, collect all logs/artifact manifests, write a full build report into the repository, and send only a compact summary to Discord.
