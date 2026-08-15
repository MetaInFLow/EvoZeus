---
name: capture-evozeus-lesson
description: Use when 用户确认应记录一条 EvoZeus Lesson，或要求把已验证的改进保存为 Case、Skill 变更、规则、习惯、环境修复或其他可复用 Artifact 时使用。
---

# 捕捉 EvoZeus Lesson

## 确认记录内容

创建一条简洁且已脱敏的 Lesson，包含：

- 观察到的上下文；
- 证据；
- 可复用判断；
- 受影响的 Repo 或产品边界；
- 拟创建的 Artifact；
- 验证目标。

如果用户尚未确认记录，只询问一次：

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜<一句话摘要>。要记录下来吗？
```

## 路由

| Lesson 结果 | 路由 |
| --- | --- |
| EvoZeus 产品行为、协议、CLI、Runtime、内置 pack | EvoZeus 主 Repo |
| 通用 Harness 契约或独立 Repo 进化生命周期 | EvoZeus-CoEvolve |
| 目标 Skillware 行为 | 目标独立 Repo |
| 没有共享产品价值的个人习惯 | 仅本地记录 |

不要为 package、pack、Skill 目录或其他子目录创建 Harness。将 Lesson 路由到其所属的 Git Repo 根目录。

## 写入

用户确认记录 Lesson 只授权已约定的记录操作。如果用户尚未提出相关要求，创建 GitHub Issue/PR、代码变更、安装、发布或外部上传前要单独询问。

## 验证目标

- 不依赖原始私密上下文也能理解 Lesson。
- 证据与拟议行为清楚区分。
- 路由明确指向一个独立 Repo 或仅本地位置。
- Artifact 具有可衡量的验证目标。
