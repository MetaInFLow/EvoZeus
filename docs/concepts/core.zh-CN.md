# 核心关键词

- Status: active
- Last updated: 2026-06-15
- Language: zh-CN

## 总览

EvoZeus 的核心闭环：

```text
Session
-> Evidence
-> Case
-> Verdict
-> Artifact
-> Library
```

这组词描述一次真实 Agent 工作如何被审判、沉淀和复用。

## 关键词中文名

| Term | 中文名 | 一句话解释 | 主要产物 |
| --- | --- | --- | --- |
| Session | 会话 | 一次真实 Agent 工作过程 | session record |
| Evidence | 证据 | 支撑判断的最小可复核材料 | evidence ref、summary |
| Case | 案件 | 从 evidence 组织出来、等待裁决的发现 | case draft |
| Verdict | 裁决 | 基于 evidence 对 case 给出的下一步结果 | verdict card、report |
| Artifact | 沉淀资产 | Verdict 落成后的可执行或可复用资产 | Rule、Skill Proposal、Factor Result、Environment Rule |
| Library | 资产库 | 被接受的可复用资产集合 | accepted case、rule、factor、rejected pattern |

## 读法

| Term | 读者应该记住什么 | 常见误读 |
| --- | --- | --- |
| Session | 原始事实来自一次真实 Agent 工作过程 | 当成普通聊天记录 |
| Evidence | 结论需要能回到证据 | 当成主观印象 |
| Case | Case 是等待处理的结构化发现 | 当成泛泛建议 |
| Verdict | Verdict 是裁决，必须指向下一步动作 | 当成分数或评价 |
| Artifact | Artifact 是沉淀结果，进入后续复用 | 当成文档附件 |
| Library | Library 是可被 Agent 再引用的资产库 | 当成资料归档 |

## Session

`Session` 是一次 Agent 工作过程。

可以包含：

- user prompt
- assistant message
- tool call
- command output
- error
- retry
- file diff
- final answer
- environment signal

默认规则：

- raw session 默认留在本地。
- 公开贡献只使用 redacted evidence。
- Agent 只能基于当前可见 session 或用户授权的本地历史做判断。

## Evidence

`Evidence` 是支撑判断的最小证据。

常见 evidence：

- 一段脱敏对话摘要
- 一条错误类型
- 一次 tool failure
- 一个 retry pattern
- 一个 diff summary
- 一个用户纠偏句
- 一个环境探测结果

Evidence 必须满足：

- 可追溯到 session 或 local report。
- 能支撑 Case 或 Verdict。
- 公开前经过 redaction。

## Case

`Case` 是等待审判的发现。

例子：

- Agent 把网络失败误判为认证失败。
- 用户多次强调同一条工作规则。
- 某个工具连续失败导致任务延后。
- 一次 adhoc 做法显著提高了产出质量。

Case 应包含：

- scenario
- observed pattern
- evidence refs
- proposed verdict
- privacy note
- boundary

## Verdict

`Verdict` 中文名是“裁决”。它基于 Evidence 对 Case 给出下一步结果。

首期 Verdict：

| Verdict | 使用场景 |
| --- | --- |
| `Preserve` | 保留为参考 Case |
| `Promote to Skill` | 沉淀成 Skill 或 Skill proposal |
| `Extract Factor` | 抽成可复用判断因子 |
| `Keep as Habit` | 保持为轻量习惯或 checklist |
| `Fix Environment` | 归因到路径、网络、认证、权限、版本、配置 |
| `Reject Pattern` | 标记为低价值或高风险模式 |
| `Open Case` | 证据不足，继续观察 |

## Artifact

`Artifact` 是 Verdict 落成后的资产。

可能是：

- Rule
- Skill Proposal
- Factor Result
- Environment Rule
- Debug Verdict
- Redacted Case
- Rejected Pattern

## Library

`Library` 是被接受的可复用资产集合。

首期可以是本地目录、Markdown、JSON 或 GitHub issue / PR。后续可以演进为 registry 或 graph。

## 相关文档

- [Verdicts](../reference/verdicts.md)
- [Report Templates](../reference/report-templates.md)
- [Privacy and Redaction](../governance/privacy-and-redaction.md)
- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
