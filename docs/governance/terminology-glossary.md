# Terminology Glossary

- Status: active
- Last updated: 2026-06-15

| Term | 中文名 | Meaning | Source of Truth |
| --- | --- | --- | --- |
| Session | 会话 | 一次真实 Agent 执行 | Design Doc |
| Evidence | 证据 | 支撑判断的最小证据 | Design Doc |
| Case | 案件 | 等待审判的 session-derived finding | CONTRIBUTING |
| Verdict | 裁决 | 基于 Evidence 对 Case 给出的结果 | Reference: Verdicts |
| Artifact | 沉淀资产 | Verdict 落成的资产 | Design Doc |
| Library | 资产库 | 被接受的可复用公共资产库 | Design Doc |
| Analysis Framework | 分析框架 | 一套分析任务的上下文、阶段和输出约束 | Reference: Factor Analysis Protocol |
| Factor Runtime | 因子运行时 | 运行 factor、收集 Factor Result 的本地执行层 | Reference: Factor Analysis Protocol |
| Factor | 因子 | 绑定到某个 framework stage 的可复用判断算法 | Reference: Factor Analysis Protocol |
| Factor Result | 因子结果 | Factor 产出的 tag、score、evidence ref、verdict signal 和 confidence | Reference: Factor Analysis Protocol |
| Heavy Factor | 重因子 | 需要额外模型、较高资源或外部服务的可选 factor | Reference: Factor Analysis Protocol |
| Environment Rule | 环境规则 | 对路径、网络、认证、权限、版本等问题的诊断规则 | Examples |
| Rejected Pattern | 淘汰模式 | 被判定为低价值、浪费 token 或有害的模式 | Reference: Verdicts |
