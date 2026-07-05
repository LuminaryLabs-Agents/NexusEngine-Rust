# Default Rust Project Cube Proof

Status: active

## Purpose

Add the smallest first-party package proof for NexusEngine-Rust before deeper Quest or bare-metal headset work.

## Architecture Decision

- `local-kits/primitive-cube-object-kit.mjs` owns primitive cube descriptor normalization, tick/reset state, and snapshots.
- `projects/default-rust-project/` owns the data composition and visible canvas shell.
- `nexus-packager` copies configured kit files into normalized web bundles through `nexus.pack.json` `kitFiles`.
- Electron and macOS app hosts validate the packaged output; they do not own cube behavior.

## Success Criteria

- `node local-kits/tests/primitive-cube-object-kit.test.mjs`
- `cargo test -p nexus-packager -p nexus-static-server`
- `STRICT=1 TARGETS=web-static,electron,macos-app PROJECT=projects/default-rust-project bash scripts/package-nexus-project.sh`
- `node scripts/validate-electron-package.mjs dist/packager/work/default-rust-project/electron-host`
- `bash scripts/validate-macos-web-app.sh dist/packager/artifacts/macos-app/DefaultRustProject.app`

## Notes

- Keep the sample static/no-build to preserve local disk.
- Do not clone or build Armada in this repo.
- Headset bare-metal work remains gated behind stock OS app proof, hardware facts, partition backups, and recoverability.
