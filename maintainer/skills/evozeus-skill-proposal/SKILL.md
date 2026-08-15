---
name: evozeus-skill-proposal
description: Use when 提议、修改、晋级、拒绝或复核 EvoZeus Skill、场景 Skill、prompt 或面向 Agent 的指令时使用。
---

# EvoZeus Skill 提案

Skill 变更会改变 Agent 行为，应按治理风险工作处理，不能当作普通文档润色。

## Skill 的适用条件

重复证据显示以下情况时，才提议 Skill：

- Agent 在压力下反复失败于同一工作流
- 修复需要判断，不能只靠脚本或 regex
- 模式适用于一场私密会话之外的场景
- 公开指令可以在不泄露私密上下文的情况下编写
- 成功和拒绝标准清楚

一次性结果、泛化建议或应由代码强制的行为，不创建 Skill。

## 提案结构

包含：

- 触发条件
- 失败证据
- 期望行为
- 非目标
- 安全边界
- 相关 ontology 术语
- 公开/私密证据状态
- 回滚或 deprecation 路径

创建 PR 时使用 `../../../.github/PULL_REQUEST_TEMPLATE/skill_instruction_change.md`。

## 编辑已有 Skill

- 保持根 `../../../SKILL.md` 为稳定的会话判断入口。
- 将场景专属规则放在 `../` 下。
- description 只写触发条件；不要在 frontmatter 中总结整个工作流。
- 复用 `../../../docs/governance/terminology-glossary.md` 中的项目术语。
- 复核前从 Repo 根目录运行 `python3 scripts/check_pr_ready.py --base <base-ref>`。
