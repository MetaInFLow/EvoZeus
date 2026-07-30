# EvoZeus Factors

This directory is the semantic intake and registry surface for EvoZeus Factors. The built-in official Session Signal factors live in [`../packs/session-signal/factors/`](../packs/session-signal/factors/) and execute through [`../packages/runtime/`](../packages/runtime/).

## Asset boundary

| Asset | Canonical location |
| --- | --- |
| Factor proposal / Candidate | EvoZeus Issue or Candidate PR |
| Built-in official Factor implementation | `packs/session-signal/factors/<factor-id>/` |
| Scanner and execution code | `packages/runtime/` |
| Semantic registry and extension pointers | `factors/` |
| Community third-party pack | Its own independent Repo and Release |

A Factor defines a reusable judgment rule with observable signals, evidence requirements, privacy limits, counterexamples, and a clear review route.

Built-in Factors share the EvoZeus product Commit, Stable/UAT channel, tests, and root Harness. They do not publish or update as separate products.

Third-party executable packs remain opt-in. Each pack must use an independent Repo, immutable Release, checksum-verifiable manifest, explicit permissions, compatibility metadata, and security review before registry publication.

## Contribution route

```text
redacted evidence
→ Factor proposal
→ semantic and privacy review
→ implementation in built-in pack or independent extension Repo
→ tests and owner review
→ unique UAT
→ Stable product or extension Release
```

See:

- [Factor analysis protocol](../docs/reference/factor-analysis-protocol.md)
- [ADR-0002](../docs/decisions/ADR-0002-factor-pack-registry-and-community-promotion.md)
- [ADR-0005](../docs/decisions/ADR-0005-plugin-first-monorepo-and-repo-scoped-harness.md)
