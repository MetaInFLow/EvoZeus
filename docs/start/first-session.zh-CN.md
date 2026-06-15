# 第一次 Session Verdict

- Status: active
- Last updated: 2026-06-15
- Audience: 第一次尝试 EvoZeus 的用户

## 目标

用最短链路让 Agent 对当前 session 做一次轻量审判。这个教程默认不安装 CLI，不写本地文件，不上传 raw session，不创建 issue 或 PR。

## Step 1：复制启动语

把 README 里的启动语发给当前 Agent：

```text
请读取本仓库的 SKILL.md，并按 EvoZeus 审判当前 Agent Session。
```

## Step 2：Agent 读取协议入口

Agent 应读取 `SKILL.md`，并只基于当前可见上下文收集 evidence。

Agent 不应该默认执行这些动作：

- 安装依赖
- 创建本地 `.evozeus/`
- 启用 hook
- 启用 cron
- 上传 raw session
- 创建 issue 或 PR

## Step 3：Agent 输出 Verdict Card

最小输出形态：

```text
Session Verdict Card
- Task context
- Key evidence
- Judgment signals
- Proposed verdict
- Suggested next action
- Privacy note
- Optional next steps
```

## Step 4：用户选择下一步

用户可以选择：

| Option | Meaning |
| --- | --- |
| Save local draft | 保存本地草稿 |
| Open TUI | 进入本地 TUI |
| Create redacted Case | 生成脱敏 Case |
| Contribute to community | 进入 issue / PR 贡献流程 |
| Ignore | 本次不沉淀 |
| Keep observing | 继续观察，等待更多 evidence |

所有后续动作都需要用户确认。

## Step 5：看报告类型

第一次运行通常只产出 `Session Verdict Card`。如果 Agent 同时发现环境异常、重复纠偏或社区贡献线索，也可能建议继续生成其他报告。

报告类型见 [../reports/README.zh-CN.md](../reports/README.zh-CN.md)。

## 完成标准

完成本教程后，用户应该拿到一张 verdict card，并能判断这次 session 里哪些内容值得保留、修正、忽略或继续观察。

下一步可以阅读 [看懂一份报告](read-report.zh-CN.md)。
