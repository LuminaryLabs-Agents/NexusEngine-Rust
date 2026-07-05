# Long-Term Packager North Star

Status: active

## Purpose

Keep NexusEngine-Rust pointed at the durable product direction, not only the current GoldRush proof.

## North Star

NexusEngine-Rust should become the repeatable native packaging path for NexusRealtime-compatible projects:

```txt
recognized project folder
  -> inspect and classify
  -> stage without touching source
  -> build or normalize bundle
  -> package for supported targets
  -> write manifest and hashes
  -> publish downloadable artifacts
  -> verify public links
```

## Long-Term Criteria

- Accept more project shapes over time through explicit recognizers and optional `nexus.pack.json`.
- Keep source projects read-only by default.
- Make every target output reproducible enough to compare by manifest, hash, target, platform, and source revision.
- Treat CI as the canonical cross-platform builder.
- Treat GitHub Pages downloads as the user-facing release surface until a stronger release channel exists.
- Add target support incrementally without breaking the simple input-folder workflow.

## Guardrails

- Do not move gameplay logic into this repo.
- Do not require game repos to adopt this repo's internal layout.
- Do not make local machine state the only proof for release readiness.
- Do not hide packaging warnings; surface them in manifests and logs.

## Next Direction

The next meaningful phase is to harden the packager from "GoldRush proof works" into "multiple NexusRealtime-style projects can be recognized, packaged, and compared through manifests."
