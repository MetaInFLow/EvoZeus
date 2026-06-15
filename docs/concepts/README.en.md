# EvoZeus Concepts

- Status: active
- Last updated: 2026-06-15
- Language: en

This directory explains core EvoZeus concepts. It serves three audiences:

- Human users: see what the project is useful for.
- The user's Agent: execute judgment, attribution, redaction, and drafting with stable language.
- Community contributors: submit Cases, Rules, Factors, and Golden Cases with shared terms.

## Reading Path

| Need | Read |
| --- | --- |
| What Skill Driven Software means | [skill-driven-software.zh-CN.md](skill-driven-software.zh-CN.md) |
| What the project manages | [project-overview.zh-CN.md](project-overview.zh-CN.md) |
| Scope and component map | [project-map.zh-CN.md](project-map.zh-CN.md) |
| Basic terms in the judgment loop | [core.en.md](core.en.md) |
| Factor, Analysis Framework, runtime protocol | [runtime.en.md](runtime.en.md) |
| Scenario, Rule, Golden Case, community contribution | [community.en.md](community.en.md) |
| Short definitions and index | [../glossary/README.en.md](../glossary/README.en.md) |
| 中文版本 | [README.zh-CN.md](README.zh-CN.md) |

## Concepts and Glossary

As terms grow, use this split:

- `glossary/` stores short definitions, aliases, states, and links.
- `concepts/` stores background, boundaries, examples, and relationship maps.
- `reference/` stores stable protocols, schemas, templates, and machine-readable contracts.
- Add a new term to the glossary first; promote it into a concepts page when it needs more than one paragraph or changes workflow and architecture.

## Concept Groups

| Group | Purpose | Main Docs |
| --- | --- | --- |
| Project | Define the project boundary | Skill Driven Software, Project Overview, Project Map |
| Core | Define objects in the judgment loop | Session, Evidence, Case, Verdict, Artifact, Library |
| Runtime | Define local analysis and factor execution | Analysis Framework, Factor Runtime, Factor, Factor Result |
| Workflow | Define user and Agent operation stages | Manual Session Review, Doctor, End-of-task Judgment, Incremental Insight |
| Community | Define shared community assets and states | Scenario, Rule, Golden Case, Accepted Rule, Disputed Rule |
| Safety | Define privacy and authorization boundaries | Redaction, Privacy Gate, Authorization Gate, Local-first |

## Naming Rules

- Capitalize protocol objects: `Session`, `Evidence`, `Case`, `Verdict`.
- Keep protocol terms literal: `Analysis Framework`, `Factor Result`, `runtime_profile`.
- User-facing actions may keep mixed names: `Manual Session Review`, `Open Case`, `Factor Inspect`.
- Public contribution terms must include lifecycle states: `candidate`, `accepted`, `disputed`, `deprecated`.
