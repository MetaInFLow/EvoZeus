# EvoZeus Docs

- Status: active
- Last updated: 2026-06-15

Docs 入口按产品区域组织。先从 `start/` 进入，再按你正在处理的对象跳到 judgment、reports、factors、community、runtime 或 development。

## Start Here

| 你要做什么 | 入口 | 读完应该知道 |
| --- | --- | --- |
| 第一次看项目 | [start/README.zh-CN.md](start/README.zh-CN.md) | 怎么跑第一次审判、怎么看第一份报告 |
| 理解项目范式 | [concepts/skill-driven-software.zh-CN.md](concepts/skill-driven-software.zh-CN.md) | Skill Driven Software 如何组织 code、skill、factor、rule、report、runtime |
| 看报告 | [reports/README.zh-CN.md](reports/README.zh-CN.md) | 报告类型、触发场景、读完做什么决定 |
| 理解审判链路 | [judgment/README.zh-CN.md](judgment/README.zh-CN.md) | Session、Evidence、Case、Verdict、Artifact 怎么串起来 |
| 看因子库 | [factors/README.zh-CN.md](factors/README.zh-CN.md) | Factor、Analysis Framework、inspect、enable、rollback |
| 找场景 Skill | [../skills/index/SKILL.md](../skills/index/SKILL.md) | 不同场景下应该下载或启用哪个 skill |
| 参与社区共创 | [community/README.zh-CN.md](community/README.zh-CN.md) | 怎么贡献脱敏 Case、Rule、Factor、Golden Case |
| 开发本仓库 | [development/README.zh-CN.md](development/README.zh-CN.md) | 当前架构、开发边界、先改哪里、怎么验证 |
| 判断能改哪里 | [governance/change-scope-policy.md](governance/change-scope-policy.md) | Pair Contribution、社区文档和 infra 开发的文件范围 |
| 排查问题 | [help/README.zh-CN.md](help/README.zh-CN.md) | 跑不起来、报告看不懂、隐私风险、因子异常怎么处理 |

## Docs Areas

| Area | Directory | Purpose |
| --- | --- | --- |
| Start | `start/` | 第一次使用、最短链路、教程和完整目录 |
| Judgment | `judgment/` | Agent session 审判链路和核心对象 |
| Reports | `reports/` | 报告类型、阅读方式、报告到行动的决策路径 |
| Factors | `factors/` | 因子库、分析框架、factor runtime |
| Skills | `skills/` | 场景化可下载 skill packages 和路由矩阵 |
| Community | `community/` | 脱敏贡献、Rule graph、Golden Case、历史贡献 |
| Runtime | `runtime/` | TUI、browser companion、doctor、status、本地 workspace |
| Development | `development/` | 开发入口、架构、工作流、ADR |
| Concepts | `concepts/` | 需要深入解释的概念页 |
| Reference | `reference/` | 稳定协议、schema、模板、contract |
| Help | `help/` | troubleshooting、FAQ、常见问题入口 |

完整目录见 [start/docs-directory.zh-CN.md](start/docs-directory.zh-CN.md)。

## Recommended Paths

### 第一次了解项目

1. [Start](start/README.zh-CN.md)
2. [第一次 Session Verdict](start/first-session.zh-CN.md)
3. [看懂一份报告](start/read-report.zh-CN.md)
4. [报告类型](reports/README.zh-CN.md)
5. [Skill Driven Software](concepts/skill-driven-software.zh-CN.md)
6. [项目概览](concepts/project-overview.zh-CN.md)
7. [项目地图](concepts/project-map.zh-CN.md)

### 开发项目

1. [Development](development/README.zh-CN.md)
2. [Runtime](runtime/README.zh-CN.md)
3. [Judgment](judgment/README.zh-CN.md)
4. [Reports](reports/README.zh-CN.md)
5. [Factors](factors/README.zh-CN.md)
6. [Skills](../skills/index/SKILL.md)
7. [Architecture Decisions](decisions/README.zh-CN.md)
8. [Reference](reference/README.zh-CN.md)

### 社区共创

1. [Community](community/README.zh-CN.md)
2. [Change Scope Policy](governance/change-scope-policy.md)
3. [Privacy and Redaction](governance/privacy-and-redaction.md)
4. [Reports](reports/README.zh-CN.md)
5. [Verdict Reference](reference/verdicts.md)

## Maintenance Rules

- `start/` 放第一次使用和可跟着走的教程。
- `judgment/` 放审判链路、Case、Verdict、Artifact 这些核心对象。
- `reports/` 放报告类型和报告阅读路径。
- `factors/` 放因子库和 analysis framework。
- `skills/` 放场景化 skill 路由、下载 gate 和 skill package 草案。
- `community/` 放贡献链路和社区资产。
- `runtime/` 放 TUI、browser companion、doctor、status、本地 workspace。
- `development/` 放开发入口和实现架构。
- `decisions/` 放 ADR，作为 development 的决策记录区。
- `governance/` 放隐私、术语、目录职责、变更范围和 changelog。
- `concepts/` 放需要背景、边界、例子或关系图的解释页。
- `glossary/` 放短定义和索引。
- `reference/` 只放稳定协议、schema、模板和机器可执行契约。
- `design/`、`plans/`、`decisions/` 属于 development 记录，不作为普通读者入口。
