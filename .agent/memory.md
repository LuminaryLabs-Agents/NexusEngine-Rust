# Memory

Status: active

## Purpose

Repo-local operating memory for NexusEngine-Rust build and packager work.

## Notes

- Long-term north star: recognized NexusRealtime-compatible project in, isolated staged build, reproducible device artifacts and manifest-backed public downloads out.
- NexusEngine-Rust is build-only: validate build/package outputs, not gameplay.
- Quest/OpenXR demo frame-loop and interaction behavior should live in JS kits first; Rust should stay minimal host/JNI/build glue.
- Future changes should improve project recognition, staging safety, target coverage, artifact manifests, CI reproducibility, or download verification.
- Universal packager inputs must be staged under `dist/packager/work/<slug>/source`; never run package builds inside dirty source app repos.
- GoldRush is the first proof input and should remain read-only unless the user explicitly changes direction.
- Native app wrappers consume `dist/packager/packages/<slug>/web` and its `nexus-package-manifest.json`.
- `projects/default-rust-project` is the first-party minimal cube package proof; it composes `local-kits/primitive-cube-object-kit.mjs` through `nexus.pack.json` `kitFiles`.
- `primitive-cube-object-kit` owns reusable cube mesh vertices, named faces, triangle indices, normals, material slots, and winding validation; demo shells only project/draw that mesh.
- `projects/physics-cube-demo` is the sibling physics proof; it composes `local-kits/physics-cube-object-kit.mjs` on top of `primitive-cube-object-kit` for gravity, floor bounce, damping, impulse, reset, and snapshot state.
- `kitFiles` copies must stay inside the normalized web bundle and should not move behavior into Electron, macOS, Android, or OpenXR hosts.
