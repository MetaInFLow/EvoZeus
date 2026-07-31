---
name: review-agent-session
description: Use when the user asks EvoZeus to review an Agent session, task, chat, execution trace, diff, report, or final output and decide what should be preserved, fixed, promoted, rejected, or investigated.
---

# Review an Agent session

## Required input

Use the session, task, output, files, tool traces, or diff already provided. Ask for missing material only when no evidence is available for the requested judgment.

## Review method

1. Define the intended outcome and completion standard.
2. Extract concrete evidence from inputs, actions, errors, changes, verification, and final output.
3. Identify the smallest meaningful Cases.
4. Give each Case one proposed Verdict:
   - `Preserve`
   - `Promote to Skill`
   - `Extract Factor`
   - `Keep as Habit`
   - `Fix Environment`
   - `Reject Pattern`
   - `Open Case`
5. Separate product defects, Skill defects, environment defects, evidence gaps, and user preference.
6. State the highest-leverage next action and how to verify it.

## Output

Lead with the core judgment. Include only evidence needed to defend it. Do not score the Agent or dump internal schemas.

When a reusable Lesson exists, finish with:

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话>｜拟记录到：<目标 Repo 或 local-only 位置> · <记录载体>｜影响范围：<受影响产品、Skill 或工作流>｜写入边界：<本次确认将创建的记录；明确排除的后续动作>。要按此记录吗？
```

Resolve the route and artifact before showing the prompt. Do not record it until the user confirms the displayed write boundary.

## Verification target

- Every conclusion points to observable evidence.
- Each proposed action has a clear owner or route.
- Private data is omitted or generalized.
- The response contains one primary next action.
- Any Lesson proposal identifies its exact record destination and authorized write.
