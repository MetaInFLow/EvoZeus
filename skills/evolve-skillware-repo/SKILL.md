---
name: evolve-skillware-repo
description: Use when 用户要求为 Skill、插件或 Skillware 代码库接入、检查、升级或修复 EvoZeus CoEvolve 时使用。确保只有独立 Git Repo 根目录可以拥有 Harness。
---

# 进化 Skillware Repo

## 确定治理单元

1. 确定目标的 Git 根目录。
2. 如果目标是该 Repo 内的 Skill、package、pack 或 app，将 Git 根目录作为进化目标。
3. 如果不存在 Git 根目录，提供计划并说明：目标成为独立 Repo 前，无法接入 Harness。
4. 检查唯一允许的根级 Harness：`.evozeus-wrapper/`。
5. 将 `.evozeus_evoinfra/` 视为迁移信号，不要将其作为新的安装目标。

## 模式

| 请求 | 动作 |
| --- | --- |
| 检查/状态 | 只读诊断 |
| 接入 | 生成精确的根级 Harness 计划；获得确认后才写入 |
| 升级 | 验证维护者权限、当前/目标版本、迁移和测试 |
| 全部升级 | 盘点已注册的独立 Repo；普通用户获得计划，获授权的维护者可以为每个 Repo 创建 PR |

Harness 升级和推送需要已验证的目标 Repo `ADMIN` 权限以及维护者策略授权。UAT 变更只更新该 Repo 的单一 UAT 候选；stable 发布使用已验证的 UAT Commit。

## 输出

版本决策使用以下生命周期标签：

```text
🧭 EvoZeus · 版本状态｜<repo> · <stable|uat|development> · <current → target>
```

授权编辑开始后，使用 `🛠️ EvoZeus · 进化中`。只有唯一 UAT 候选通过全部门禁后，才使用 `🧪 EvoZeus · UAT 就绪`；只有 Stable Release 已存在后，才使用 `🚀 EvoZeus · 已发布`。

## 验证目标

- 目标是独立 Git Repo 根目录。
- 不存在嵌套 Harness。
- 已知当前版本和目标版本的精确值。
- PR 或 UAT 晋级前，升级验证已通过。
- 修复 UAT 时 Stable 未被修改。
