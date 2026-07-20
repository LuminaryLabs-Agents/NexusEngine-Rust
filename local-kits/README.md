# Local Native Host Domain Kits

This folder is a **local staging area** for the NexusRealtime-Rust host/domain kit plan.

These kits are intentionally kept outside the Rust workspace for now. They are a portable manifest-and-contract layer that can later be moved into:

- `NexusRealtime-ProtoKits` while the API is still experimental.
- `NexusRealtime` once a domain is stable enough to promote.
- Rust crates after the host kernel is ready to consume these manifests directly.

## Operating rule

```txt
Work happens on main.
build is the controlled full-build trigger branch.
local-kits is the incubation folder for native host domain contracts.
```

## Architecture rule

```txt
Every platform target is a host domain.
Every renderer target is a presentation domain.
Every build/log target is an artifact domain.
All of them plug into one Rust host kernel.
The Rust host kernel plugs into the canonical NexusRealtime core runtime contract.
No platform domain owns gameplay truth.
```

## Included local kits

| Kit | Boundary | Current purpose |
|---|---|---|
| `host-kernel-domain-kit` | Native host kernel | Composes project loading, profile selection, input routing, command buffers, diagnostics, and platform host domains. |
| `project-bundle-domain-kit` | Project loading | Owns project bundle validation/loading contracts. |
| `project-compiler-domain-kit` | Project compilation | Parses HTML and JavaScript project semantics into versioned project IR and target plans without owning Cargo or packaging. |
| `adaptive-host-profile-domain-kit` | Host profiles | Owns platform capability selection and profile validation. |
| `input-routing-domain-kit` | Host input routing | Normalizes host input and routes it toward Nexus commands/events. |
| `command-buffer-domain-kit` | Command output | Owns the host-facing presentation command contract. |
| `diagnostics-trace-domain-kit` | Diagnostics | Owns frame reports, domain traces, and runtime health summaries. |
| `android-lifecycle-domain-kit` | Android/JNI host | Owns Android lifecycle and JNI bridge contracts. |
| `openxr-session-domain-kit` | OpenXR host | Owns OpenXR session/frame-loop/input contracts. |
| `xr-input-domain-kit` | XR input | Owns XR input packet and controller/hand input contracts. |
| `xr-interaction-domain-kit` | XR interaction detector | Owns low-level XR candidate interaction events without owning gameplay outcomes. |
| `gles-render-domain-kit` | GLES presentation | Owns GLES command-buffer presentation contracts. |
| `stereo-render-domain-kit` | Stereo presentation | Owns stereo projection/layer presentation contracts. |
| `primitive-cube-object-kit` | Reusable object state and mesh | Owns primitive cube descriptor normalization, deterministic tick/reset behavior, shared vertices/faces/triangle winding, and snapshots without owning rendering or host packaging. |
| `physics-cube-object-kit` | Reusable physics state | Composes primitive cube state with velocity, gravity, floor collision, restitution, damping, reset, impulse, and snapshots without owning rendering or host packaging. |
| `quest-xr-frame-loop-kit` | JS runtime kit | Owns the Quest cube demo frame loop, stereo frame packet, controller tracking packet, left-stick locomotion, cube throw, reset, and snapshot behavior while keeping Rust host code thin. |
| `headless-replay-domain-kit` | CI/headless host | Owns replay, deterministic host validation, and CI smoke execution. |
| `build-artifact-log-domain-kit` | Build logs/artifacts | Owns build result reports, artifact manifests, hashes, and Discord-safe summaries. |

## Files

```txt
local-kits/
├─ README.md
├─ native-host-domain-kits.mjs
├─ project-compiler-domain-kit.mjs
├─ primitive-cube-object-kit.mjs
├─ physics-cube-object-kit.mjs
├─ quest-xr-frame-loop-kit.mjs
├─ examples/
│  └─ native-host-composition.mjs
└─ tests/
   ├─ native-host-domain-kits.test.mjs
   ├─ project-compiler-domain-kit.test.mjs
   ├─ primitive-cube-object-kit.test.mjs
   ├─ physics-cube-object-kit.test.mjs
   └─ quest-xr-frame-loop-kit.test.mjs
```

## Run the local kit smoke test

```bash
node local-kits/tests/native-host-domain-kits.test.mjs
node local-kits/tests/project-compiler-domain-kit.test.mjs
node local-kits/tests/primitive-cube-object-kit.test.mjs
node local-kits/tests/physics-cube-object-kit.test.mjs
node local-kits/tests/quest-xr-frame-loop-kit.test.mjs
```

## Run the composition example

```bash
node local-kits/examples/native-host-composition.mjs
```

## Run the project compiler proof

```bash
make package-project-compiler-proof
```

This preserves the HTML/JavaScript web target and emits a host-native Rust headless artifact from the same project source.

## Promotion path

```txt
local-kits
  quick iteration and local contract proof

NexusRealtime-ProtoKits
  experimental reusable domain kits

NexusRealtime
  promoted stable core/runtime/domain contracts

NexusRealtime-Rust crates
  native implementations/adapters that consume the promoted contracts
```

## Non-goals

These local kits do not implement a production OpenXR runtime, Android APK build, or GLES renderer. The primitive cube mesh describes reusable geometry and winding only; canvas/WebView projection remains in demo shells. The Quest cube JS kit is an experimental runtime proof for frame-loop shape, input packets, throw/reset state, and stereo snapshots; it should stay small until it is ready to move into ProtoKits or a promoted NexusRealtime runtime contract.
