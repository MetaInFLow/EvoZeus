# Runtime

- Status: active
- Last updated: 2026-06-15
- Audience: 想理解本地运行层、TUI 和 Agent 交互的人

## Runtime 管什么

Runtime 负责让用户和 Agent 低成本完成本地审判、查看报告、检查环境、管理因子和确认贡献。

## 主要组件

| Component | Purpose |
| --- | --- |
| TUI | 首期主交互界面 |
| Browser Companion | 需要真人 insight、脱敏预览、贡献确认时打开 |
| Local Workspace | `.evozeus/` 本地状态、报告、缓存 |
| Doctor | 检查环境、依赖、配置和 runtime 状态 |
| Status | 查看本地报告、因子库、贡献和 workspace 状态 |
| Skill Router | 根据场景提示可下载 skill package |

## 你可能在找

| Need | Read |
| --- | --- |
| Runtime 设计 | [TUI Companion Design Doc](../design/active/design_doc-v0.2-tui-agent-companion-workflow.md) |
| 开发工作流 | [Development Workflows](../development/workflows.zh-CN.md) |
| 架构说明 | [Development Architecture](../development/architecture.zh-CN.md) |
| 报告类型 | [Reports](../reports/README.zh-CN.md) |
| 因子库 | [Factors](../factors/README.zh-CN.md) |
| Skill Matrix | [Skills](../../skills/index/SKILL.md) |

## 默认模式

默认模式是 `Manual Session Review`：

```text
复制启动语
-> Agent 读取 SKILL.md
-> Agent 输出 Verdict Card
-> 用户选择后续动作
```

默认不写文件、不启用 hook、不启用 cron、不上传 raw session、不创建 issue 或 PR。
