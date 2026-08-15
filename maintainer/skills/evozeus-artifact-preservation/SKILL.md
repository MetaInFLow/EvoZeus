---
name: evozeus-artifact-preservation
description: Use when 用户希望保存、发布 Verdict，或将 Verdict 转化为 Case、Candidate、Factor、Pattern、Habit、Environment Rule、报告或 PR 时使用。
---

# EvoZeus Artifact 保存

只有在已有判断且用户确认下一步动作后，才开始保存。目标是将 Artifact 路由到正确的生命周期，不把所有内容都推入一个 Repo。

## 保存流程

```text
Verdict
  -> Artifact 候选
  -> 用户确认
  -> 脱敏
  -> 按 Artifact 类型路由
  -> issue / PR / lab 提交 / runtime PR
```

## 路由表

| Artifact 候选 | 路由 |
| --- | --- |
| Case、Evidence Report、Session Verdict Card | `EvoZeus` issue 或 Candidate PR |
| Semantic Factor 提案 | 先进入 `EvoZeus` Factor proposal / Candidate PR |
| Habit、Pattern、Environment Rule | `EvoZeus` Candidate PR |
| 内置可执行 Factor | `EvoZeus/packs/session-signal/` |
| 内置 scanner、resolver、Runtime 或报告执行 | `EvoZeus/packages/runtime/` |
| 第三方 Factor pack 或 scanner | 独立扩展 Repo |
| CLI、插件、本地 registry 和频道行为 | `EvoZeus` |

## 必要门禁

公开保存前：

1. 应用 `../evozeus-redaction/SKILL.md`。
2. 确认证据足以支持当前路由。
3. 确认用户批准 issue、PR、上传或本地文件写入。
4. 公开贡献使用 `../evozeus-community-contribution/SKILL.md`。
5. 可执行 pack 或 scanner 工作使用 `../evozeus-scanner-pack-authoring/SKILL.md`。

## 边界

- 不要发布原始私密会话。
- 内置可执行内容和 Runtime 变更需要在主 Repo 进行高风险复核。
- 第三方可执行扩展必须位于独立 Repo 边界内。
- 不要虚构 reviewed 或 official 状态。
