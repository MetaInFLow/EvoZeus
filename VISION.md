# EvoZeus Vision

- Status: active
- Last updated: 2026-06-15

## Core Belief

EvoZeus 的长期愿景是让 AI 具备真正的自进化能力。

EvoZeus 同时把这个目标落实为一种软件范式：**Skill Driven Software（SDS）**。

SDS 中的软件行为由 code、scenario skill、factor、rule、report 和 runtime 共同驱动。传统代码负责稳定执行，Skill 负责场景化行动方式，Factor 负责判断信号，Rule 负责可复用决策，Report 负责把证据、verdict 和下一步动作交还给人，Runtime 负责本地执行、授权和状态管理。

自进化依赖两个核心条件：

- **Environment**：AI 在什么任务、工具、约束、偏好、组织规则和反馈里工作。
- **Value Function**：AI 如何判断什么做对了，什么需要修正，什么应该淘汰。

EvoZeus 把真实 Agent Session 放上审判台，用 Evidence、Case、Verdict 和 Artifact 逐步校准 value function。

## Judgment Source

EvoZeus 关注真实 AI 工作过程里的判断信号：

- 导致任务失败的行为
- 导致任务延后的绕路、误判和返工
- 用户明确纠偏的时刻
- adhoc 但结果很好的任务
- 已被验证过的 golden 方法论、规则和习惯

这些信号不能只停在感受层。它们需要被转成可复核的 Evidence、可讨论的 Case、可沉淀的 Verdict，以及可复用的 Rule。

## Personal Value Function

每个人对“AI 做得好”的判断都不同。

有人更重视速度，有人更重视完整性；有人希望 Agent 主动推进，有人希望 Agent 在关键不确定处停下来确认；有人在意审美和表达，有人更在意可验证性和工程边界。

EvoZeus 的个人侧目标，是让这些偏好从真实 session 中被发现、记录和更新：

```text
Private Session
-> Evidence
-> Preference Signal
-> Personal Rule
-> Dynamic Value Function
```

完整个人偏好默认保留在本地。公开贡献只保留脱敏后的抽象 persona / context 标签，并写清适用边界。

## Community Scenario + Rule Graph

EvoZeus 的社区侧目标，是收集和治理 `Scenario + Rule` pair。

社区提交的核心是带证据的 graph fragment。孤立建议需要先补足证据和边界：

```text
Scenario
-> Observed Pattern
-> Recommended Rule
-> Evidence
-> Boundary
```

一个 scenario 可以包含多层 context：

- 任务类型：写代码、debug、调研、写文档、销售方案、数据处理
- AI 使用方式：使用的 Agent、Skill、多轮协作方式
- 失败 / 成功类型：延后、返工、误判、意外高质量
- 抽象偏好标签：evidence-first、high-autonomy、dislikes-generic-advice
- 隐私处理：PII redaction、私有路径和客户信息脱敏

Rule 的成熟路径是两段式：

```text
Scenario + Observed Pattern
-> evidence-backed review
-> Scenario + Recommended Rule
```

## GitHub as Value Graph v0

EvoZeus v0 使用 GitHub issue / PR 承载社区 graph 工作流：

```text
Issue = candidate graph fragment
PR = curated graph fragment
main = accepted rule library
```

合并到主线代表当前证据支持该 fragment 进入公共 judgment library。后续 Case 可以增强、限制、挑战或废弃已有 Rule。

## Narrative Tone

EvoZeus 的表达需要保持：

- 严肃
- 克制
- 重证据
- 有判例感
- 有协议感
- 本地优先
- 社区共创
- 面向 AI 自进化

推荐持续使用这些核心词：

```text
Skill Driven Software
Agent Session
Evidence
Case
Verdict
Artifact
Library
Scenario Skill
Scenario
Rule
Value Function
Redaction
Local-first
```

## Long-term Direction

EvoZeus 的长期方向是 judgment infrastructure。

它从真实 Agent Session 中提取证据，把失败、延后、误判、纠偏和意外成功转化为 Scenario + Rule graph，帮助个人形成动态 value function，也让社区共同沉淀可复用的 Agent 判例库。
