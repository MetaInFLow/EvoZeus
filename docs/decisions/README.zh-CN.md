# Architecture Decisions

- Status: active
- Last updated: 2026-06-15
- Audience: 开发者和维护者

## 这里放什么

`decisions/` 记录 ADR。它属于 development 阅读路径，用来解释重要工程选择的背景、选项、决定和后果。

普通用户通常不需要从这里开始。开发者在改架构、runtime、协议、默认行为或安全边界前，应该先看相关 ADR。

## 当前 ADR

| ADR | Status | Topic |
| --- | --- | --- |
| [ADR-0001](ADR-0001-static-skill-entry-and-zero-install.md) | accepted | Static Skill Entry and Zero-install Default |

## 新 ADR 触发条件

以下变化需要新增 ADR：

- 默认使用模式变化
- 本地 runtime 边界变化
- raw session、上传、隐私或授权策略变化
- factor runtime contract 变化
- report schema 或 verdict contract 变化
- 外部依赖、存储、网络或安全模型变化

## ADR 命名

```text
ADR-0002-short-kebab-title.md
```

编号连续递增。每个 ADR 应包含 context、options、decision、consequences 和 validation。
