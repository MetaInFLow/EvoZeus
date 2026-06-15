# 项目概览

- Status: active
- Last updated: 2026-06-15
- Audience: 想快速看懂 EvoZeus 的人

## 先看结论

EvoZeus 是 Agent Session 的 judgment layer。它把一次 Agent 工作过程里的证据、失败、返工、纠偏和高质量 adhoc 结果沉淀成可复用资产。

EvoZeus 定义并实践 **Skill Driven Software（SDS）**：软件行为由 code、scenario skill、factor、rule、report 和 runtime 共同驱动。

核心链路：

```text
Session -> Evidence -> Case -> Verdict -> Artifact -> Library
```

读完本页，你应该能回答三件事：

1. EvoZeus 管什么。
2. 当前仓库已经有什么。
3. 用户、Agent、社区如何形成共创闭环。

## 它管理什么

| Term | 中文名 | Meaning |
| --- | --- | --- |
| Session | 会话 | 一次真实 Agent 执行 |
| Evidence | 证据 | 支撑判断的最小证据 |
| Case | 案件 | 等待审判的发现 |
| Verdict | 裁决 | 基于 Evidence 对 Case 给出的结果 |
| Artifact | 沉淀资产 | Verdict 落成的资产 |
| Library | 资产库 | 可复用的公共资产库 |

Verdict 必须落成 Artifact。常见结果包括 Skill、Factor、Habit、Environment Rule、Rejected Pattern、Accepted Case、Pending Case。

## 当前仓库有什么

| Surface | File |
| --- | --- |
| 人和 Agent 的主入口 | [../../README.md](../../README.md) |
| Agent 可读入口 | [../../SKILL.md](../../SKILL.md) |
| 项目愿景 | [../../VISION.md](../../VISION.md) |
| 贡献规则 | [../../CONTRIBUTING.md](../../CONTRIBUTING.md) |
| 隐私边界 | [../governance/privacy-and-redaction.md](../governance/privacy-and-redaction.md) |
| Verdict 类型 | [../reference/verdicts.md](../reference/verdicts.md) |
| 报告模板 | [../reference/report-templates.md](../reference/report-templates.md) |
| Factor 协议 | [../reference/factor-analysis-protocol.md](../reference/factor-analysis-protocol.md) |

当前仓库优先提供协议、文档、案例模板和共创面。CLI、TUI、因子运行时属于后续开发轨道。

## 最短使用链路

用户把 README 里的启动语复制给 Agent。Agent 读取 `SKILL.md`，基于当前可见 session 生成一张轻量 verdict card。

```text
用户复制启动语
-> Agent 读取 SKILL.md
-> Agent 汇总当前 session evidence
-> Agent 输出 Session Verdict Card
-> 用户选择保存、贡献、忽略或继续观察
```

默认模式不要求安装 CLI、启用 hook、启用 cron、访问社区 registry、上传 raw session 或创建 PR。

## 共创闭环

EvoZeus 的社区贡献围绕脱敏后的 Scenario + Rule graph 展开。

```text
Local Evidence Report
-> Agent Review
-> Case Draft
-> User Approval
-> Issue / PR
-> Community Review
-> Accepted Rule / Factor / Golden Case
```

社区输入以经过脱敏和审判后的 Case、Rule、Factor、Golden Case 为主；raw session 默认留在本地。

## 继续阅读

1. [第一次 Session Verdict](../start/first-session.zh-CN.md)
2. [Skill Driven Software](skill-driven-software.zh-CN.md)
3. [项目地图：Scope 和组件](project-map.zh-CN.md)
4. [概念文档](README.zh-CN.md)
5. [术语表](../glossary/README.zh-CN.md)
6. [项目愿景](../../VISION.md)
7. [隐私和脱敏规则](../governance/privacy-and-redaction.md)
