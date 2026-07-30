# Release And Promotion Policy

- Status: active
- Last updated: 2026-07-30

## Product release channels

- Stable 是不可变 GitHub Release，必须提供产品清单、独立组件 exact commit、archive SHA-256、内嵌模块清单和验证记录。
- UAT 只有一个 `uat/current`，由中央清单固定 EvoZeus 与 CoEvolve Commit；Runtime 与 Session Signal 跟随 EvoZeus Commit；修复覆盖同一候选。
- `main`、普通 feature branch 和本地未发布 commit 不属于用户更新源。
- Stable Release 失败不得影响上一版 Stable；UAT 更新失败不得影响上一版 UAT。

EvoZeus is not ready for a heavy release train. This policy defines the lightweight equivalent of OpenClaw's release gates: promotion from raw contribution into reusable library assets.

## Lanes

| Lane | Meaning | Gate |
| --- | --- | --- |
| `community candidate` | Submitted by a user or agent, evidence may still be thin | Case or Candidate template is complete |
| `reviewed candidate` | Maintainer reviewed ontology, evidence, privacy, and value gates | Review Contract is satisfied |
| `core candidate` | Stable enough to become a reference, template, Skill, Factor, or rule | Evidence proof and owner review complete |
| `deprecated candidate` | Accepted before but no longer recommended | Replacement or rejection reason documented |

## Promotion Gates

Promotion requires:

- one primary kind
- evidence grade appropriate for the target
- privacy note
- review state
- owner or maintainer review for high-risk surfaces
- documented rollback or deprecation path when changing public instructions

## High-Risk Surfaces

These require explicit maintainer review before merge or promotion:

- `SKILL.md`
- `skills/`
- `maintainer/skills/`
- `.codex-plugin/`
- `.claude-plugin/`
- `packages/runtime/`
- `packs/session-signal/`
- `.github/workflows/`
- `.github/CODEOWNERS`
- `scripts/github/`
- `schemas/`
- `candidates/core/`
- `candidates/reviewed/`
- `SECURITY.md`
- `docs/governance/privacy-and-redaction.md`
- `docs/reference/ontology.md`
- `docs/reference/evidence-grading.md`
- future `factors/registry/`
- future official Factor pack manifests
- Runtime scanner modules
- future `schemas/`
- future redaction, session, candidate extraction, or upload code

Add `.github/CODEOWNERS` after the concrete GitHub maintainer team or owner handles are confirmed. Do not add placeholder owners that GitHub cannot resolve.

## Factor Pack Promotion

Factor pack and scanner module promotion follows [Factor Registry Governance](factor-registry-governance.md).

Key rule:

```text
lab merge != official release != main registry publication
```

The main registry should only accept versioned, reviewed, checksum-verifiable release manifest references. It must not crawl lab repo moving branches or publish unreviewed community scanner code by default.

## No Automerge Yet

Bots may check proof, scope, privacy, duplicate risk, or template completeness. Bots must not approve or merge PRs until maintainer-controlled merge gates exist.
