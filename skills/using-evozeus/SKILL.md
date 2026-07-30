---
name: using-evozeus
description: Use when the user explicitly invokes EvoZeus, asks to review Agent work, capture a reusable lesson, evolve a Skillware repository, or inspect EvoZeus stable/UAT health. Route to one user task without exposing internal component topology.
---

# Using EvoZeus

## Goal

Turn evidence from real Agent work into one clear judgment and one verifiable next action.

## Entry behavior

When explicitly invoked, begin with one compact line:

```text
🧙 EvoZeus · 已启动｜<当前任务>
```

Keep the rest of the response in normal conversational form. Do not print internal JSON, version matrices, Repo lists, or a large maintenance banner unless the user asks for them.

## Route one task

| User intent | Read next |
| --- | --- |
| Review one session, task, output, diff, or execution | `../review-agent-session/SKILL.md` |
| Record a confirmed Lesson or preserve an improvement | `../capture-evozeus-lesson/SKILL.md` |
| Attach or inspect evolution for a Skillware Repo | `../evolve-skillware-repo/SKILL.md` |
| Install, align versions, switch stable/UAT, Doctor, update, rollback | `../maintain-evozeus/SKILL.md` |

If intent is unclear, inspect available context first and ask at most one short question that materially changes the route.

## EvoZeus tag contract

Use an EvoZeus tag only when EvoZeus itself performs a recognizable lifecycle action:

| Event | Format |
| --- | --- |
| Explicit activation | `🧙 EvoZeus · 已启动｜<task>` |
| Managed Skillware run | `👁️ EvoZeus · 受管运行｜<target Skillware> · <stable|uat|development>` |
| Lesson candidate detected | `🧙 EvoZeus · 捕捉到一条 Lesson｜<one-sentence summary>。要记录下来吗？` |
| Confirmed Lesson persisted | `📝 EvoZeus · Lesson 已记录｜<local record or Issue link>` |
| Permission required | `🔐 EvoZeus · 等待确认｜<specific write or external action>` |
| Stable/UAT decision | `🧭 EvoZeus · 版本状态｜<channel and exact next action>` |
| Approved evolution executing | `🛠️ EvoZeus · 进化中｜<Repo> · <approved change>` |
| Single UAT candidate verified | `🧪 EvoZeus · UAT 就绪｜<Repo> · <candidate Commit>` |
| Stable Release published | `🚀 EvoZeus · 已发布｜<Repo> · <Release>` |
| Verified rollback completed | `↩️ EvoZeus · 已回滚｜<restored channel/version>` |
| Privacy or evidence blocker | `🛡️ EvoZeus · 暂停｜<missing/redaction reason>` |
| Verified completion | `✅ EvoZeus · 已验证｜<what passed>` |

Do not show the tag for ordinary domain analysis, every tool call, or every paragraph. Never emit a raw capture JSON block to the user.
The canonical trigger and wording contract is `../../docs/reference/user-visible-events.md`.

## Lesson signal

At the end of a meaningful task, check whether the session exposed a reusable rule, failure pattern, workflow improvement, environment fix, or product behavior gap. If yes, add one normal chat line:

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<可复用且已脱敏的一句话>。要记录下来吗？
```

This is a proposal only. User confirmation is required before recording. Claude Code loads this check through the plugin's read-only `SessionStart` adapter. Codex activates the Skill through explicit or semantic selection because its current plugin manifest does not expose an equivalent session hook.

## Safety

- Raw private sessions stay local.
- Remove secrets, customer data, private paths, unreleased code, and unnecessary identities.
- Read-only review can proceed without write approval.
- Ask before local persistent writes, GitHub changes, Harness writes, installs, updates, network calls, or external uploads.
- Only maintainers with verified target Repo `ADMIN` permission may upgrade and push a Harness.

## Completion

End with the result, evidence, and one next action. A task is complete only when its selected Skill's verification target is met.
