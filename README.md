# NexusRealtime-Rust

Lightweight native Rust host surface for NexusRealtime with Android APK build workflow.

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
local-kits/examples/native-host-composition.mjs
local-kits/tests/native-host-domain-kits.test.mjs
local-kits/targets/README.md
```

Run the local kit smoke test with:

```bash
node local-kits/tests/native-host-domain-kits.test.mjs
```

Run the composition example with:

```bash
node local-kits/examples/native-host-composition.mjs
```

## Build branch policy

```txt
main  = normal development branch
build = controlled full-build trigger branch
```

The long-term build pipeline should run every supported platform lane from `build`, collect all logs/artifact manifests, write a full build report into the repository, and send only a compact summary to Discord.
