---
name: evozeus-factor-authoring
description: Use when 根据会话证据编写、复核、完善或晋级 EvoZeus Factor 或判断标准时使用。
---

# EvoZeus Factor 编写

Factor 是可复用的判断标准。它应帮助 reviewer 更一致地作出 Verdict，不能退化为模糊原则或激励句子。

## Factor 要求

有效 Factor 应包含：

- 稳定名称
- 目的
- 适用时机
- 不适用时机
- 可观察信号
- 所需 Evidence 等级
- 正面和负面示例
- 要防止的失败模式
- 与现有 ontology 术语的关系

Artifact 边界见 `../../../docs/reference/ontology.md`；证据强度见 `../../../docs/reference/evidence-grading.md`。

## 晋级门禁

只有满足以下条件时才晋级：

- Factor 有真实 Session 或 Case 证据支持
- 证据可以安全脱敏
- 不重复已有 Factor、Pattern 或 Review Contract 规则
- reviewer 无需了解原始私密会话即可应用
- 拒绝标准清晰

## Repo 路由

Factor 提案、Candidate PR、registry 引用和治理变更使用公开的 `EvoZeus` Repo。

Artifact 按以下方式路由：

| Artifact | Repo |
| --- | --- |
| 内置 official Factor | `EvoZeus/packs/session-signal/` |
| 内置 scanner 或 runner | `EvoZeus/packages/runtime/` |
| 第三方 Factor pack 或 scanner | 独立扩展 Repo |
| Stable 第三方 registry pointer | `EvoZeus/factors/` |

不要把原始私密会话证据放入任何公开 Repo。可执行变更需要高风险 owner review，以及完整的产品或扩展 UAT 门禁。

## 常见拒绝原因

- 范围过宽，无法评估
- 只是重复常识
- 依赖私密上下文
- 将 Factor 与 Skill 或 Runtime 行为混在一起
- 缺少负面示例
- 无法关联到可观察证据
