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

Before asking for confirmation, resolve and display:

- one target Git Repo or one named local-only destination;
- one record artifact, such as a GitHub Feedback Issue or workspace-relative local file;
- the affected product, Skill, protocol, or workflow;
- the exact write authorized by confirmation and the excluded follow-up actions.

If any field is unresolved, continue diagnosis. Do not ask a generic recording question.

If the user has not already confirmed recording, ask once:

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话摘要>｜拟记录到：<目标 Repo 或 local-only 位置> · <记录载体>｜影响范围：<受影响产品、Skill、协议或工作流>｜写入边界：<本次确认将创建的记录；明确排除的后续动作>。要按此记录吗？
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

User confirmation authorizes exactly the destination, artifact, and write boundary displayed in the prompt. If the prompt names a GitHub Issue, confirmation authorizes creation of that one redacted Issue. Code changes, PRs, installation, release, and any destination or artifact change require separate approval unless the user already requested them.

## Verification target

- The Lesson is understandable without raw private context.
- Evidence and proposed behavior are distinguishable.
- The route identifies one independent Repo or local-only destination.
- The confirmation prompt names the record artifact, impact scope, and write boundary.
- The artifact has a measurable validation target.
