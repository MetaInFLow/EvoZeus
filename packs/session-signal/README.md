# EvoZeus Session Signal

Built-in review-signal pack for [EvoZeus](../../README.md).

## Role

Session Signal turns normalized Agent events into reviewable evidence signals. It helps EvoZeus find sessions worth human attention and explain why a Lesson may be reusable.

```text
normalized events
→ official Factor signals
→ evidence references
→ proposed review route
→ human judgment
```

Factor signals do not become automatic Agent scores, automatic Skill promotion, or automatic public contributions.

## Included signals

| Type | Signals |
| --- | --- |
| Direct gates | task completion, user input sentiment, repeated request |
| Diagnostics | tool failure frequency, resource usage, key sentence trends, semantic phrase clusters |
| Composite context | MBTI-style usage profile with explicit evidence limits |

Direct gates establish the primary judgment. Diagnostics explain, qualify, or downgrade it. Human review decides the final artifact route.

当前 official factors 覆盖：

| Factor | Role |
| --- | --- |
| `task-completion` | Direct completion gate |
| `user-input-sentiment` | Direct correction and dissatisfaction gate |
| `repeated-request` | Direct unresolved-repeat gate |
| `tool-failure-frequency` | Tool reliability diagnostic |
| `session-resource-usage` | Resource-use diagnostic |
| `key-sentence-trends` | Request and output phrase diagnostic |
| `semantic-phrase-clusters` | Stable intent cluster diagnostic |

## Factor Input

Factors receive normalized Session events and return compact evidence references, statistics, tags, and proposed signals. They do not persist raw chat bodies as a Factor dataset.

## Source layout

| Path | Purpose |
| --- | --- |
| `factors/` | Official Factor implementations and specs |
| `src/evozeus_session_signal_skill/` | Shared Factor and review contracts |
| `schemas/` | Official Factor schema |
| `templates/` | Review/report presentation resources |
| `benchmarks/` | Golden-session evaluation inputs |
| `tests/` | Contract, Factor, resource, and benchmark tests |

## Development

From the EvoZeus repository root:

```bash
npm run test:session-signal
```

For an editable environment:

```bash
python3 -m pip install -e "packs/session-signal[nlp]"
```

Changes affecting Runtime integration, product channels, or user-visible judgments must also pass:

```bash
npm test
npm run test:runtime
```

## Governance

- Issues, PRs, UAT, Releases, and versioning belong to `MetaInFLow/EvoZeus`.
- This pack inherits the EvoZeus root Harness.
- A nested `.evozeus-wrapper/` is rejected by CI.
- Migration provenance is recorded in [MIGRATION.md](MIGRATION.md).
