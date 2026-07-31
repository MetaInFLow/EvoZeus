# EvoZeus Install Onboarding Conversation Reference

- Status: superseded by the EvoZeus plugin entry
- Last updated: 2026-07-30
- Audience: local agents guiding a user from community `/skill` to registration, install, capability selection, and the first meaningful next step

## Purpose

This reference defines the user-facing conversation pattern for the EvoZeus install path. It prevents the agent from stopping at mechanical installation and makes the agent explain, in natural language, why registration matters, what EvoZeus can do for the user's current work, and what the safest next action is.

Historical v0.3 install conversation follows below. New user interactions begin at `skills/using-evozeus/SKILL.md`; installation and channel maintenance route through `skills/maintain-evozeus/SKILL.md`.

## Public Copy Prompt

The public copy prompt must stay short:

```text
加入 EvoZeus: https://evozeus-community.vercel.app/skill
```

Do not expand the user-facing copy prompt with approval lists, command lists, privacy policy details, or capability descriptions. Those details belong in this reference and `skills/evozeus-install-registration/SKILL.md`.

## Conversation Goal

The agent must move the user through four gates:

1. Confirm the user's intent to join EvoZeus.
2. Explain registration and privacy boundaries before asking for approval.
3. Install or reconcile EvoZeus only after approval.
4. Run CLI help, features, and capabilities; translate the user's relevant product feature into plain language, then ask the user to choose one next path.

The goal is not to sell every capability. The goal is to help the user decide the next safe, useful EvoZeus action.

## Pre-Registration Talk Track

Before writing `~/.evozeus/`, creating `agent-identity.json`, or calling the registration API, say a concise version of:

```text
我先确认加入 EvoZeus 的含义：这不是把你的项目或对话上传到社区，而是在本机建立一个 EvoZeus 身份和能力入口。

注册会做三件事：
1. 在本机 `~/.evozeus/` 保存注册和安装状态，后续 Agent 可以复用同一个入口。
2. 可选调用 EvoZeus Web 注册接口，只登记 hash、handle、runtime 和安全 metadata。
3. 安装本地 `evozeus` CLI，用来查看能力、做本地诊断、经明确批准从 Codex 历史生成 AI 使用画像，或为独立 Skillware Repo 规划 CoEvolve Harness 接入。当前画像只支持 Codex 历史。

不会上传 raw session、客户资料、token、私有路径、workspace 内容或未公开代码。任何写入、联网注册、活动反馈、扫描、本地报告、GitHub Issue/PR 都会再次请求你的明确批准。

我现在可以先做 dry-run，展示将写入什么；也可以在你批准后直接完成注册和本地安装。
```

Then ask for a concrete approval:

```text
请选择下一步：
1. 先 dry-run，只看计划，不写文件。
2. 批准注册和安装到 `~/.evozeus/`。
3. 只检查当前是否已经注册。
```

If the user has already expressed approval in the current turn, do not ask again for the same approval. Still state the exact write and network scope before executing.

## CLI Help Gate

After install or reconciliation, run the CLI help first so the command list comes from the installed tool:

```bash
~/.evozeus/bin/evozeus --help
```

If the local shim is not available yet but the resolved source tree is available, use:

```bash
node scripts/evozeus-cli.mjs --help
```

Then run the product feature router:

```bash
~/.evozeus/bin/evozeus features --json
```

Then run the structured capability router:

```bash
~/.evozeus/bin/evozeus capabilities --json
```

Do not invent features or capabilities. Treat CLI help as the installed command surface, `features --json` as the product menu, and `capabilities --json` as the source of risk, approval, examples, and write-mode facts.

## Natural Language Feature Mapping

Translate features by user goal, not by implementation name. Use related capabilities only when explaining execution risk and approval boundaries.

