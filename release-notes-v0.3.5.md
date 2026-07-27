# EvoZeus v0.3.5

EvoZeus v0.3.5 promotes the verified Notice-system UAT candidate to the immutable Stable product channel.

## Included

- EvoZeus-CoEvolve `v0.13.0`, providing configurable Emoji + `EvoZeus · <event>` notices and a read-only target Skill Notice CLI.
- Automatic reconciliation of missing, legacy, or version-mismatched CoEvolve dispatchers when a channel is activated or the single UAT candidate is overwritten.
- Explicit health states for missing, legacy, and version-mismatched dispatchers.
- Restorable dispatcher-state backup before replacement, with the prior verified UAT retained as the rollback candidate.
- A clean dependency audit with the patched `fast-uri 3.1.4` lockfile.

## Stable Product Set

- EvoZeus Core `v0.3.5`
- EvoZeus Runtime `v0.2.0`
- EvoZeus-CoEvolve `v0.13.0`
- EvoZeus Session Signal Skill `v0.1.0`

## Verification

- Full EvoZeus CLI, install, Doctor, channel transaction, and GitHub governance suites passed.
- CoEvolve `v0.13.0`: 157 tests and 8 subtests passed.
- The exact component commits passed the single-UAT product channel, component integrity checks, local channel status, and Doctor before Stable promotion.
- Stable installation remains explicit and transactional; no runtime auto-write is enabled for Stable.

## Rollback

The prior Stable product release remains installed and addressable as `v0.3.4`. Published tags are immutable; any corrective release will use a new patch version.
