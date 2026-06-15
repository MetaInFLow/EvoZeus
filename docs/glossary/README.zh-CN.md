# Glossary

- Status: active
- Last updated: 2026-06-15
- Language: zh-CN

## 规则

Glossary 放短定义、别名、状态和跳转。一个术语需要背景、边界、例子或关系图时，进入 [../concepts/](../concepts/)。

`reference/` 只放稳定协议、schema、模板和机器可执行契约。

## Core

| Term | 中文名 | Short Definition | More |
| --- | --- | --- | --- |
| Skill Driven Software | 技能驱动软件 | 由 code、scenario skill、factor、rule、report、runtime 共同驱动的软件范式 | [SDS](../concepts/skill-driven-software.zh-CN.md) |
| Session | 会话 | 一次真实 Agent 执行 | [Core](../concepts/core.zh-CN.md) |
| Evidence | 证据 | 支撑判断的最小证据 | [Core](../concepts/core.zh-CN.md) |
| Case | 案件 | 等待审判的发现 | [Core](../concepts/core.zh-CN.md) |
| Verdict | 裁决 | 基于 Evidence 对 Case 给出的结果 | [Verdicts](../reference/verdicts.md) |
| Artifact | 沉淀资产 | Verdict 落成的资产 | [Core](../concepts/core.zh-CN.md) |
| Library | 资产库 | 可复用资产库 | [Core](../concepts/core.zh-CN.md) |

## Runtime

| Term | 中文名 | Short Definition | More |
| --- | --- | --- | --- |
| Analysis Framework | 分析框架 | 一次 session 分析的 stage 结构 | [Runtime](../concepts/runtime.zh-CN.md) |
| Factor | 因子 | 绑定到 stage 的判断逻辑 | [Runtime](../concepts/runtime.zh-CN.md) |
| Factor Result | 因子结果 | Factor 的稳定输出格式 | [Factor Protocol](../reference/factor-analysis-protocol.md) |
| Factor Runtime | 因子运行时 | 执行、降级、记录 factor 的本地运行层 | [Runtime](../concepts/runtime.zh-CN.md) |
| Skill Matrix | 技能路由矩阵 | 场景到可下载 skill package 的路由表 | [Skills](../../skills/index/SKILL.md) |
| Skill Package | 技能包 | 可下载的场景化 Agent 能力包 | [Skills](../../skills/index/SKILL.md) |
| Skill Router | 技能路由器 | 根 `SKILL.md` 中根据场景提示 skill package 的索引层 | [Skills](../../skills/index/SKILL.md) |

## Community

| Term | 中文名 | Short Definition | More |
| --- | --- | --- | --- |
| Scenario | 场景 | Rule 或 Case 适用的上下文 | [Community](../concepts/community.zh-CN.md) |
| Rule | 规则 | 在某个 Scenario 下可复用的判断或行动规则 | [Community](../concepts/community.zh-CN.md) |
| Golden Case | 黄金案件 | 质量足够高、可作为参考的历史贡献 | [Community](../concepts/community.zh-CN.md) |
| Accepted Rule | 已接受规则 | 已通过社区审查的 Rule | [Community](../concepts/community.zh-CN.md) |
| Rejected Pattern | 淘汰模式 | 被明确淘汰的低价值或有害模式 | [Community](../concepts/community.zh-CN.md) |

## Safety

| Term | 中文名 | Short Definition | More |
| --- | --- | --- | --- |
| Redaction | 脱敏 | 去除或泛化 PII、secret 和敏感上下文 | [Privacy](../governance/privacy-and-redaction.md) |
| Privacy Gate | 隐私门禁 | 公开贡献前的隐私检查点 | [Privacy](../governance/privacy-and-redaction.md) |
| Authorization Gate | 授权门禁 | 写入、上传、安装、贡献前的确认点 | [Development Workflows](../development/workflows.zh-CN.md) |
| Local-first | 本地优先 | raw session 默认留在本地 | [Project Overview](../concepts/project-overview.zh-CN.md) |
