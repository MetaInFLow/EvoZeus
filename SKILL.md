---
name: evozeus
description: Use when a user invokes the historical root EvoZeus skill from an older installation; route immediately to the plugin's using-evozeus skill.
---

# EvoZeus compatibility entry

This root Skill exists for one compatibility cycle. The active user entry is [`skills/using-evozeus/SKILL.md`](skills/using-evozeus/SKILL.md).

When this Skill is invoked:

1. Read `skills/using-evozeus/SKILL.md` completely.
2. Follow its routing, tag, privacy, approval, and completion rules.
3. Do not ask the user to run `features --json` or `capabilities --json` before understanding their task.
4. Do not expose internal Repo topology unless the user asks about architecture or maintenance.
5. Do not create an Issue, PR, local file, Harness, or network write without the permission required by the selected route.

Maintainer-only instructions moved to `maintainer/skills/` and are not part of the default user plugin surface.
