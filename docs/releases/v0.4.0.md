# EvoZeus v0.4.0

EvoZeus v0.4.0 introduces the plugin-first product architecture.

## Highlights

- One EvoZeus plugin with five default user-task Skills.
- Built-in Runtime and Session Signal modules ship in the EvoZeus product Release.
- CoEvolve `v0.14.0` remains the optional independent evolution extension, with one root Harness per independent Repo and verified `ADMIN` authority for mutations.
- Product channel manifest v2 installs only EvoZeus and CoEvolve as independent components.
- Stable and the single UAT retain isolated state, transactional updates, overwrite semantics, and rollback.
- A CI gate rejects nested or legacy Harness directories; only an independent Git Repo root can own a Harness.
- Harness writes and uploads require verified target Repo `ADMIN` permission; diagnosis and dry-run plans stay read-only.
- Claude Code receives a silent, read-only SessionStart Lesson check; Codex uses explicit or semantic Skill selection until an equivalent plugin hook exists.
- README and user output focus on review, Lesson confirmation, verified improvement, and privacy.

## Migration

Historical root Skill calls route to the plugin's `using-evozeus` Skill for one compatibility cycle. Old Infra and Session Signal installations are replaced by the copies embedded in the selected EvoZeus Stable/UAT root.

Stable files are never overwritten by merely running an old Skill. Installation or channel alignment still requires an explicit user-approved update.
