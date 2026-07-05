# Physics Cube Demo

Status: active

## Purpose

Add a slightly more involved first-party package proof that composes primitive cube state with reusable physics behavior.

## Architecture Decision

- `local-kits/physics-cube-object-kit.mjs` composes `primitive-cube-object-kit`.
- Physics owns velocity, gravity, floor collision, restitution, damping, impulse, reset, bounce count, and snapshots.
- `projects/physics-cube-demo/` owns data composition and the visible canvas shell only.
- Electron and macOS validation reuse the generic packaged cube app proof path.

## Success Criteria

- `node local-kits/tests/physics-cube-object-kit.test.mjs`
- `make test`
- `STRICT=1 TARGETS=web-static,electron,macos-app PROJECT=projects/physics-cube-demo bash scripts/package-nexus-project.sh`
- `NEXUS_VALIDATE_MIN_FRAME=12 node scripts/validate-electron-package.mjs dist/packager/work/physics-cube-demo/electron-host`
- `EXPECTED_KIT_HASHES=kits/primitive-cube-object-kit.mjs,kits/physics-cube-object-kit.mjs bash scripts/validate-macos-web-app.sh dist/packager/artifacts/macos-app/PhysicsCubeDemo.app`

## Notes

- Keep rendering in the sample HTML.
- Keep physics deterministic and snapshot-oriented so it can later move to ProtoKits if useful.
