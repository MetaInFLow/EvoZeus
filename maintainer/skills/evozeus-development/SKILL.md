---
name: evozeus-development
description: Use when 开发 EvoZeus 协议/治理本身，或修改 Repo 文件、分支结构、PR 模板、文档、脚本、治理规则或面向 Agent 的指令时使用。
---

# EvoZeus 开发

开发工作必须让 EvoZeus 保持小巧、可复核并有证据支撑。一个 PR 应只有一个主要目的、一个主要层级和一条验证链路。

`EvoZeus` 主 Repo 只负责 Protocol。Runtime 实现、scanner 执行、CLI/TUI、companion、`~/.evozeus` 本地状态、lockfile、SQLite ledger 和报告执行属于 `evozeus-runtime`，不属于本 Repo。旧的主 Repo Runtime 原型已经移除；实现工作使用 Runtime Repo，主 Repo 只处理协议、治理、registry pointer 或路由变更。

## 分支规则

使用以下分支格式：

```text
codex/<type>/<yyyymmdd>-<component>-<summary>
```

允许的 `type`：

| Type | 用途 |
| --- | --- |
| `dev` | 本 Repo 中支持协议的新脚本或产品行为；Runtime 实现属于 `evozeus-runtime` |
| `bug` | 有复现或证据支撑的缺陷修复 |
| `refactor` | 与 issue 或维护者请求相关且保持行为不变的重构 |
| `docs` | 文档、模板、治理文本或 Skill 文档 |
| `test` | 与行为、Case 或缺陷相关的测试覆盖 |
| `chore` | 不改变用户可见行为的维护工作 |

允许的 `component` 应尽量匹配被修改的表面：`factor`、`verdict-card`、`docs`、`governance`、`skill`、`registry` 或 `template`。只有迁移协调或协议/信任策略文本才使用 `runtime`、`doctor`、`tui`、`companion`、`workspace` 或 `infra`；实现 PR 应提交到 `evozeus-runtime`。

示例：

```text
codex/docs/20260616-skill-scenario-routing
codex/docs/20260616-runtime-routing-boundary
codex/bug/20260616-runtime-report-id
```

## 范围规则

选择一个主要层级：

| 层级 | 典型文件 |
| --- | --- |
| Semantic | `docs/reference/`、术语、ontology、证据分级 |
| Execution | Runtime 实现属于 `evozeus-runtime`；本 Repo 只保留支持协议的脚本或迁移说明 |
| Governance | `SKILL.md`、`skills/`、`.github/`、`CONTRIBUTING.md`、`docs/governance/`、PR 检查 |

不要在一个 PR 中混合 Candidate 内容、Runtime 代码和治理变更，除非这是维护者批准的迁移，并且 PR 说明跨层变更的必要性。新的 Runtime 代码应提交到 `evozeus-runtime`。

## 命名规则

- 面向用户的本地场景 Skill 名称必须以 `EvoZeus-` 开头；frontmatter 的 `name` 和文件夹路径保持小写 `evozeus-*`，以通过 Skill 校验。
- 复用 `../../../docs/governance/terminology-glossary.md` 和 `../../../docs/reference/ontology.md` 中的项目术语。
- 优先使用 `Session`、`Evidence`、`Case`、`Verdict`、`Artifact`、`Candidate`、`Factor`、`Pattern`、`Rejected Pattern` 和 `Environment Rule` 等规范名称。
- 新变量、文件名、标题、schema 和 CLI flag 应清楚表达所属层级和 Artifact 类型。
- 已有项目术语不得引入同义词，除非在同一个治理 PR 中同步更新术语表。

## 高风险表面

以下内容需要明确证据和维护者级别的关注：

- `SKILL.md`
- `skills/`
- `.github/` 模板或 workflow
- `scripts/github/`
- `SECURITY.md`
- `schemas/`
- `candidates/core/`
- `candidates/reviewed/`
- `docs/governance/privacy-and-redaction.md`
- `docs/reference/ontology.md`
- `docs/reference/evidence-grading.md`
- 未来的 schema、脱敏、上传、会话摄取或 Candidate 提取代码
- 任何不使用 `evozeus-runtime`、却把 Runtime 实现重新引入本 Repo 的变更

## 提交前门禁

暂存或推送前，运行与变更匹配的检查：

```bash
python3 scripts/check_pr_ready.py --base <base-ref>
git diff --check
```

在本 Repo 中，仅涉及文档和治理的工作至少应通过：

```bash
python3 -m py_compile scripts/check_pr_ready.py
python3 scripts/check_pr_ready.py --base <base-ref>
git diff --check
```

如果修改了 issue 模板，还要使用本地环境可用的 YAML parser 解析 `.github/ISSUE_TEMPLATE/*.yml`。

## PR 模板

使用最匹配的模板：

| 工作 | 模板 |
| --- | --- |
| 默认或混合的文档/治理变更 | `../../../.github/PULL_REQUEST_TEMPLATE.md` |
| Candidate、Case、Pattern、Factor 或 Artifact | `../../../.github/PULL_REQUEST_TEMPLATE/candidate_submission.md` |
| 本 Repo 中支持协议的脚本或行为 | `../../../.github/PULL_REQUEST_TEMPLATE/code_change.md` |
| Runtime、CLI、TUI、companion、scanner 执行、本地状态或报告执行 | 在 `evozeus-runtime` 中创建 PR |
| Ontology、schema、协议或兼容性 | `../../../.github/PULL_REQUEST_TEMPLATE/schema_change.md` |
| `SKILL.md`、`skills/`、prompt 或 Agent 指令 | `../../../.github/PULL_REQUEST_TEMPLATE/skill_instruction_change.md` |
