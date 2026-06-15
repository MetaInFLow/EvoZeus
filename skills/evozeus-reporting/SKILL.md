---
name: evozeus-reporting
description: Use when generating, reviewing, or refining EvoZeus Evidence Reports, Session Verdict Cards, Case summaries, or report templates.
---

# EvoZeus Reporting

Reports translate a raw session into reviewable evidence. They should make the next decision easier: preserve, promote, extract, fix, reject, or keep open.

## Report Types

| Report | Use when |
| --- | --- |
| Session Verdict Card | Fast review of one session outcome |
| Evidence Report | Structured evidence for a Case or Candidate |
| Case Summary | Public or maintainer-facing issue context |
| Candidate Report | Promotion argument for Skill, Factor, Pattern, Habit, or Environment Rule |

Use `../../docs/reference/report-templates.md` and `../../docs/reference/verdict-card.md`.

## Report Order

Write reports in this order:

```text
Context -> Evidence -> Signals -> Proposed Verdict -> Artifact Candidate -> Privacy -> Next Action
```

## Evidence Rules

- Separate observation from inference.
- Link each proposed Verdict to concrete Evidence.
- State what was not tested or not observed.
- Use `Open Case` instead of forcing a conclusion when evidence is thin.
- Apply `../evozeus-redaction/SKILL.md` before public sharing.

## Bad Reports

Reject or revise reports that:

- score the agent without evidence
- summarize vibes instead of behavior
- turn one-off opinion into a Candidate
- omit privacy status
- hide uncertainty
