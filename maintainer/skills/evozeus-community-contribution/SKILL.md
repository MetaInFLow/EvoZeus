---
name: evozeus-community-contribution
description: Use when 准备外部 EvoZeus 贡献、社区 Candidate、Case、Pattern、Factor、报告、issue 或 pull request 时使用。
---

# EvoZeus 社区贡献

社区贡献首先是证据贡献。它不会自动授予修改基础设施、Runtime、治理、PR 模板或开发规则的广泛权限。

## 贡献路由

| 贡献内容 | 允许的路由 |
| --- | --- |
| 从会话产生的 Case | 使用已脱敏证据的 Issue 或 Candidate PR |
| Candidate Pattern、Habit、Factor 或 Environment Rule | Candidate PR |
| 小型文档修复 | Docs PR |
| Runtime 或基础设施变更 | 在 `evozeus-runtime` 中经维护者讨论的 PR |
| 治理、ontology、PR 规则或 Skill 指令变更 | 经维护者讨论的治理 PR |

外部贡献者最多同时保留 3 个未关闭 Candidate PR，以及 1 个未关闭代码 PR。

## Candidate 边界

Candidate PR 可以修改候选 Artifact 和配套的脱敏示例。未经拆分和专门审批，不得随意修改：

- `SKILL.md`
- `skills/`
- `.github/`
- `docs/governance/`
- `docs/reference/ontology.md`
- `docs/reference/evidence-grading.md`
- runtime, upload, redaction, or extraction code

如果贡献包含 CLI、TUI、companion、scanner 执行、本地 registry、`~/.evozeus` 状态、lockfile、SQLite ledger 或报告执行，将其路由到 `evozeus-runtime`。不要把 Runtime 实现作为普通贡献路径重新加入 `EvoZeus` 主 Repo。

如果这些文件需要变更，拆分为单独的治理 PR 或代码 PR。

## 必要证据

每个 Candidate 都应包含：

- 已删除私密细节的来源 Session 或 Case 上下文
- 具体 Evidence，不只包含观点
- 拟议 Verdict 或晋级路由
- 隐私说明
- 限制或不确定性
- 请求 reviewer 执行的动作

Candidate PR 使用 `../../../.github/PULL_REQUEST_TEMPLATE/candidate_submission.md`；复核要求见 `../../../docs/reference/review-contract.md`。

## 被拒绝是正常结果

被拒绝的贡献应归入 `../../../docs/reference/negative-patterns.md`。如果被拒绝的 Candidate 澄清了 EvoZeus 不应吸收的内容，它仍然有价值。
