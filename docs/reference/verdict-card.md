# Session Verdict Card

- Status: active
- Last updated: 2026-06-15

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
