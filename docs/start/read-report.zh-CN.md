# 看懂一份报告

- Status: active
- Last updated: 2026-06-15
- Audience: 已经拿到 EvoZeus 报告的用户
- Time: 5-10 分钟

## 目标

读完一份报告后，用户能判断三件事：

1. 这是什么类型的报告。
2. 报告里的证据是否足够支撑结论。
3. 下一步应该保存、修正、贡献、忽略或继续观察。

报告类型总表见 [../reports/README.zh-CN.md](../reports/README.zh-CN.md)。

## Step 1：确认 Report Type

先看报告头部的 `report_type` 或标题。

常见类型：

| Report Type | 你要判断什么 |
| --- | --- |
| Session Verdict Card | 这次 session 值得保留、修正、忽略还是继续观察 |
| Debug Report | 任务失败或延后的原因是什么 |
| Insight Draft | 哪个重复纠偏或高质量 adhoc 结果值得沉淀 |
| Redacted Case Draft | 这份内容是否可以贡献社区 |
| Factor Inspect Report | 某个 factor 是否值得安装或启用 |
| Contribution History Report | 历史贡献的状态和复用价值 |
| Workspace Summary Report | 多次 session 的重复模式是什么 |

Expected result:

```text
我知道这份报告属于哪个类型，也知道它要支持哪个决定。
```

## Step 2：看 Evidence

先读 evidence，再读 verdict。

检查点：

- evidence 是否来自当前 session。
- evidence 是否能追溯到具体错误、tool call、用户纠偏、diff、输出或上下文。
- evidence 是否缺少关键前提。
- evidence 是否包含 PII、secret 或敏感业务信息。

Expected result:

```text
我能说清楚报告为什么给出这个判断。
```

## Step 3：看 Judgment Signals

Judgment signals 是报告里的判断依据。

常见 signal：

- 任务失败
- 任务延后
- 返工
- 误判
- 重复纠偏
- 高质量 adhoc 结果
- 环境异常
- factor 命中
- 隐私风险

如果 signal 和 evidence 对不上，这份报告应该进入 `Open Case` 或继续观察。

## Step 4：看 Proposed Verdict

Verdict 决定下一步动作。

| Verdict | 下一步 |
| --- | --- |
| Promote to Skill | 草拟 Skill 或 Skill 改进建议 |
| Extract Factor | 草拟 Factor 或 Factor 改进建议 |
| Keep as Habit | 保存为本地习惯 |
| Fix Environment | 修改本地配置或依赖 |
| Reject Pattern | 标记为低价值模式 |
| Preserve | 保存为参考 Case |
| Open Case | 收集更多 evidence |

Verdict 定义见 [../reference/verdicts.md](../reference/verdicts.md)。

## Step 5：看 Privacy Note

公开贡献前必须检查：

- 是否包含姓名、邮箱、电话、账号、客户名等 PII。
- 是否包含 token、密钥、内部 URL、私有路径。
- 是否包含未脱敏业务上下文。
- 是否能用泛化描述替代原文。

隐私规则见 [../governance/privacy-and-redaction.md](../governance/privacy-and-redaction.md)。

## Step 6：选择下一步动作

| Action | 适用情况 |
| --- | --- |
| Save local draft | 本地有价值，但暂时不公开 |
| Fix environment | 报告指向配置、依赖、权限或版本问题 |
| Create redacted Case | 有社区价值，且可以脱敏 |
| Contribute | 用户确认公开内容 |
| Ignore | evidence 弱或价值低 |
| Keep observing | 信号出现一次，还不足以沉淀 |

## If It Fails

| Problem | Next Step |
| --- | --- |
| 看不出报告类型 | 回到 [报告类型总表](../reports/README.zh-CN.md) |
| evidence 太弱 | 标成 `Open Case` |
| verdict 太跳 | 要求 Agent 补 evidence |
| 隐私风险高 | 先做 redaction review |
| 不知道下一步 | 只保存本地草稿 |

## Recap

看报告的顺序：

```text
Report Type
-> Evidence
-> Judgment Signals
-> Proposed Verdict
-> Privacy Note
-> Next Action
```
