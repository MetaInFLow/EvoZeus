---
name: evozeus-reporting
description: Use when an agent is creating, reading, validating, or changing EvoZeus report types, report templates, verdict cards, report views, or report-to-action decisions.
---

# EvoZeus Reporting

Use this skill for report-related work.

## When to Use

- Creating or changing report types.
- Reading a report and deciding next action.
- Mapping evidence to judgment signals and verdicts.
- Updating report templates or report views.
- Checking privacy notes before public contribution.

## Report Reading Order

```text
Report Type
-> Evidence
-> Judgment Signals
-> Proposed Verdict
-> Privacy Note
-> Next Action
```

## Report Types

- Session Verdict Card
- Session Verdict Report
- Debug Report
- Insight Draft
- Redacted Case Draft
- Factor Inspect Report
- Factor Status Report
- Contribution History Report
- Workspace Summary Report
- Evidence Graph Report

## Rules

- A report must help the user make a decision.
- Evidence must be visible and traceable.
- Privacy note is required before public contribution.
- Report templates belong in `docs/reference/`.
