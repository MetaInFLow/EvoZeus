---
name: evozeus-doctor-debugging
description: Use when an EvoZeus or Agent task is failing, delayed, blocked, misconfigured, unable to run, or producing unclear environment errors.
---

# EvoZeus Doctor Debugging

Use this skill for blocked or failed Agent work.

## When to Use

- A command, tool, dependency, or local runtime does not run.
- A task is delayed by environment, permission, auth, network, version, or path issues.
- A Skill or Factor appears to reduce output quality.
- Doctor or status output needs interpretation.

## Debug Report Shape

```text
Report Type
-> Error or Symptom
-> Evidence
-> Likely Cause
-> Fix Options
-> Authorization Needed
-> Next Action
```

## Rules

- Separate environment failure from reasoning failure.
- Ask before changing config, installing packages, or writing local state.
- Preserve raw logs locally unless the user approves redacted sharing.
