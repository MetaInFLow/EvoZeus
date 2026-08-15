---
name: evozeus-maintainer-skill-index
description: Use when EvoZeus 维护者在用户任务已经明确后，需要路由 Repo 开发、治理、贡献、Factor、Runtime、Release、诊断、脱敏或指令变更时使用。
---

# EvoZeus 维护者 Skill 索引

此目录不属于默认用户插件表面。用户任务从 [`../../../skills/using-evozeus/SKILL.md`](../../../skills/using-evozeus/SKILL.md) 开始。

## 路由

| 维护者任务 | 下一步读取 |
| --- | --- |
| Repo 代码、文档、架构、CI、插件或产品行为 | `../evozeus-development/SKILL.md` |
| 面向用户的 Skill、prompt 或指令变更 | `../evozeus-skill-proposal/SKILL.md` 以及 Development |
| Case、Candidate 或公开贡献 | `../evozeus-community-contribution/SKILL.md` |
| 保存已确认的 Verdict | `../evozeus-artifact-preservation/SKILL.md` |
| Evidence Report 或 Verdict Card 格式 | `../evozeus-reporting/SKILL.md` |
| Runtime 执行、scanner、本地 ledger 或报告生成 | `../evozeus-runtime-routing/SKILL.md` |
| Factor 语义 | `../evozeus-factor-authoring/SKILL.md` |
| 可执行 Factor pack 或 scanner | `../evozeus-scanner-pack-authoring/SKILL.md` |
| Registry、兼容性、deprecation 或 Release 元数据 | `../evozeus-registry-release/SKILL.md` |
| 公开证据和隐私 | `../evozeus-redaction/SKILL.md` |
| 失败或环境诊断 | `../evozeus-doctor-debugging/SKILL.md` |
| 历史安装迁移 | `../evozeus-install-registration/SKILL.md` |

## 架构边界

- EvoZeus 主 Repo 负责插件、CLI、Runtime、内置 Session Signal、Stable/UAT 和产品治理。
- CoEvolve 负责独立 Skillware Repo 的通用进化契约和 Harness SDK。
- 只有独立 Git Repo 根目录可以拥有 Harness。
- `packages/runtime/`、`packs/session-signal/`、`skills/` 和 `maintainer/skills/` 继承 EvoZeus 根 Harness。
- 公开写入需要脱敏和用户授权；Harness 升级还需要已验证的目标 Repo `ADMIN` 权限。

## 必要检查

遵循 [`../../../docs/governance/pr-guidelines.md`](../../../docs/governance/pr-guidelines.md)，并运行变更表面要求的测试。跨层迁移使用：

```bash
python3 scripts/check_pr_ready.py --allow-cross-layer
npm test
npm run test:python
git diff --check
```
