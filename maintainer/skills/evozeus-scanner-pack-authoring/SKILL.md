---
name: evozeus-scanner-pack-authoring
description: Use when 编写、复核、路由或提交可执行 Factor pack、scanner module、scanner pack、resolver 或 pack 权限声明时使用。
---

# EvoZeus Scanner Pack 编写

可执行 pack 和 scanner module 属于组件，不放入 `EvoZeus` 主 Repo；它们从 `EvoZeus-factor-lab` 开始，只有经过 Release 复核才可以成为 official。

## 使用时机

以下场景使用此 Skill：

- 可执行 Factor pack
- scanner module
- scanner pack
- resolver script
- 文件/会话摄取逻辑
- pack 权限声明
- 依赖、sandbox 或供应链复核

## 路由

```text
EvoZeus Case / Candidate
  -> 维护者路由
  -> 提交到 EvoZeus-factor-lab
  -> 证据 + 隐私 + scanner 权限门禁
  -> reviewed / rejected
  -> 可选晋级到 EvoZeus-session-signal-skill
```

## 必要提交包

每个 pack 或 scanner 提交都应包含：

- 来源 Case 或 Candidate 链接
- 证据包
- 目的和触发条件
- 输入文件、env var、命令和网络行为
- 输出文件、stdout、报告字段和本地状态变更
- 依赖、lockfile、license、checksum 或 sandbox 说明
- 失败模式和回滚路径
- 隐私说明

## 下一步读取

- 语义 Factor 质量读取 `../evozeus-factor-authoring/SKILL.md`。
- 公开证据前读取 `../evozeus-redaction/SKILL.md`。
- scanner pack 契约读取 `../../../docs/reference/scanner-pack-protocol.md`。
- 在 lab Repo 内工作时读取 `EvoZeus-factor-lab/templates/scanner-submission.md`。

## 边界

- 不要把可执行 scanner 或 pack 代码放入主 Repo。
- 不要将 lab 复核视为 official Release。
- 不要让 Runtime 消费 lab 的移动分支。
- 不要跳过 scanner 代码的安全复核。
