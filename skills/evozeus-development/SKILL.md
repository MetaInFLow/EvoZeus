---
name: evozeus-development
description: Use when an agent is developing EvoZeus repo code, runtime, docs, protocol, templates, governance, tests, or preparing a development branch or PR.
---

# EvoZeus Development

## Overview

开发 EvoZeus 时，默认按小型 issue / PR 工作：先确认范围，再改最少文件，命名遵循项目术语，提交前跑对应检查。

## When to Use

- 修改 Python runtime、CLI、TUI、doctor、workspace、factor runtime 或 companion。
- 修改 `SKILL.md`、reference protocol、report template、governance docs、issue / PR templates。
- 准备 branch、commit、PR 或 review 当前开发改动是否符合规范。

## Branch Naming

默认使用 `codex/<type>/<yyyymmdd>-<component>-<short-summary>`。

| Part | Rule | Example |
| --- | --- | --- |
| prefix | Agent / Codex 开发默认 `codex/` | `codex/dev/20260615-runtime-factor-slice` |
| type | 变更类型 | `dev`, `bug`, `refactor`, `docs`, `test`, `chore` |
| yyyymmdd | 开始开发日期 | `20260615` |
| component | 使用 repo 里的稳定组件词 | `runtime`, `factor`, `verdict-card`, `doctor`, `tui`, `companion`, `workspace`, `docs`, `governance`, `skill` |
| summary | kebab-case，1-7 个词，描述行为或产物 | `runtime-factor-slice` |

Rules:

- 用 lowercase ASCII、数字和 `-`；不要用空格、中文、下划线、日期、人名。
- 一个 branch 对应一个 type、一个主要 component 和一个开发日期。
- 不把 Case / Factor 贡献和 infra / protocol 开发混在同一个 branch。
- 如果用户指定分支名，优先遵守用户要求，但发现范围混乱时先指出风险。

## Naming Rules

代码命名遵循语言惯例，同时贴合 EvoZeus 术语。

| Kind | Rule | Example |
| --- | --- | --- |
| Python modules / functions / variables | `snake_case` | `render_verdict_card`, `classify_failure` |
| Python classes / enums | `PascalCase` | `SessionVerdictCard`, `FactorResult`, `FailureKind` |
| Enum values exposed to users | 保持稳定英文 Verdict / state 文案 | `Fix Environment`, `Promote to Skill` |
| CLI commands / flags | lowercase kebab-case | `evozeus doctor --evidence` |
| Markdown headings | 项目产出默认中文，核心术语可保留英文 | `## Verdict Types` |

Preferred domain terms:

- `Session`, `Evidence`, `Case`, `Verdict`, `Artifact`, `Library`
- `Factor`, `FactorResult`, `FactorStage`, `EvidencePolicy`
- `Verdict Card`, `doctor`, `workspace`, `companion`, `runtime`

Avoid:

- 同一概念混用非标准 outcome 词、`score` 或 `rating`。
- 为了局部代码方便发明新核心词。
- 把 `Verdict` 写成数值评分。

## Pre-submit Checks

提交前先确认 scope，再跑检查。

1. `git status -sb`
2. `git diff --check`
3. `evozeus check`，先做 branch naming 等基本上传前检查。
4. Python runtime 改动：用 Python 3.11+ 跑 `python -m pytest`
5. 文档 / reference 改动：检查相对链接、路径存在、无本地私有路径。
6. public example / report 改动：确认没有 raw private session、secret、token、客户数据或私有路径。
7. protected / protocol 改动：确认 README、SKILL、reference、governance、ADR 或 template 的影响已说明。

如果本机默认 `python3` 低于 `pyproject.toml` 的 `requires-python`，必须换 Python 3.11+ 再跑测试，并在结果里说明使用的解释器。

## Commit / PR Rules

- 只 stage 本次 scope 内文件，不用 `git add .` 处理混合工作树。
- commit message 用简短英文祈使句：`Add runtime factor slice`。
- PR 描述说明：改了什么、为什么、触碰哪些协议 / 术语、跑了哪些检查。
- 如果工作树有其他人的改动，保留并明确排除；不要 revert unrelated changes。

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| branch 名只写 `update-docs` | 改成 `codex/docs/20260615-docs-verdict-card-reference` |
| 变量名引入 `score` 表示 Verdict | 改为 `verdict_signal` 或 `confidence`，避免把 Verdict 变成评分 |
| runtime 代码和社区 Case 混在一个 PR | 拆成 runtime PR 和 Case contribution |
| 只跑系统 `python3 -m pytest`，但系统 Python 是 3.9 | 使用 Python 3.11+，再记录解释器版本 |
