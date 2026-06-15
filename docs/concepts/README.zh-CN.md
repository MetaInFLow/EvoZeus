# EvoZeus Concepts

- Status: active
- Last updated: 2026-06-15
- Language: zh-CN

本目录解释 EvoZeus 的核心概念。它服务三类读者：

- 真人用户：快速理解项目有什么用。
- 用户的 Agent：按稳定术语执行审判、归因、脱敏和草拟。
- 社区贡献者：用同一套词提交 Case、Rule、Factor 和 Golden Case。

## 阅读路径

| 你想知道 | 阅读 |
| --- | --- |
| Skill Driven Software 是什么 | [skill-driven-software.zh-CN.md](skill-driven-software.zh-CN.md) |
| 项目整体在管什么 | [project-overview.zh-CN.md](project-overview.zh-CN.md) |
| Scope 和组件如何分层 | [project-map.zh-CN.md](project-map.zh-CN.md) |
| 项目审判闭环里的基本词 | [core.zh-CN.md](core.zh-CN.md) |
| Factor、Analysis Framework、运行时协议 | [runtime.zh-CN.md](runtime.zh-CN.md) |
| Scenario、Rule、Golden Case、社区共创 | [community.zh-CN.md](community.zh-CN.md) |
| 术语短定义和索引 | [../glossary/README.zh-CN.md](../glossary/README.zh-CN.md) |
| English version | [README.en.md](README.en.md) |

## Concepts 和 Glossary 怎么分工

术语增长后按这个规则分流：

- `glossary/` 放短定义、别名、状态和跳转。
- `concepts/` 放需要解释背景、边界、例子和关系图的概念。
- `reference/` 只放稳定协议、schema、模板和机器可执行契约。
- 新词先进入 glossary；当一个词需要超过一段解释，或影响工作流和架构，再升级成 concepts 页面。

## Concept Groups

| Group | Purpose | Main Docs |
| --- | --- | --- |
| Project | 定义项目整体边界 | Skill Driven Software、Project Overview、Project Map |
| Core | 定义审判闭环里的对象 | Session、Evidence、Case、Verdict、Artifact、Library |
| Runtime | 定义本地分析和因子执行 | Analysis Framework、Factor Runtime、Factor、Factor Result |
| Workflow | 定义用户和 Agent 的操作阶段 | Manual Session Review、Doctor、End-of-task Judgment、Incremental Insight |
| Community | 定义社区共创资产和状态 | Scenario、Rule、Golden Case、Accepted Rule、Disputed Rule |
| Safety | 定义隐私和授权边界 | Redaction、Privacy Gate、Authorization Gate、Local-first |

## 命名规则

- 专有对象首字母大写：`Session`、`Evidence`、`Case`、`Verdict`。
- 协议对象保留英文：`Analysis Framework`、`Factor Result`、`runtime_profile`。
- 面向用户的动作可以中英混写：`Manual Session Review`、`Open Case`、`Factor Inspect`。
- 公开贡献相关词必须带状态：`candidate`、`accepted`、`disputed`、`deprecated`。
