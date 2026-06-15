# Community

- Status: active
- Last updated: 2026-06-15
- Audience: 想参与 EvoZeus 共创的人

## 社区沉淀什么

社区接收经过脱敏和用户确认的 Case、Rule、Factor、Golden Case、Environment Rule 和 Rejected Pattern。

核心贡献链路：

```text
Local Evidence Report
-> Agent Review
-> Case Draft
-> User Approval
-> Issue / PR
-> Community Review
-> Accepted Artifact
```

## 你可能在找

| Need | Read |
| --- | --- |
| 社区概念 | [Community Concepts](../concepts/community.zh-CN.md) |
| 隐私和脱敏 | [Privacy and Redaction](../governance/privacy-and-redaction.md) |
| 报告类型 | [Reports](../reports/README.zh-CN.md) |
| Verdict 类型 | [Verdict Reference](../reference/verdicts.md) |
| 贡献规则 | [../../CONTRIBUTING.md](../../CONTRIBUTING.md) |
| 变更范围 | [Change Scope Policy](../governance/change-scope-policy.md) |

## Graph 资产

贡献应尽量表达成节点和关系：

```text
Scenario
-> Rule
-> Factor
-> Persona Signal
-> Domain Signal
-> Golden Case
```

例子：

```text
销售方案场景
-> 先判断预算和决策链
-> 方案结构检查因子
-> 重视商业可行性的用户偏好
```

## 公开前检查

- 去除 PII、secret、客户名、内部路径和私有上下文。
- 保留可审查 evidence。
- 写清楚适用 Scenario。
- 写清楚 proposed verdict。
- Pair Contribution 只改 graph fragment 资产，不顺手改 infra、协议、治理规则、skill routing 或开发规范。
- 用户确认后再创建 issue 或 PR。
