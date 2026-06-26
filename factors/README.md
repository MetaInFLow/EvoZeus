# Factors

This directory is the public Factor registry surface for the `EvoZeus` protocol repo.
It is not the storage location for executable Factor packs, scanner modules, or unreviewed
Factor submissions.

## Repository Boundary

| Asset | Primary location |
| --- | --- |
| Factor proposal / Candidate | GitHub issue or Candidate PR in `EvoZeus` |
| Draft Factor pack or scanner module | `evozeus-factor-lab` |
| Reviewed but unreleased Factor asset | `evozeus-factor-lab/reviewed/` |
| Session signal review method / official review factor tools | `evozeus-session-signal-skill` |
| Official released Factor pack | future official Factor release mechanism |
| Stable public registry pointer | `EvoZeus` main registry / docs |

## Factor Contract

A Factor is a reusable judgment rule that produces tags or supports verdicts.

EvoZeus 的主仓库不承载完整 Factor library，也不保存可执行 builtin Factor pack body。主仓库只保留协议、semantic Factor proposal、registry 入口和治理规则。Factor pack、社区 Candidate 和 scanner module 应通过外部 lab / future official release mechanism 按需发布和安装。

A Factor should define:

- trigger condition
- required evidence
- possible tags or verdicts
- failure modes
- privacy constraints
- promotion source and review state

Factors are not prompts by default. They can be simple checks, heuristics, scripts,
or model-assisted reviewers. Executable code must be reviewed through the Factor lab
and official release flow before it is referenced by the main registry.

## Registry Model

Factor 分发采用 manifest-driven selective install：

```text
main registry
  -> versioned release manifest
  -> selected factor / bundle / pack
  -> checksum verification
  -> local lockfile
```

主 registry 只收录经过 review 的 release manifest 引用，不直接从 lab repo 的 moving branch 抓取内容。

See:

- [ADR-0002: Factor Pack Registry and Community Promotion](../docs/decisions/ADR-0002-factor-pack-registry-and-community-promotion.md)
- [Factor Registry Governance](../docs/governance/factor-registry-governance.md)

## Contribution Boundary

Community submissions should start in a Factor lab repository, not as a large direct addition to this directory.

Default route:

```text
lab submission
-> automated gates
-> Factor / security review
-> reviewed candidate
-> official promotion
-> GitHub Release
-> main registry PR
```

`factor.yaml` and executable scanner modules are reviewed differently. Scanner modules are high-risk executable plugins and must declare permissions, dependencies, entrypoint, fixture tests, and sandbox expectations before promotion.
