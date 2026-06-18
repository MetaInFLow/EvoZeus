# EvoZeus Docs

- Status: active
- Last updated: 2026-06-15

This repository follows the Engineering Everything document layout.

## Entry Points

| Need | Document |
| --- | --- |
| Scenario skill routing | [EvoZeus-Skill Index](../skills/index/SKILL.md) |
| Repository development rules | [EvoZeus-Development](../skills/evozeus-development/SKILL.md) |
| Product and protocol design | [design/active/design_doc-v0.1-agent-session-judgment-layer.md](design/active/design_doc-v0.1-agent-session-judgment-layer.md) |
| Architecture decision history | [decisions/](decisions/) |
| Privacy and redaction rules | [governance/privacy-and-redaction.md](governance/privacy-and-redaction.md) |
| PR rules | [governance/pr-guidelines.md](governance/pr-guidelines.md) |
| PR routing state machine | [governance/pr-routing-policy.md](governance/pr-routing-policy.md) |
| Candidate ontology policy | [governance/candidate-ontology.md](governance/candidate-ontology.md) |
| Evidence policy | [governance/evidence-policy.md](governance/evidence-policy.md) |
| Labels | [governance/labels.md](governance/labels.md) |
| Protected paths | [governance/protected-paths.md](governance/protected-paths.md) |
| Maintainer playbook | [governance/maintainer-playbook.md](governance/maintainer-playbook.md) |
| Auto triage policy | [governance/auto-triage-policy.md](governance/auto-triage-policy.md) |
| Workflow security | [governance/workflow-security.md](governance/workflow-security.md) |
| GitHub settings checklist | [governance/github-settings.md](governance/github-settings.md) |
| Candidate lifecycle | [governance/candidate-lifecycle.md](governance/candidate-lifecycle.md) |
| Release and promotion policy | [governance/release-and-promotion-policy.md](governance/release-and-promotion-policy.md) |
| Factor registry governance | [governance/factor-registry-governance.md](governance/factor-registry-governance.md) |
| Launch readiness criteria | [governance/launch-readiness-criteria.md](governance/launch-readiness-criteria.md) |
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
- Scenario skills live under `../skills/`; user-facing names use `EvoZeus-...`, while machine names and folder paths stay lowercase `evozeus-*`.
- Changes to scenario skills are governance-risk instruction changes.
- Governance RFCs live under `rfcs/`.
- Candidate lifecycle files live under `../candidates/` and must pass schema validation.
