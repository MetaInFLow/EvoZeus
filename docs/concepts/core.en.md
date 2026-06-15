# Core Keywords

- Status: active
- Last updated: 2026-06-15
- Language: en

## Overview

The EvoZeus core loop:

```text
Session
-> Evidence
-> Case
-> Verdict
-> Artifact
-> Library
```

These terms describe how a real Agent workflow is judged, preserved, and reused.

## Keywords

| Term | Meaning | Use | Main Output |
| --- | --- | --- | --- |
| Session | One real Agent execution | Source of facts | session record |
| Evidence | Minimal proof for a judgment | Make claims reviewable | evidence ref, summary |
| Case | A finding waiting for judgment | Make evidence discussable | case draft |
| Verdict | The judgment on a Case | Decide the next action | verdict card, report |
| Artifact | The operational asset created from a Verdict | Move judgment into reuse | Rule, Skill Proposal, Factor Result, Environment Rule |
| Library | Accepted reusable assets | Let future Agents reuse decisions | accepted case, rule, factor, rejected pattern |

## Session

`Session` is one Agent work process.

It may include:

- user prompt
- assistant message
- tool call
- command output
- error
- retry
- file diff
- final answer
- environment signal

Default rules:

- Raw session content stays local by default.
- Public contribution uses redacted evidence.
- The Agent judges only the current visible session or local history the user authorizes.

## Evidence

`Evidence` is the smallest proof that supports a judgment.

Common evidence:

- redacted dialogue summary
- error type
- tool failure
- retry pattern
- diff summary
- user correction sentence
- environment check result

Evidence must:

- trace back to a session or local report
- support a Case or Verdict
- pass redaction before public contribution

## Case

`Case` is a finding waiting for judgment.

Examples:

- The Agent treats a network failure as an auth failure.
- The user repeats the same workflow rule across sessions.
- A tool fails repeatedly and delays the task.
- An adhoc tactic produces unusually good output.

A Case should include:

- scenario
- observed pattern
- evidence refs
- proposed verdict
- privacy note
- boundary

## Verdict

`Verdict` is the judgment on a Case.

Initial Verdict types:

| Verdict | Use |
| --- | --- |
| `Preserve` | Keep as a reference Case |
| `Promote to Skill` | Turn into a Skill or Skill proposal |
| `Extract Factor` | Extract into a reusable judgment factor |
| `Keep as Habit` | Keep as a lightweight habit or checklist |
| `Fix Environment` | Attribute to path, network, auth, permission, version, or config |
| `Reject Pattern` | Mark as low-value or risky |
| `Open Case` | Keep observing because evidence is insufficient |

## Artifact

`Artifact` is the asset created from a Verdict.

Possible artifacts:

- Rule
- Skill Proposal
- Factor Result
- Environment Rule
- Debug Verdict
- Redacted Case
- Rejected Pattern

## Library

`Library` is the accepted reusable asset collection.

In the first version, it can be local Markdown, JSON, or GitHub issue / PR. It may evolve into a registry or graph later.

## Related Docs

- [Verdicts](../reference/verdicts.md)
- [Report Templates](../reference/report-templates.md)
- [Privacy and Redaction](../governance/privacy-and-redaction.md)
- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
