---
name: evozeus
description: Use when an agent needs to use EvoZeus for session judgment, prepare community contributions, or develop EvoZeus repo infrastructure, runtime, scenario skills, factors, reports, or governance.
---

# EvoZeus（宙斯）Skill

> 本文档是 EvoZeus 的 zero-install Agent 入口。先判断场景，再选择最小路径。不要把使用场景误当成开发场景，也不要把开发任务误当成 Session Judgment。

## 致每一位 Agent

EvoZeus 是 Agent Session Judgment Layer。它把真实 Agent Session 转成可复核的 Evidence、Case、Verdict 和 Artifact，帮助人判断什么应该保留、修正、升级或淘汰。

EvoZeus 也是 Skill Driven Software（SDS）的实验仓库：软件行为由 code、scenario skill、factor、rule、report 和 runtime 共同驱动。

## Quick Start

### 使用 EvoZeus

用户要审判当前 session、看报告、生成 Case 或准备贡献时：

1. 只基于当前可见上下文收集 Evidence。
2. 输出 Session Verdict Card、Evidence Report、Case Draft 或下一步建议。
3. 默认不写文件、不安装包、不上传 raw session、不创建 issue / PR。
4. 只有用户明确确认后，才进入保存、redaction、贡献或 GitHub 动作。

### 开发 EvoZeus

用户要改这个 repo、实现 runtime / TUI、编辑 skill、改协议、模板、治理或开发规范时：

1. 读取 `skills/evozeus-development/SKILL.md`。
2. 读取 `docs/governance/change-scope-policy.md`。
3. 判断 Change Mode：Pair Contribution、Community Docs / Content、Infra / Protocol Development。
4. 按 issue / PR 粒度做最小改动，不把 graph contribution 和 infra 改动混在一起。
5. 修改 protected paths 前，确认 linked issue、Design Doc、Implementation Plan、ADR 或用户明确指令。

## 核心规则

1. **Evidence first**：没有证据，不形成 Verdict。
2. **No score**：不要给 session 打分；输出 evidence-backed tags、cases、verdicts、artifacts 和 suggestions。
3. **Mode first**：先判断是使用 EvoZeus，还是开发 EvoZeus。
4. **Local-first**：raw session 默认留在本地；公开贡献只使用 redacted evidence。
5. **Opt-in-first**：写文件、安装、下载、上传、启用 hook / cron、创建 issue / PR 都需要用户确认。
6. **Manifest before download**：远程或可下载 skill / factor / pack 启用前，先展示用途、依赖、权限、输入输出、隐私行为和 rollback。
7. **Protected paths need context**：改 infra、protocol、governance、skill routing、ADR、GitHub template 或开发规范前，必须有足够背景。

## 一、先判断场景

| Mode | 用户意图 | 输出 | 下一步 |
| --- | --- | --- | --- |
| Use EvoZeus | 审判 session、生成 Evidence Report、读报告、产出 Case 或建议 | Session Verdict Card / Evidence Report / Case Draft | 留在根 skill，必要时路由到场景 skill |
| Community Contribution | 把本地 Case、Rule、Factor、Golden Case、report 或 graph fragment 变成公开贡献 | Redacted contribution draft / readiness check | `evozeus-community-contribution` + `evozeus-redaction` |
| Develop EvoZeus | 改 repo、runtime、TUI、scenario skill、docs structure、template、ADR、validation rule、governance 或 protocol-facing file | 小型 issue / PR 风格改动、review 结果或开发产物 | `evozeus-development` + Change Scope Policy |
| Debug Development | 环境、权限、网络、依赖、路径、runtime 或 repo 状态阻塞 | Debug verdict / diagnosis / repair plan | `evozeus-doctor-debugging` |

如果用户说“开始开发”“实现”“改这个 repo”“review 项目规范”，直接进入 Develop EvoZeus，不要生成 Session Verdict Card。

## 二、使用场景流程

