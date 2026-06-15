# PR Routing Policy

- Status: active
- Last updated: 2026-06-16

EvoZeus PRs move through a small state machine instead of maintainer intuition.

```text
new PR
  -> classify PR type
  -> classify risk
  -> check template completeness
  -> check proof, schema, privacy, and queue limits
  -> assign labels
  -> route to review, needs-info, convert-to-rfc, owner-only, or close
```

## PR Types

| PR type | Accepted | Proof required | Owner review | Automerge |
| --- | --- | --- | --- | --- |
| `code_change` | Yes | Yes | High-risk only | No |
| `candidate_submission` | Yes | Yes | When promoting reviewed/core | No |
| `schema_change` | Yes | Yes | Required | No |
| `skill_instruction_change` | Rare | Yes | Required | No |
| `governance_change` | RFC first | Yes | Required | No |
| `docs_example_change` | Yes | Privacy proof | If examples include evidence | No |
| `workflow_ci_change` | Rare | Yes | Required | No |
| `dependency_change` | Cautious | Yes | Required | No |

## Routing Decisions

| Decision | Use when |
| --- | --- |
| `review` | Template complete, proof supplied, privacy clear, scope small |
| `needs-info` | Missing context, evidence, tests, or reviewer focus |
| `needs-redaction` | Evidence may expose private data |
| `convert-to-rfc` | Governance, workflow, or architecture change lacks RFC |
| `owner-only` | High-risk path or CODEOWNERS surface changed |
| `close` | Blank template, low signal, duplicate, unsafe evidence, or out-of-scope PR |

## Close Without Review

Maintainers may close PRs without full review when they match:

- blank template
- no linked context for governance changes
- no real behavior proof for behavior-changing PRs
- mock-only or CI-only proof
- raw session logs uploaded
- privacy-sensitive evidence without redaction
- broad mixed PRs
- refactor-only PRs without maintainer request
- workflow, token, release, or GitHub automation changes without owner context
- dependency additions without justification
- `SKILL.md` or `skills/` changes mixed with unrelated files
- opinion-only Candidate
- Candidate without counterexamples or `when_not_to_use`
- AI-assisted PR where the author cannot explain the change
