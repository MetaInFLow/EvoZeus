---
name: evozeus
description: Use when 用户从旧版安装调用历史 EvoZeus 根 Skill 时使用；立即转入插件的 using-evozeus Skill。
---

# EvoZeus 兼容入口

此根 Skill 仅用于一个兼容周期。当前用户入口是 [`skills/using-evozeus/SKILL.md`](skills/using-evozeus/SKILL.md)。

调用此 Skill 时：

1. 完整读取 `skills/using-evozeus/SKILL.md`。
2. 遵循其中的路由、标签、隐私、确认和完成规则。
3. 在理解用户任务前，不要要求用户运行 `features --json` 或 `capabilities --json`。
4. 除非用户询问架构或维护，否则不要暴露内部 Repo 拓扑。
5. 没有所选路由要求的权限时，不要创建 Issue、PR、本地文件、Harness，也不要执行网络写入。

仅供维护者使用的指令已移至 `maintainer/skills/`，不属于默认用户插件表面。
