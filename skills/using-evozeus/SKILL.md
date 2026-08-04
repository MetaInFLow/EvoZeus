---
name: using-evozeus
description: Use when the user explicitly invokes EvoZeus, asks to plan or generate an AI usage profile from approved local Codex history, attach a CoEvolve Harness to an independent Skillware repository, review Agent work, capture a reusable Lesson, or inspect EvoZeus Stable/UAT health. Route to one user task without exposing internal component topology.
---

# Using EvoZeus

## Goal

Lead with one of EvoZeus's two primary outcomes: an approved local AI usage profile or a governed CoEvolve Harness for an independent Skillware Repo. Keep Session review, Lesson capture, and product maintenance available as supporting routes.

## Entry behavior

Before routing the user's task, run the installed `~/.evozeus/bin/evozeus version --json` when it exists. This read entry also checks the selected Stable or UAT subscription under the local `update-policy.json`. Relay only user-visible `EvoZeus ·` update lines; keep the current verified version when the check fails, then continue the user's task.

When explicitly invoked, begin with one compact line:

```text
🧙 EvoZeus · 已启动｜<当前任务>
```

Keep the rest of the response in normal conversational form. Do not print internal JSON, version matrices, Repo lists, or a large maintenance banner unless the user asks for them.

## Route one task

| User intent | Next route |
| --- | --- |
| Plan or generate an AI usage profile from local Codex history | Ask the user to approve one exact Codex history directory, then run `~/.evozeus/bin/evozeus insights plan --source codex --source-path <approved-path> --json`. Codex is the only supported history provider in the current release. Show that exact source, redaction policy, report destination, and approval boundary. Read Codex history, run Factors, or write the report only after explicit approval. Limit history reads to the approved path, then follow the returned built-in Runtime route without dropping `--source-path`. |
| Attach or inspect a CoEvolve Harness for a Skillware Repo | `../evolve-skillware-repo/SKILL.md` |
| Review one session, task, output, diff, or execution | `../review-agent-session/SKILL.md` |
| Record a confirmed Lesson or preserve an improvement | `../capture-evozeus-lesson/SKILL.md` |
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
| New subscribed version found | `🧭 EvoZeus · 发现更新｜<current channel/version> → <target version>` |
| Product auto-update running | `🛠️ EvoZeus · 自动更新中｜<managed surfaces>` |
| Product auto-update completed | `✅ EvoZeus · 自动更新完成｜<channel/version> · <reload guidance>` |
| Product auto-update failed safely | `🛡️ EvoZeus · 自动更新失败｜<retained version and reason>` |
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
- Initial install approval enables verified automatic updates inside the selected channel. Ask before channel switching, update-policy changes, GitHub changes, Harness writes, or external uploads.
- Only maintainers with verified target Repo `ADMIN` permission may upgrade and push a Harness.

## Completion

End with the result, evidence, and one next action. A task is complete only when its selected Skill's verification target is met.
