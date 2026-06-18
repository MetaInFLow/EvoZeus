# Ontology Layer

- Status: draft
- Last updated: 2026-06-18

Ontology Layer 定义 EvoZeus 可以稳定生产、评估、复用的认知单位。它优先解决语义收敛，不处理 runtime 实现、bot 自动化或社区激励。

## Layer Boundary

| Layer | Responsibility | Not responsible for |
| --- | --- | --- |
| Semantic Layer | 定义 Session、Evidence、Case、Candidate、Verdict、Artifact、Library | 运行 CLI、提交 PR、社区排名 |
| Execution Layer | 把 session 转成 report、evidence packet、draft case | 决定社区治理规则 |
| Governance Layer | review、accept/reject、贡献路径、版本晋升 | 重新定义核心语义 |

任何 PR 必须说明自己改的是哪一层。跨层改动需要拆 PR，除非是一次明确的 architecture migration。

## Core Objects

| Object | 中文名 | Definition | Stable when |
| --- | --- | --- | --- |
| Session | 会话 | 一次真实 Agent 执行过程 | 有最小上下文和可追溯 evidence |
| Evidence | 证据 | 支持判断的最小事实单元 | 可定位、可脱敏、可被 reviewer 复核 |
| Case | 案件 | 从 session 中发现的、等待裁决的问题或机会 | 有 evidence、影响说明、建议 verdict |
| Candidate | 候选资产 | 尚未被接受进入 Library 的 Artifact proposal | 有 kind、scope、evidence、review target |
| Verdict | 裁决 | 对 Case 或 Candidate 的证据化判断 | 绑定 evidence 和下一步动作 |
| Artifact | 沉淀资产 | 被接受后可执行、可复用或可引用的成果 | 有 owner、版本、使用边界 |
| Library | 资产库 | 被接受 Artifact 的集合 | 有索引、生命周期、淘汰路径 |

## Candidate Definition

Candidate 不是任意 insight。Candidate 是：

```text
session-derived finding + evidence + proposed artifact kind + review target
```

有效 Candidate 必须满足：

- 来自真实 session、review、issue 或可复现案例。
- 指向一个明确 artifact kind。
- 有最小 evidence packet。
- 有具体复用场景。
- 能被接受、拒绝、保留或继续开放。

## Candidate Kinds

| Kind | 中文名 | Use when | Final Artifact |
| --- | --- | --- | --- |
| `skill` | Skill 候选 | 行为模式需要变成 agent instruction | `skills/<name>/SKILL.md` |
| `factor` | Factor 候选 | 判断规则需要可重复触发 | main registry reference、`evozeus-factor-lab` submission 或 `evozeus-factors-official` release manifest |
| `pattern` | Pattern 候选 | 行为模式值得保留或推广 | `patterns/` |
| `habit` | Habit 候选 | 轻量实践足够，不需要完整 Skill | checklist 或 docs |
| `environment_rule` | 环境规则候选 | 根因在路径、网络、权限、版本、认证 | governance 或 diagnostics |
| `report_template` | 报告模板候选 | 需要更稳定的 review surface | `docs/reference/report-templates.md` |
| `negative_pattern` | 负样本候选 | 模式应被拒绝、限制或记录为反例 | `docs/reference/negative-patterns.md` |

## Factor Asset Boundary

`factor` 是主 repo 的核心 Candidate kind，但不是所有 Factor 资产都存放在主 repo。

| Stage | Location | Rule |
| --- | --- | --- |
| Proposal | `EvoZeus` issue / Candidate PR | 只提交脱敏 evidence、trigger、applicability、counterexample 和 review target |
| Incubation | `evozeus-factor-lab` | 承接 Factor pack、scanner module、reviewed/rejected 记录和实验性模板 |
| Official release | `evozeus-factors-official` | 只接 maintainer-promoted pack，必须有 tag、manifest、checksum 和 attestation |
| Registry publication | `EvoZeus` | 只引用稳定 release manifest 或公共语义定义，不追踪 lab moving branch |

## What Is Not A Candidate

| Not candidate | Reason |
| --- | --- |
| 泛泛建议 | 没有 session-derived evidence |
| 好听的方法论 | 没有复用路径或执行边界 |
| 单次偏好 | 不能帮助未来 session |
| 原始日志 | 还不是被解释过的 Case 或 Candidate |
| 大而全路线图 | 不是可 review 的原子单位 |
| 未脱敏截图或私有代码 | 违反 privacy gate |

## Lifecycle

```text
Draft Case -> Candidate -> Reviewed Candidate -> Accepted Artifact -> Library
                         -> Rejected Candidate -> Negative Pattern
                         -> Open Case
```

| State | Meaning | Exit condition |
| --- | --- | --- |
| `draft_case` | 初始发现，证据可能不足 | 补齐 evidence 或关闭 |
| `candidate` | 已指向 artifact kind | 进入 review |
| `reviewed_candidate` | reviewer 已按 contract 审查 | accept / reject / open |
| `accepted_artifact` | 进入可复用资产 | 登记到 Library |
| `rejected_candidate` | 不应吸收 | 记录 rejection reason |
| `open_case` | 暂无足够证据 | 等待更多 session |

## Review Invariants

- 一个 Candidate 只能有一个 primary kind。
- 一个 Candidate 可以引用多个 Evidence，但不能没有 Evidence。
- 一个 Verdict 必须引用 Case 或 Candidate。
- 一个 Artifact 必须说明复用入口和不适用边界。
- Rejection 也要沉淀原因，不能只关闭。
