# Local Native Host Domain Architecture

## Core shape

```txt
NexusRealtime Core Runtime
  gameplay kits / DSKs / sequences
        ↓
Rust Host Kernel Domain
  project loading
  host profile selection
  input routing
  command buffer output
  diagnostics / logs
        ↓
Host domains
  android-lifecycle-domain-kit
  openxr-session-domain-kit
  headless-replay-domain-kit
        ↓
Portable proof domains
  primitive-cube-object-kit
  physics-cube-object-kit
        ↓
Presentation and artifact domains
  gles-render-domain-kit
  stereo-render-domain-kit
  quest-xr-frame-loop-kit (JS runtime kit)
  build-artifact-log-domain-kit
```

## Rule

```txt
Multiple hosts, not multiple gameplay engines.
```

The Rust host kernel composes native host domains. It does not own gameplay truth.

For Quest demo work, keep as much of the XR/OpenXR-compatible frame loop as possible in JS kits. Rust should stay close to lifecycle, JNI status, native build surfaces, and future low-level adapters that cannot reasonably live in JS.

## Domain categories

### Host support domains

These domains make the kernel usable across targets:

```txt
project-bundle-domain-kit
adaptive-host-profile-domain-kit
input-routing-domain-kit
command-buffer-domain-kit
diagnostics-trace-domain-kit
```

### Platform / adapter domains

These domains own platform lifecycle and native input boundaries:

```txt
android-lifecycle-domain-kit
openxr-session-domain-kit
xr-input-domain-kit
xr-interaction-domain-kit
```

### Presentation domains

These domains consume command buffers and descriptors:

```txt
gles-render-domain-kit
stereo-render-domain-kit
quest-xr-frame-loop-kit
```

### Portable proof domains

These domains own small reusable state proofs without owning platform or renderer behavior:

```txt
primitive-cube-object-kit (state + mesh/winding metadata)
physics-cube-object-kit
```

### Validation / artifact domains

These domains support CI, replay, reports, artifacts, and Discord summaries:

```txt
headless-replay-domain-kit
build-artifact-log-domain-kit
```

## Host kernel tick contract

```txt
platform host reads input
  ↓
input-routing-domain-kit normalizes packet
  ↓
Rust host kernel routes packet toward NexusRealtime core
  ↓
core runtime / sequence bridge advances
  ↓
command-buffer-domain-kit emits presentation commands
  ↓
presentation domain consumes command buffer
  ↓
diagnostics-trace-domain-kit records frame evidence
  ↓
build-artifact-log-domain-kit records CI/build evidence when running in build pipeline
```

## What these kits intentionally do not do

```txt
Android does not complete objectives.
OpenXR does not own grab gameplay.
GLES does not decide win/loss.
Headless replay does not invent alternate runtime semantics.
Build logs do not become source-of-truth gameplay state.
```

## Why this is local first

The contracts are not stable enough to promote yet. Keeping them in `local-kits/` lets us validate names, requires/provides tokens, lifecycle hooks, and target compositions before moving them into ProtoKits or the main NexusRealtime contract surface.
