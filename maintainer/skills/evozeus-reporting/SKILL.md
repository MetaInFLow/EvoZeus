---
name: evozeus-reporting
description: Use when 生成、复核或完善 EvoZeus Evidence Report、Session Verdict Card、Case 摘要或报告模板时使用。
---

# EvoZeus 报告

报告将原始会话转化为可复核证据，帮助下一步更容易作出保存、晋级、提取、修复、拒绝或保持开放的决定。

## 报告类型

| 报告 | 使用时机 |
| --- | --- |
| Session Verdict Card | 快速复核一次会话结果 |
| Evidence Report | 为 Case 或 Candidate 提供结构化证据 |
| Case Summary | 面向公开场景或维护者的 issue 上下文 |
| Candidate Report | 为 Skill、Factor、Pattern、Habit 或 Environment Rule 提供晋级论证 |

使用 `../../../docs/reference/report-templates.md` 和 `../../../docs/reference/verdict-card.md`。

## 报告顺序

按以下顺序撰写报告：

```text
上下文 -> Evidence -> Signals -> 拟议 Verdict -> Artifact Candidate -> 隐私 -> 下一步行动
```

## 证据规则

- 区分观察和推断。
- 将每个拟议 Verdict 关联到具体 Evidence。
- 说明哪些内容没有测试或观察到。
- 证据薄弱时使用 `Open Case`，不要强行下结论。
- 公开分享前应用 `../evozeus-redaction/SKILL.md`。

## 不合格报告

拒绝或修改具有以下问题的报告：

- 没有证据却给 Agent 打分
- 总结感受而非行为
- 将一次性观点转化为 Candidate
- 遗漏隐私状态
- 隐藏不确定性
