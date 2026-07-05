# Start Here

Status: active

## Purpose

Orient future agents around the long-term north star for NexusEngine-Rust.

## Notes

- This repo is the native build, package, and distribution layer for NexusRealtime-compatible projects.
- Treat it as build-only infrastructure, not as a gameplay or playtest repo.
- The durable direction is: recognized NexusRealtime project in, isolated staging build, reproducible device artifacts out.
- Source app repos are inputs only unless the user explicitly asks to edit them.
- Use `.agent/intention.md` for the long-term posture, `.agent/goal.md` for active criteria, and `.agent/goal-packets/` for dated implementation slices.
- Validate with build/package commands, local app launch only when proving a package opens, and public download checks after workflow deploys.
