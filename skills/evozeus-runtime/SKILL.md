---
name: evozeus-runtime
description: Use when an agent is designing or implementing EvoZeus TUI, browser companion, doctor, status, local workspace, authorization gates, or runtime defaults.
---

# EvoZeus Runtime

Use this skill for runtime and interaction-layer work.

## When to Use

- TUI flows: onboard, review, report view, factor inspect, contribution preview.
- Browser companion flows: human insight, redaction review, contribution approval.
- Doctor / status flows: environment, dependency, workspace, factor registry checks.
- Local workspace design under `.evozeus/`.
- Authorization gates for writes, downloads, uploads, GitHub actions, hooks, and cron.

## Defaults

- Manual Session Review is the default.
- No hook, cron, upload, package install, issue, PR, or local write without approval.
- Browser companion opens only when human insight or high-information review is needed.

## Required Outputs

- Clear user action.
- Agent action.
- System action.
- Authorization point.
- Report type when a report is produced.
- Rollback or fallback path.
