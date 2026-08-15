---
name: evozeus-start-here-onboarding
description: Use when 用户完成 EvoZeus 注册和安装，首次开始仅协议层 EvoZeus 判断时使用。
---

# EvoZeus 从这里开始：首次引导

Start Here 是注册和安装后的首次仅协议层判断。它不会注册 workspace、安装 Skill、静默安装 Runtime、扫描文件、写入本地状态或创建 GitHub Artifact。

## 入口流程

```text
community /skill
  -> EvoZeus 安装与注册完成
  -> 用户确认仅协议层判断
  -> 读取根 SKILL.md
  -> 输出初始 Session Verdict Card
  -> 启用 Runtime 或保存 Artifact 前先询问
```

## 首轮处理

首轮处理时：

- 读取根 `../../../SKILL.md`
- 将原始会话保留在本地
- 在回复中生成 Session Verdict Card
- 除非用户要求，否则不写入文件
- 不执行 Runtime、scanner、Factor 安装、网络、GitHub 或外部上传

## 可选后续路由

| 用户要求 | 下一步读取 |
| --- | --- |
| 安装、注册、校准 `~/.evozeus`、补齐缺失 Skill | `../evozeus-install-registration/SKILL.md` |
| 本地扫描、Runtime、默认 official Factor、报告生成 | `../evozeus-runtime-routing/SKILL.md` |
| 保存当前结果、创建 Case/Candidate/Artifact | `../evozeus-artifact-preservation/SKILL.md` |
| 公开 issue、PR、示例或贡献 | 先读 `../evozeus-redaction/SKILL.md`，再读 `../evozeus-community-contribution/SKILL.md` |
| Repo 文档、治理、schema 或 Skill 编辑 | `../evozeus-development/SKILL.md` |

## 边界

- 引导期间不要写入 `~/.evozeus/` 状态。
- 引导期间不要安装 EvoZeus skeleton 或 Skill。
- 没有用户确认，不要安装或启用默认 Factor。
- 没有用户确认，不要创建 GitHub issue 或 PR。
- 不要把引导扩展为 Runtime 实现工作。
