# Negative Patterns

- Status: draft
- Last updated: 2026-06-15

Negative Patterns 定义系统应拒绝、限制或保留为反例的候选。它的作用是防止 EvoZeus 变成 prompt repo、blog repo 或 insight dump。

## Why This Exists

EvoZeus 必须能吸收，也必须能排除。没有负样本系统，任何听起来正确的话都可能进入 Library，最终导致语义膨胀和 review 失效。

## Rejection Reasons

| Code | Reason | Use when |
| --- | --- | --- |
| `R_NO_EVIDENCE` | 无证据 | 只有观点、回忆或泛泛总结 |
| `R_NOT_SESSION_DERIVED` | 非 session 产物 | 来自抽象方法论，没有真实 session 支撑 |
| `R_TOO_BROAD` | 过大 | 一次改动包含多个不可分离的候选 |
| `R_NOT_REUSABLE` | 不可复用 | 只适用于一次个人偏好或一次性任务 |
| `R_NOT_OPERATIONAL` | 不可执行 | 没有明确触发条件、操作步骤或边界 |
| `R_DUPLICATE` | 重复 | 已有 artifact 覆盖该模式 |
| `R_PRIVACY_RISK` | 隐私风险 | 需要暴露 raw session、私有路径、客户数据或私有代码 |
| `R_SUPPLY_CHAIN_RISK` | 供应链风险 | 候选会引入不受控远程指令、下载或工具权限 |
| `R_WRONG_LAYER` | 层级错误 | 用治理规则解决语义问题，或用 runtime 实现绕过 ontology |

## Invalid Candidate Examples

| Example | Why invalid |
| --- | --- |
| “Agent 要更认真规划” | 没有触发条件、证据等级和可执行动作 |
| “所有项目都应该用某个框架” | 不是 session-derived，且过大 |
| “把这段 prompt 加进 SKILL.md” | 没有复用边界，可能是 prompt repo 化 |
| “某次输出很好，保存起来” | 没有说明未来如何复用 |
| “自动上传所有 session 方便分析” | 违反 privacy 和 opt-in 原则 |

## Rejected Candidate Record

Rejected Candidate 不应只关闭。最小记录：

```text
candidate_id
title
primary_kind
rejection_reason
evidence_grade
short_rationale
possible_rewrite
```

## Rewrite Path

被拒绝不代表永久无价值。允许三种改写：

| Rewrite | When |
| --- | --- |
| Narrow scope | 候选过大但方向有效 |
| Add evidence | 证据不足但可补充 |
| Change kind | 原本不是 Skill，但可以成为 Habit、Case 或 Negative Pattern |

## Review Rule

如果 reviewer 不能明确说出“为什么不收”，说明 rejection taxonomy 还不够；如果 contributor 不能明确说出“如何改成可收”，说明 feedback 不够 operational。
