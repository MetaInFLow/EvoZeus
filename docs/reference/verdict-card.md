# Session Verdict Card

- Status: active
- Last updated: 2026-06-26

Session Verdict Card 是 Manual Session Review 的默认零安装输出结构。它用于先给出可读、可审查、可复制的裁决摘要，不要求本地写文件，也不触发 GitHub 操作。

## Fields

| Field | 中文名 | Meaning |
| --- | --- | --- |
| Task context | 任务上下文 | Agent 当时要完成什么 |
| Key evidence | 关键证据 | 当前 session 中可见的最小证据 |
| Judgment signals | 判断信号 | 失败、延迟、误判、修正、意外有效结果 |
| Proposed verdict | 建议裁决 | Preserve、Promote to Skill、Extract Factor、Keep as Habit、Fix Environment、Reject Pattern、Open Case |
| Suggested next action | 建议下一步 | 保存、忽略、调试、起草 Case、打开 TUI、贡献 |
| Privacy note | 隐私说明 | 哪些内容留在本地，哪些内容需要脱敏 |
| Optional next steps | 可选下一步 | 需要用户显式同意的后续动作 |

## Markdown Shape

```md
## Session Verdict Card

### Task context

### Key evidence

### Judgment signals

### Proposed verdict

### Suggested next action

### Privacy note

### Optional next steps
```

## Visual / HTML Shape

P0 的默认可视化输出应先让 reviewer 看见裁决，而不是先看 factor 表格。

```text
Session Verdict Card
  Proposed Verdict
  Evidence
  Judgment Signals
  Artifact Route
  Privacy
  Next Action
  Boundary
```

渲染规则：

- 首屏必须显示 `Session Verdict Card`、`Proposed Verdict` 和当前 verdict。
- `Evidence` 只展示可脱敏的 evidence refs、source locator 或摘要，不展示 raw session 全文。
- `Judgment Signals` 展示 factor 输出的信号和标签，但不把它们包装成最终分数。
- `Artifact Route` 根据 verdict 指向 Case、Factor、Skill、Habit、Environment Rule、Rejected Pattern 或 Pending Case。
- `Privacy` 必须说明 raw session 默认留在本地。
- `Next Action` 必须是一个可执行动作，不能只是抽象建议。
- `Boundary` 必须说明 factor output 只是 proposed signal，最终是否进入 Library 由 human review 决定。

## Verdict To Artifact Route

| Proposed verdict | Artifact route |
| --- | --- |
| `Preserve` | Accepted Case |
| `Promote to Skill` | Skill Candidate |
| `Extract Factor` | Factor Candidate |
| `Keep as Habit` | Habit |
| `Fix Environment` | Environment Rule |
| `Reject Pattern` | Rejected Pattern |
| `Open Case` | Pending Case |

如果没有可定位 evidence，默认 route 应是 `Open Case -> Pending Case`，不是直接进入 Skill 或 Factor。
