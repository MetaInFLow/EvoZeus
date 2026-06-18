# Verdicts

- Status: active
- Last updated: 2026-06-18

A Verdict（裁决）is the outcome of judging a Case.

It should be short, evidence-backed, and operational. It says what should happen next.

## Verdict Types

| Verdict | 中文名 | Use when | Result |
| --- | --- | --- | --- |
| `Preserve` | 保留 | The pattern is useful but does not need a new artifact yet | Keep as a reference Case |
| `Promote to Skill` | 升级为 Skill | The pattern is reusable enough to become instructions | Create or update a Skill |
| `Extract Factor` | 抽取因子 | The pattern is a judgment rule | Add or update a Factor Candidate, registry reference, or released Factor pack route |
| `Keep as Habit` | 保持为习惯 | The pattern is lightweight and should stay small | Add to habits or checklist |
| `Fix Environment` | 修复环境 | Root cause is path, version, auth, network, permission, or setup | Add environment rule or diagnostic |
| `Reject Pattern` | 淘汰模式 | The pattern wastes token, reduces quality, or creates risk | Add to rejected patterns |
| `Open Case` | 开放案件 | Evidence is insufficient or contested | Keep collecting evidence |

## Verdict Format

```text
Verdict:
  Fix Environment

Evidence:
  gh auth status succeeded, but push failed repeatedly with network timeout.

Action:
  Add network/proxy diagnosis before asking user to re-authenticate GitHub.
```

## What a Verdict Is Not

- Not a score.
- Not a vibe check.
- Not a benchmark.
- Not a generic suggestion.

A verdict must be tied to evidence.
