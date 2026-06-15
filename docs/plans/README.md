# Development Plans

- Status: active
- Last updated: 2026-06-15

Development plans describe how an accepted design will be implemented.

## Document Types

| Type | Location | Purpose |
| --- | --- | --- |
| Start Guide | `docs/start/` | First-run and step-by-step path a user or Agent can follow |
| Report Doc | `docs/reports/` | Report types, reading paths, and report-to-action decisions |
| Concept Doc | `docs/concepts/` | Explanation of project concepts, boundaries, relationships and examples |
| Glossary | `docs/glossary/` | Short definitions, aliases, states and links |
| Design Doc | `docs/design/{backlog,active,done}/` | Product intent, architecture, boundaries, user flow |
| Implementation Plan | `docs/plans/` | File map, vertical slices, execution order, validation gates |
| Reference Doc | `docs/reference/` | Stable schema, protocol contracts, templates and reusable rules |

## Rules

- A plan must link to its source design doc.
- A plan must define file boundaries before implementation.
- Each slice must have an observable behavior and validation gate.
- Runtime output remains outside git under `.evozeus/`.
