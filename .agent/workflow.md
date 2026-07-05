# Workflow

Status: active

## Purpose

Use branch-push GitHub Actions as the main artifact builder and deployer.

## Notes

- `make macos-app` should build the local macOS `.app`.
- `make host-ffi` should compile the Rust dynamic-library tool-call surface for the current target.
- `make package-nexus PROJECT=/path/to/repo` should package a recognized NexusRealtime/Vite/static project from an isolated staging copy.
- `make package-goldrush` should use `/Users/crimsonwheeler/Documents/GitHub/NexusEngine-GoldRush` as read-only proof input.
- `make validate-default-rust-project` should package and visually validate the first-party cube proof through Electron and macOS `.app` lanes.
- `make validate-physics-cube-demo` should package and visually validate the sibling physics cube proof through Electron and macOS `.app` lanes.
- `make package-downloads` should stage generated packager artifacts into the Pages downloads tree.
- GitHub Actions should upload artifacts and deploy a Pages download surface.
- Keep build validation command-oriented; no gameplay or human-view run loop is required for this repo.
