# Judgment

- Status: active
- Last updated: 2026-06-15
- Audience: 想理解 EvoZeus 如何审判 Agent Session 的人

## 核心链路

```text
Session -> Evidence -> Case -> Verdict -> Artifact -> Library
```

Judgment 负责把一次 Agent 工作过程里的失败、返工、误判、重复纠偏和高质量结果变成可审查对象。

## 你可能在找

| Need | Read |
| --- | --- |
| 第一次跑审判 | [第一次 Session Verdict](../start/first-session.zh-CN.md) |
| 看懂报告里的判断 | [看懂一份报告](../start/read-report.zh-CN.md) |
| 审判对象定义 | [Core Concepts](../concepts/core.zh-CN.md) |
| Verdict 类型 | [Verdict Reference](../reference/verdicts.md) |
| 报告类型 | [Reports](../reports/README.zh-CN.md) |

## Judgment 输出

| Output | Meaning |
| --- | --- |
| Session Verdict Card | 一次最短审判输出 |
| Case Draft | 等待确认或贡献的发现 |
| Debug Verdict | 指向环境、依赖、权限或流程问题 |
| Insight Draft | 值得沉淀的重复纠偏或高质量结果 |
| Artifact Proposal | Skill、Rule、Factor、Habit 或 Pattern 的候选草稿 |

## 边界

- Judgment 必须基于 evidence。
- Verdict 必须能落成下一步动作。
- 公开贡献前必须经过 redaction。
- raw session 默认留在本地。
