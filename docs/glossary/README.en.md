# Glossary

- Status: active
- Last updated: 2026-06-15
- Language: en

## Rules

Glossary stores short definitions, aliases, states, and links. A term that needs background, boundaries, examples, or relationship maps belongs in [../concepts/](../concepts/).

`reference/` stores stable protocols, schemas, templates, and machine-readable contracts.

## Core

| Term | Short Definition | More |
| --- | --- | --- |
| Skill Driven Software | Software paradigm driven by code, scenario skills, factors, rules, reports, and runtime | [SDS](../concepts/skill-driven-software.zh-CN.md) |
| Session | One real Agent execution | [Core](../concepts/core.en.md) |
| Evidence | Minimal evidence that supports judgment | [Core](../concepts/core.en.md) |
| Case | A finding waiting for judgment | [Core](../concepts/core.en.md) |
| Verdict | A judgment on a Case | [Verdicts](../reference/verdicts.md) |
| Artifact | The asset created from a Verdict | [Core](../concepts/core.en.md) |
| Library | A reusable asset library | [Core](../concepts/core.en.md) |

## Runtime

| Term | Short Definition | More |
| --- | --- | --- |
| Analysis Framework | Stage structure for session analysis | [Runtime](../concepts/runtime.en.md) |
| Factor | Judgment logic bound to a stage | [Runtime](../concepts/runtime.en.md) |
| Factor Result | Stable output format of a Factor | [Factor Protocol](../reference/factor-analysis-protocol.md) |
| Factor Runtime | Local layer that runs, degrades, and records factors | [Runtime](../concepts/runtime.en.md) |
| Skill Matrix | Routing table from scenario to downloadable skill package | [Skills](../../skills/index/SKILL.md) |
| Skill Package | Downloadable scenario-specific Agent capability package | [Skills](../../skills/index/SKILL.md) |
| Skill Router | Root `SKILL.md` index that suggests skill packages by scenario | [Skills](../../skills/index/SKILL.md) |

## Community

| Term | Short Definition | More |
| --- | --- | --- |
| Scenario | Context where a Rule or Case applies | [Community](../concepts/community.en.md) |
| Rule | Reusable judgment or action rule under a Scenario | [Community](../concepts/community.en.md) |
| Golden Case | High-quality historical contribution used as reference | [Community](../concepts/community.en.md) |
| Accepted Rule | Rule accepted through community review | [Community](../concepts/community.en.md) |
| Rejected Pattern | Low-value or harmful pattern marked for rejection | [Community](../concepts/community.en.md) |

## Safety

| Term | Short Definition | More |
| --- | --- | --- |
| Redaction | Removing or generalizing PII, secrets, and sensitive context | [Privacy](../governance/privacy-and-redaction.md) |
| Privacy Gate | Privacy checkpoint before public contribution | [Privacy](../governance/privacy-and-redaction.md) |
| Authorization Gate | Confirmation point before writing, uploading, installing, or contributing | [Development Workflows](../development/workflows.zh-CN.md) |
| Local-first | Raw session stays local by default | [Project Overview](../concepts/project-overview.zh-CN.md) |
