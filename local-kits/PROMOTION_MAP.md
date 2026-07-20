# Local Kit Promotion Map

This file records where each local staging kit is expected to move after the contract stabilizes.

## Promotion rule

```txt
local-kits
  local staging and contract proof

NexusRealtime-ProtoKits
  experimental reusable domain/service contracts

NexusRealtime
  stable promoted runtime/domain contracts

NexusRealtime-Rust crates
  native implementations and adapters that consume or implement those contracts
```

## Kit map

| Local kit | First promotion target | Native implementation target | Notes |
|---|---|---|---|
| `host-kernel-domain-kit` | NexusRealtime host-kernel contract | `crates/nexus-host` | Central composer; should orchestrate domains and never own gameplay rules. |
| `project-bundle-domain-kit` | NexusRealtime project bundle contract | `crates/nexus-project-loader` | Owns project bundle validation/loading. |
| `project-compiler-domain-kit` | NexusRealtime core project compiler contract | `crates/nexus-project-compiler` | Parses HTML and JavaScript into versioned project IR; Builder retains filesystem, Cargo, and artifact ownership. |
| `adaptive-host-profile-domain-kit` | NexusRealtime adaptive host profile contract | `crates/nexus-adaptive-host` | Owns profile selection and capability negotiation. |
| `command-buffer-domain-kit` | NexusRealtime command buffer contract | `crates/nexus-command-buffer` | Owns host-facing presentation command schema. |
| `input-routing-domain-kit` | NexusRealtime host input contract | `crates/nexus-host` plus input adapters | Routes host input toward core commands/events. |
| `diagnostics-trace-domain-kit` | NexusRealtime diagnostics/surface contract | `crates/nexus-host` or future diagnostics crate | Owns domain/frame debug ledgers. |
| `android-lifecycle-domain-kit` | ProtoKit adapter manifest first | `crates/nexus-android-bridge` | Owns JNI/Android lifecycle only. |
| `openxr-session-domain-kit` | ProtoKit adapter manifest first | `crates/nexus-openxr-host` | Owns OpenXR session/frame-loop contracts. |
| `xr-input-domain-kit` | ProtoKit XR input adapter | `crates/nexus-xr-input` | Normalizes XR input packets. |
| `xr-interaction-domain-kit` | ProtoKit detector domain | `crates/nexus-xr-interaction` | Detector only; gameplay meaning belongs to gameplay DSKs. |
| `gles-render-domain-kit` | ProtoKit render adapter manifest | `crates/nexus-render-gles` | Presentation domain; consumes command buffers. |
| `stereo-render-domain-kit` | ProtoKit render adapter manifest | `crates/nexus-render-gles` / OpenXR renderer | Presentation domain; consumes OpenXR/session descriptors. |
| `headless-replay-domain-kit` | NexusRealtime test/replay contract | `crates/nexus-host` or future headless crate | Proves deterministic host execution. |
| `build-artifact-log-domain-kit` | CI/build support contract | GitHub Actions and build-results branch | Owns build reports, artifact manifests, hashes, and Discord summaries. |

## Gate before promotion

A local kit can move out of `local-kits/` only when it has:

```txt
[ ] clear domain boundary
[ ] provides/requires tokens
[ ] commands and events
[ ] owned state
[ ] descriptors
[ ] reset policy
[ ] snapshot/trace policy
[ ] diagnostics fields
[ ] headless validation
[ ] no renderer-owned gameplay truth
[ ] no platform code in gameplay domains
```
