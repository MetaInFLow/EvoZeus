# Review Contract

- Status: draft
- Last updated: 2026-06-15

Review Contract 定义 reviewer 如何一致地审查 Case、Candidate 和 Artifact。它不是主观品味判断，而是基于 ontology、evidence grading 和 negative patterns 的可重复 gate。

## Review Inputs

Reviewer 至少需要：

- Case 或 Candidate 描述。
- Candidate kind。
- Evidence packet 和最高 evidence grade。
- Privacy note。
- Proposed verdict。
- 预期进入的 artifact 位置。

## Acceptance Criteria

| Gate | Question | Accept when |
| --- | --- | --- |
| Ontology Gate | 这是 Case、Candidate 还是 Artifact？ | 语义单位明确，不混层 |
| Evidence Gate | 证据等级够吗？ | 满足目标的最低 grade |
| Privacy Gate | 是否能公开？ | 已脱敏且不需要 raw private session |
| Value Gate | 是否帮助未来 session？ | 有明确复用对象和场景 |
| Operational Gate | 能不能执行？ | 有触发条件、动作、边界 |
| Negative Gate | 是否命中拒绝原因？ | 未命中，或已改写 |
| Scope Gate | PR 是否足够小？ | 一个主目标，一个 primary kind |

## Verdict Mapping

| Review outcome | Verdict |
| --- | --- |
| 有价值但证据不足 | `Open Case` |
| 有价值但还不该沉淀 | `Preserve` |
| 可变成 agent instruction | `Promote to Skill` |
| 可变成判断规则 | `Extract Factor` |
| 只需要轻量习惯 | `Keep as Habit` |
| 根因是环境或权限 | `Fix Environment` |
| 应被排除或作为反例 | `Reject Pattern` |

## Reviewer Checklist

```text
[ ] 是否明确了 layer boundary？
[ ] 是否是 session-derived？
[ ] 是否有 evidence_id 或可定位 evidence？
[ ] evidence grade 是否达到目标门槛？
[ ] 是否有 privacy note？
[ ] 是否只有一个 primary kind？
[ ] 是否说明了 what is not covered？
[ ] 是否命中 rejection reason？
[ ] 如果接受，artifact 应该放在哪里？
[ ] 如果拒绝，是否给出 rewrite path？
```

## PR Rules

- 修改 ontology、review contract、evidence grading 属于 Semantic Layer。
- 新增 runtime、CLI、schema、logging 属于 Execution Layer。
- 新增 label、bot、PR automation 属于 Governance Layer。
- 一个 PR 默认只改一层。
- 如果必须跨层，PR 描述必须解释迁移顺序和验证方式。

## Reviewer Output

Reviewer 的最小输出：

```text
Decision:
Verdict:
Evidence grade:
Accepted artifact:
Rejection reason:
Required changes:
Residual risk:
```

其中 `Accepted artifact` 和 `Rejection reason` 二选一。不能同时为空。