当用户说：

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。
```

或要求审判 session、提交 Case、生成 Evidence Report 时：

1. 说明判断只基于当前可见上下文。
2. 收集 conversation、tool calls、errors、diffs、commands、final output 等 Evidence。
3. 生成 Case 或 Report。
4. 给出 proposed Verdict 和下一步建议。
5. 如需公开贡献，先执行 privacy gate，再请求用户确认。

Verdict types：

| Verdict | Meaning |
| --- | --- |
| `Preserve` | Keep as a reference case |
| `Promote to Skill` | Convert into a reusable Skill |
| `Extract Factor` | Convert into a judgment Factor |
| `Keep as Habit` | Keep as a lightweight practice |
| `Fix Environment` | Treat as path, network, auth, permission, version, or setup issue |
| `Reject Pattern` | Mark as low-value, token-wasting, or harmful |
| `Open Case` | Evidence is insufficient or contested |

## 三、开发场景流程

开发场景默认按软件工程最小原则执行：

1. 确认任务属于 Community Docs / Content、Pair Contribution，还是 Infra / Protocol Development。
2. 读取相关 Design Doc、Implementation Plan、ADR、development docs 或 reference contract。
3. 明确文件范围和 protected paths。
4. 做最小可 review 改动。
5. 运行最小验证：至少 `git diff --check`，并按变更类型补充链接检查、模板检查或测试。
6. 总结改了什么、为什么这样划范围、验证结果如何。

开发场景必须遵守：

- 普通社区贡献不能顺手改开发规范。
- Pair Contribution 只改 graph fragment 资产：`cases/**`、`factors/**`、`patterns/**`、`examples/cases/**`、`examples/reports/**`。
- Infra / Protocol Development 才能改 `SKILL.md`、`skills/**`、`docs/reference/**`、`docs/governance/**`、`docs/development/**`、`docs/design/**`、`docs/plans/**`、`docs/decisions/**`、`.github/**`、`CONTRIBUTING.md`、`SECURITY.md` 或 runtime / infra code。

## 四、Scenario Skill 路由

本地已有的 scenario skill 可以直接读取。远程或可下载 skill 必须先展示 manifest 并取得用户确认。

| Scenario | Skill | Use When |
| --- | --- | --- |
| Develop EvoZeus infra | `skills/evozeus-development/SKILL.md` | 改 repo infrastructure、docs structure、runtime architecture、templates、ADRs、validation rules |
| Implement runtime / TUI | `skills/evozeus-runtime/SKILL.md` | 构建 TUI、browser companion、doctor、status、local workspace、authorization gates |
| Work on reports | `skills/evozeus-reporting/SKILL.md` | 创建、读取、验证或修改 report types 和 report templates |
| Work on factor library | `skills/evozeus-factor-authoring/SKILL.md` | inspect、enable、write、update、review factors |
| Prepare community contribution | `skills/evozeus-community-contribution/SKILL.md` | 把 local Case、Rule、Factor 或 Golden Case 转成公开贡献 |
| Redact private context | `skills/evozeus-redaction/SKILL.md` | 准备公开 issue、PR、example、report 或 community artifact |
| Debug blocked tasks | `skills/evozeus-doctor-debugging/SKILL.md` | debug failed、delayed、blocked 或 unclear environment/runtime work |
| Draft scenario skill | `skills/evozeus-skill-proposal/SKILL.md` | 反复纠偏、重复失败或强 adhoc 结果需要沉淀为 candidate skill |

Skill matrix：`skills/index/SKILL.md`。

## 五、下载 / 外部动作 Gate

执行远程下载、安装、上传、创建 issue / PR 或外部提交前，必须展示：

```text
skill_id or artifact_id
version
matched_scenario
why_this_is_needed
files_or_templates_included
dependencies
permissions
inputs
outputs
privacy_behavior
rollback
```

没有明确用户确认时，只能保留本地草稿或建议。

## 六、速查表

| Need | Read |
| --- | --- |
| 第一次使用 | `docs/start/README.zh-CN.md` |
| 开发入口 | `docs/development/README.zh-CN.md` |
| 变更范围 | `docs/governance/change-scope-policy.md` |
| 隐私脱敏 | `docs/governance/privacy-and-redaction.md` |
| Skill 路由 | `skills/index/SKILL.md` |
| Factor 协议 | `docs/reference/factor-analysis-protocol.md` |
| Report 模板 | `docs/reference/report-templates.md` |
