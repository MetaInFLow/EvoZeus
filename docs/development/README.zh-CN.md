# 开发入口

- Status: active
- Last updated: 2026-06-15
- Audience: 要开发 EvoZeus repo 的人

## 当前开发状态

当前 repo 优先沉淀协议、文档、模板和贡献边界。CLI、TUI、browser companion、factor runtime 处于设计和开发规划阶段。

默认使用模式是 `Manual Session Review`：

```text
README copy prompt
-> Agent 读取 SKILL.md
-> Agent 输出 Session Verdict Card
-> 用户选择是否进入保存、TUI、贡献或因子相关动作
```

首期开发目标是把这条链路做成可运行、可验证、可扩展的本地闭环。

## 开发阅读顺序

1. [开发架构](architecture.zh-CN.md)
2. [开发工作流场景](workflows.zh-CN.md)
3. [Architecture Decisions](../decisions/README.zh-CN.md)
4. [Skill Matrix](../../skills/index/SKILL.md)
5. [TUI + Agent Companion Design Doc](../design/active/design_doc-v0.2-tui-agent-companion-workflow.md)
6. [Implementation Plan v0.2](../plans/implementation-plan-v0.2-tui-agent-companion.md)
7. [Report Types](../reports/README.zh-CN.md)
8. [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
9. [Verdict Reference](../reference/verdicts.md)
10. [Change Scope Policy](../governance/change-scope-policy.md)
11. [Privacy and Redaction](../governance/privacy-and-redaction.md)

## 开发边界

首期优先开发：

| Track | Outcome |
| --- | --- |
| Protocol Surface | `SKILL.md`、Case 模板、Verdict、隐私门禁 |
| Scenario Skills | Skill Matrix、scenario skill packages、manifest、下载授权 gate |
| Local Runtime | `.evozeus/` 本地状态、SQLite registry、Markdown/JSON report |
| TUI | onboard、doctor、status、review、contribute 的主交互 |
| Reports | report type、report view、report-to-action decision |
| Factor Runtime | factor manifest、inspect、enable、update、rollback |
| Community Library | Cases、Factors、Habits、Environment Rules、Rejected Patterns |

当前暂缓：

- 默认启用 hook 或 cron
- 自动上传 raw session
- 自动创建 issue / PR
- 大规模 graph database
- Web dashboard
- 多用户权限系统

## 文件怎么分工

| Area | Current Location |
| --- | --- |
| 项目入口 | `README.md` |
| Agent 协议入口 | `SKILL.md` |
| 产品和架构设计 | `docs/design/active/` |
| 架构决策记录 | `docs/decisions/` |
| 开发计划 | `docs/plans/` |
| 报告类型 | `docs/reports/` |
| Skill 矩阵 | `skills/` |
| 稳定协议 | `docs/reference/` |
| 文档入口 | `docs/start/`、`docs/judgment/`、`docs/reports/`、`docs/factors/`、`docs/community/`、`docs/runtime/` |
| 治理规则和变更范围 | `docs/governance/` |

## 开发记录怎么分

| Record | Location | When to Add |
| --- | --- | --- |
| Design Doc | `docs/design/{backlog,active,done}/` | 需要解释产品意图、架构边界、用户链路 |
| Implementation Plan | `docs/plans/` | 设计已接受，需要拆文件、任务、验证顺序 |
| ADR | `docs/decisions/` | 默认行为、架构、安全、协议或 runtime contract 发生重要变化 |
| Skill Package Draft | `skills/` | 新增或调整可下载场景 skill、manifest、路由规则 |

## 验证口径

开发完成后的最小验证：

1. 用户可以只复制 README 启动语完成一次 verdict card。
2. Agent 可以区分本地建议、debug 建议、skill proposal、community contribution。
3. 默认链路不会写文件、上传数据、启用 hook、启用 cron。
4. 任何公开贡献前都会经过 PII redaction 和用户确认。
5. factor 的输入、输出、stage 绑定和降级策略符合协议。
