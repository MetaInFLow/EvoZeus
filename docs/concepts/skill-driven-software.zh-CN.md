# Skill Driven Software

- Status: active
- Last updated: 2026-06-15
- Audience: 想理解 EvoZeus 项目范式的人

## 定义

**Skill Driven Software（SDS，中文名：技能驱动软件）** 是 EvoZeus 定义的软件新范式。

在 SDS 中，软件行为由以下资产共同驱动：

```text
Code
-> Scenario Skill
-> Factor
-> Rule
-> Report
-> Runtime
```

Code（代码）提供可执行底座。Scenario Skill（场景技能）指导 Agent 在具体场景下如何行动。Factor（因子）从 Evidence（证据）中抽取判断信号。Rule（规则）记录可复用决策。Report（报告）把 Evidence、signals、Verdict（裁决）和 next action 交还给人。Runtime（运行时）负责本地执行、授权、状态和回滚。

## 为什么需要 SDS

AI 软件的核心问题已经从“功能能否运行”扩展到“Agent 在真实场景中是否做对事”。

真实 session 中会持续出现：

- 任务失败
- 延后和返工
- 工具误用
- 用户重复纠偏
- 高质量 adhoc 做法
- 环境、权限、依赖和上下文问题

SDS 把这些信号转成可沉淀资产，让软件从一次性交付走向持续学习。

## SDS 的核心对象

| Object | 中文名 | Role |
| --- | --- | --- |
| Code | 代码 | 稳定执行和系统边界 |
| Scenario Skill | 场景技能 | 场景化 Agent 行动方式 |
| Factor | 因子 | 判断信号和分析逻辑 |
| Rule | 规则 | 可复用决策 |
| Report | 报告 | 证据、判断和下一步动作 |
| Runtime | 运行时 | 本地状态、授权、执行和回滚 |
| Community Library | 社区资产库 | 被接受的 Case、Rule、Factor、Skill 和 Golden Case |

## EvoZeus 如何实现 SDS

EvoZeus 用审判链路把真实 session 转成 SDS 资产：

```text
Session
-> Evidence
-> Case
-> Verdict
-> Artifact
-> Library
```

`Promote to Skill` 会生成或改进 Scenario Skill。`Extract Factor` 会生成判断因子。`Keep as Habit` 会形成个人或本地习惯。`Fix Environment` 会沉淀环境规则。`Reject Pattern` 会淘汰低价值模式。

## 与 Skill Matrix 的关系

Skill Matrix 是 SDS 的路由层。根 `SKILL.md` 只作为零安装入口和轻量 router。当当前场景需要更具体的行动方式时，Agent 可以根据 [Skill Index](../../skills/index/SKILL.md) 建议下载或启用对应 scenario skill。

下载或启用 skill 前必须展示 manifest，并获得用户确认。

## 与 Value Function 的关系

SDS 让 value function 具备可更新的工程载体：

```text
Evidence
-> Judgment Signal
-> Rule / Skill / Factor
-> Runtime Behavior
-> Updated Value Function
```

个人侧形成动态偏好和本地规则。社区侧形成脱敏后的 Scenario + Rule graph 和公共 judgment library。

## 相关文档

- [Project Overview](project-overview.zh-CN.md)
- [Core Concepts](core.zh-CN.md)
- [Runtime Concepts](runtime.zh-CN.md)
- [Skill Index](../../skills/index/SKILL.md)
- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
