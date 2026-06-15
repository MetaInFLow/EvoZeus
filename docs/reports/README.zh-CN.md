# Reports

- Status: active
- Last updated: 2026-06-15
- Audience: 需要查看、实现或贡献 EvoZeus 报告的人

## 这里放什么

`reports/` 解释报告类型、阅读方式和报告到行动的决策路径。

`reference/report-templates.md` 只保留模板和字段契约。用户怎么看报告、Agent 什么时候生成哪种报告，放在本目录。

## 拿到报告先看这里

| 你看到的东西 | 先读 | 你要做的决定 |
| --- | --- | --- |
| 一张简短 verdict card | Session Verdict Card | 这次是否保存、修正或继续观察 |
| 一份错误或阻塞诊断 | Debug Report | 先修环境、配置、依赖还是继续排查 |
| 一份规律总结 | Insight Draft | 是否沉淀成 Skill、Rule、Factor 或 Habit |
| 一份准备公开的内容 | Redacted Case Draft | 是否可以贡献社区 |
| 一份因子说明 | Factor Inspect Report | 是否安装、启用、更新或回滚 |
| 一份历史列表 | Contribution History Report | 哪些贡献可复用、哪些还要处理 |

## Report Type Map

| Report Type | 触发场景 | 主要读者 | 读完要做的决定 |
| --- | --- | --- | --- |
| Session Verdict Card | 一次普通 Agent session 结束后 | 用户、Agent | 保存、修正、忽略或继续观察 |
| Session Verdict Report | 需要比 card 更完整的 session 复盘 | 用户、Agent、开发者 | 是否生成 Case 或 Artifact |
| Debug Report | 任务失败、延后、跑不起来 | 用户、Agent、开发者 | 修环境、改配置、补依赖或继续排查 |
| Insight Draft | 发现重复纠偏或高质量 adhoc 结果 | 用户、Agent | 是否沉淀为 Skill、Rule、Factor 或 Habit |
| Redacted Case Draft | 准备贡献社区前 | 用户、社区 reviewer | 是否可以公开、是否需要补证据 |
| Factor Inspect Report | 查看或安装因子库前 | 用户、Agent、开发者 | 是否安装、启用、更新或回滚 |
| Factor Status Report | 检查本地 factor runtime 状态 | 用户、Agent、开发者 | 保持、更新、禁用或回滚 |
| Contribution History Report | 查看历史贡献 | 用户、社区 reviewer | 哪些贡献可复用、哪些仍需处理 |
| Workspace Summary Report | 跨 session 增量分析 | 用户、Agent | 哪些重复模式值得沉淀 |
| Evidence Graph Report | 需要追溯判断依据 | Agent、开发者、reviewer | 结论是否被证据支撑 |

## 报告分层

### 1. Single-session Reports

面向一次 session：

- Session Verdict Card
- Session Verdict Report
- Debug Report
- Evidence Graph Report

### 2. Insight Reports

面向可沉淀规律：

- Insight Draft
- Workspace Summary Report

### 3. Factor Reports

面向因子库和分析框架：

- Factor Inspect Report
- Factor Status Report

### 4. Community Reports

面向贡献和治理：

- Redacted Case Draft
- Contribution History Report

## 报告通用结构

所有报告都应该尽量包含：

```text
report_type
scope
source_session_or_workspace
evidence_summary
judgment_signals
proposed_verdict
privacy_note
recommended_next_action
confidence_note
links
```

## 报告生成原则

- 报告先帮助用户做决定，再服务归档。
- 报告必须展示 evidence 和 privacy note。
- 报告不能默认上传 raw session。
- 报告不能默认创建 issue 或 PR。
- 报告类型必须明确，避免用户拿到一份看不出用途的长文。

## 阅读教程

- [看懂一份报告](../start/read-report.zh-CN.md)
- [第一次 Session Verdict](../start/first-session.zh-CN.md)

## 模板和契约

- [Report Templates](../reference/report-templates.md)
- [Verdict Reference](../reference/verdicts.md)
- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
