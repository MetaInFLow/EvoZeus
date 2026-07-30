---
name: capture-evozeus-lesson
description: Use when the user confirms that an EvoZeus Lesson should be recorded or asks to preserve a proven improvement as a Case, Skill change, rule, habit, environment fix, or other reusable artifact.
---

# Capture an EvoZeus Lesson

## Confirm the record

Create a concise, redacted Lesson with:

- observed context;
- evidence;
- reusable judgment;
- affected Repo or product boundary;
- proposed artifact;
- verification target.

If the user has not already confirmed recording, ask once:

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话摘要>。要记录下来吗？
```

## Route

| Lesson outcome | Route |
| --- | --- |
| EvoZeus product behavior, protocol, CLI, Runtime, built-in pack | EvoZeus main Repo |
| Generic Harness contract or independent Repo evolution lifecycle | EvoZeus-CoEvolve |
| Target Skillware behavior | Target independent Repo |
| Personal habit with no shared product value | Local-only record |

Do not create a Harness for a package, pack, Skill directory, or other subdirectory. Route the Lesson to the containing Git Repo root.

## Writes

User confirmation to record the Lesson authorizes the agreed record only. Ask separately before GitHub Issue/PR creation, code changes, installation, release, or external upload when that action was not already requested.

## Verification target

- The Lesson is understandable without raw private context.
- Evidence and proposed behavior are distinguishable.
- The route identifies one independent Repo or local-only destination.
- The artifact has a measurable validation target.
