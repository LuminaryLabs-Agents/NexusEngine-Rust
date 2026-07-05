# Cube Mesh Winding Proof

Status: active

## Purpose

Move cube mesh shape truth out of demo render shells and into `primitive-cube-object-kit`.

## Success Criteria

- `primitive-cube-object-kit` owns reusable cube vertices, named faces, triangle indices, normals, material slots, and winding validation.
- `projects/default-rust-project` renders from `snapshot.cube.mesh`.
- `projects/physics-cube-demo` renders from the same primitive cube mesh through composed physics snapshots.
- Electron validation fails when a cube project that requires mesh winding lacks valid kit mesh winding or renderer face proof.
- Human-view screenshots show both packaged demos still render a readable cube.

## Constraints

- Keep DOM/canvas/WebView/Electron/macOS host rendering out of reusable kit logic.
- Keep physics behavior inside `physics-cube-object-kit`.
- Do not reset or revert unrelated dirty Quest/default/packager work.
