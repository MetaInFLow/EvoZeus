# EvoZeus Docs

- Status: active
- Last updated: 2026-06-15

This repository follows the Engineering Everything document layout.

## Entry Points

| Need | Document |
| --- | --- |
| Product and protocol design | [design/active/design_doc-v0.1-agent-session-judgment-layer.md](design/active/design_doc-v0.1-agent-session-judgment-layer.md) |
| Architecture decision history | [decisions/](decisions/) |
| Privacy and redaction rules | [governance/privacy-and-redaction.md](governance/privacy-and-redaction.md) |
| PR rules | [governance/pr-guidelines.md](governance/pr-guidelines.md) |
| Release and promotion policy | [governance/release-and-promotion-policy.md](governance/release-and-promotion-policy.md) |
| Folder ownership | [governance/folder-declaration-v0.md](governance/folder-declaration-v0.md) |
| Terminology | [governance/terminology-glossary.md](governance/terminology-glossary.md) |
| Ontology layer | [reference/ontology.md](reference/ontology.md) |
| Evidence grading | [reference/evidence-grading.md](reference/evidence-grading.md) |
| Negative patterns | [reference/negative-patterns.md](reference/negative-patterns.md) |
| Review contract | [reference/review-contract.md](reference/review-contract.md) |
| Minimal loop | [reference/minimal-loop.md](reference/minimal-loop.md) |
| Verdict reference | [reference/verdicts.md](reference/verdicts.md) |
| Session Verdict Card | [reference/verdict-card.md](reference/verdict-card.md) |
| Report templates | [reference/report-templates.md](reference/report-templates.md) |

## Lifecycle Rules

- Design docs live in `docs/design/{backlog,active,done}/`.
- ADRs use continuous numbering: `ADR-0001-*.md`.
- Governance docs live in `docs/governance/`.
- Stable reference docs live in `docs/reference/`.
- Runtime output must not be committed; local runtime state belongs under `.evozeus/`.