| User goal | Feature to present | Related capability | Plain-language description |
| --- | --- | --- | --- |
| "我想看自己的 AI 使用习惯、优势与盲区" | `insights.sessions` | `insights.plan` plus runtime routing | 当前只支持 Codex 历史。EvoZeus 先生成只读扫描计划；用户明确批准本机 Codex 历史读取、Factor 执行和报告写入后，才生成 AI 使用习惯、优势与盲区、人格画像（例如 INTJ 倾向）报告，证据不足时明确说明。 |
| "我想让某个 Skill / Plugin / Repo 持续进化" | `coevolve.target` | `harness.attachPlan` | EvoZeus 先检查目标所在的独立 Git Repo 并生成 CoEvolve Harness 接入计划。目标 Repo 写入和 GitHub 操作需要明确批准。 |
| "我想让 EvoZeus 看这次 Agent 表现" | `review.session` | `session.analyze` | 你提供一段明确的 Session 文本或文件，EvoZeus 在本地生成 Session Verdict Card，指出哪些行为值得保留、修复、提炼成 Skill / Factor，并让已确认 Lesson 继续进入可追踪路径。 |
| "我不确定装好了没有" | `activate` / `maintain` | `system.doctor` / `workspace.activate` | EvoZeus 检查本地注册、skeleton、CLI 和必需组件是否可用，并告诉你下一条安全命令。 |
| "我想更新 EvoZeus" | `maintain` | `system.updatePlan` | EvoZeus 先给出 dry-run 更新计划，列出将刷新哪些本地 skeleton / CLI 文件；实际写入需要单独批准。 |
| "我想退出或清理" | `uninstall` | `system.uninstallPlan` | EvoZeus 先给出归档或卸载计划，不直接删除；任何破坏性动作都需要单独批准。 |

When the user's current intent is clear, lead with one recommended path and keep the full list secondary.

## Post-Install Capability Template

After running help, `features --json`, and `capabilities --json`, output the feature introduction with this template. Keep the section order stable and fill placeholders from the install report, CLI help, feature JSON, capability JSON, and the user's current intent. Do not freestyle a different structure.

```text
EvoZeus 已接入本地 Agent。

安装状态：<installed | reconciled | dry_run | blocked>
注册状态：<registered | missing | restored | unknown>
已读取：`<help command>`、`<features command>`、`<capabilities command>`

现在能做：
1. 生成 AI 使用画像：当前只支持 Codex 历史；先给出只读扫描计划，经你明确批准后，再读取本机 Codex 历史、运行 Factor 并写入使用习惯、优势与盲区、人格倾向报告。
2. 为 Skillware 接入 Harness：先检查指定 Skill / Plugin / Repo 的独立 Git 根目录并生成 CoEvolve 接入计划；目标 Repo 和 GitHub 写入前再确认。
3. 复盘 Session 并沉淀 Lesson：分析你明确提供的 Session，已确认 Lesson 可继续进入可追踪的改进路径。
4. 检查本地状态：检查注册、skeleton、CLI 和组件完整性。
5. 更新或卸载：先输出 dry-run 计划，任何写入或删除前再确认。

需要额外批准：
本地历史会话扫描、FactorRunner、报告文件、活动反馈、GitHub Issue/PR、任何外部上传。

建议下一步：<one recommended path>
原因：<one sentence tied to the user's current goal>

请选择：
A. 先生成本机 Codex 历史扫描与 AI 使用画像计划（当前仅支持 Codex）
B. 为某个独立 Skillware Repo 生成 CoEvolve Harness 接入计划
C. 分析一个我明确提供的 Session，或继续记录已确认 Lesson
D. 运行本地健康检查
E. 查看更新或卸载 dry-run 计划
F. 暂停在已安装状态
```

If a feature or capability is unavailable in the JSON result, remove that option from "现在能做" and the choices instead of inventing support.

## Safety Language

Use these boundaries when the user asks for more automation:

- `review.session` / `session.analyze` may read only explicit input provided by the user through a file path or stdin.
- `insights.sessions` is only a planned route until the user separately approves local session store access and report writes.
- `session.scanPlan` is only a plan unless the user separately approves local session store access.
- Activity feedback is optional and hash-only; sending feedback requires explicit approval such as `--approve-feedback`.
- Public GitHub target URLs may be included only when the user explicitly marks the target public.
- Raw private sessions, customer data, tokens, private paths, workspace contents, and unreleased code must stay local.

## Output Standard

The post-install response must include:

- installation or reconciliation status
- whether local registration exists
- CLI help command run
- feature router command run
- capability router command run
- the fixed feature template above, with natural-language descriptions tied to the user's current goal
- recommended next path
- approval needed before any write, scan, network feedback, or GitHub action

Do not end with a generic "what next?" question. Offer concrete choices that map to installed EvoZeus capabilities.
