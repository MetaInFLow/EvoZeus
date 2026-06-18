# Terminology Glossary

- Status: active
- Last updated: 2026-06-15

| Term | 中文名 | Meaning | Source of Truth |
| --- | --- | --- | --- |
| Session | 会话 | 一次真实 Agent 执行 | Design Doc |
| Evidence | 证据 | 支撑判断的最小证据 | Design Doc |
| Case | 案件 | 等待审判的 session-derived finding | CONTRIBUTING |
| Candidate | 候选资产 | 尚未被接受进入 Library 的 Artifact proposal | Reference: Ontology |
| Verdict | 裁决 | 基于 Evidence 对 Case 给出的结果 | Reference: Verdicts |
| Artifact | 沉淀资产 | Verdict 落成的资产 | Design Doc |
| Library | 资产库 | 被接受的可复用公共资产库 | Design Doc |
| Factor | 可复用判断因子 | Reference: Verdicts |
| Factor Pack | 因子包 | 可版本化发布和按需安装的一组 Factors、bundles 或 scanner modules | ADR-0002 |
| Scanner Module | 扫描模块 | 可执行的 Factor 支撑模块，必须声明权限、依赖、入口和沙箱边界 | Factor Registry Governance |
| Registry | 注册索引 | 指向已审核 release manifest 的安装入口，不是完整内容仓库 | ADR-0002 |
| Environment Rule | 对路径、网络、认证、权限、版本等问题的诊断规则 | Examples |
| Rejected Pattern | 被判定为低价值、浪费 token 或有害的模式 | Reference: Verdicts |
