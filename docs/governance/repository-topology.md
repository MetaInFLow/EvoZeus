# EvoZeus Repo 拓扑与进化责任

- 状态：canonical
- 生效日期：2026-07-30
- Owner：MetaInFlow / EvoZeus maintainers

本文是 EvoZeus 活跃 Repo、职责和进化路径的唯一持续维护事实源。版本事实以 Stable/UAT 产品清单为准；组件实现事实以各组件默认分支和 Release 为准。

## 1. 活跃拓扑

| Repo | 可见性 | 职责 | 进化入口 | 正式化机制 |
| --- | --- | --- | --- | --- |
| `MetaInFLow/EvoZeus` | public | 产品控制、协议、Skill、频道、ADR、治理 | Session/Issue/Candidate/治理需求 | PR 门禁 → 唯一 UAT → 产品 Release |
| `MetaInFLow/EvoZeus-CoEvolve` | public | Lesson intake、目标 Skill 生命周期、Harness | 普通 Chat watcher、Feedback Issue、维护需求 | Design/PR/CHANGELOG → UAT → CoEvolve Release |
| `MetaInFLow/EvoZeus-infra` | public | Scanner、Runner、Ledger、Report、Runtime | Runtime Bug、能力需求、安全 Review | 代码 PR/CI → UAT → 带 checksum 的 Release |
| `MetaInFLow/EvoZeus-session-signal-skill` | public | Session Signal 方法和 official Factor tools | Review 偏差、Factor 候选 | `FACTOR.xml`/代码/测试 → UAT → Release |
| `MetaInFLow/EvoZeus-web` | private source / public deployment | 官网、`/skill`、安装交接 | 产品内容或入口需求 | 私有 PR → test/build → Vercel deployment |

`EvoZeus` 产品清单聚合前四个可安装组件。Web 使用部署元数据对账，不进入本地 Runtime 安装。

## 2. 退役与历史 Repo

| Repo | 状态 | 说明 |
| --- | --- | --- |
| `MetaInFLow/EvoZeus-MegaRepo` | archived | 历史跨 Repo 方案、教程、交付记录；不再是事实源 |
| `MetaInFLow/EvoZeus-factor-lab` | archived/private | 历史 Factor contract 实验；不接收新贡献 |
| `MetaInFLow/EvoZeus-wrapper` | retired | 已由 `EvoZeus-CoEvolve` 接管；只用于旧安装迁移识别 |

## 3. 唯一事实源顺序

1. 用户运行版本：`~/.evozeus/bin/evozeus version --json`。
2. Stable：EvoZeus GitHub Release 中的 `evozeus-product-stable.json`。
3. UAT：EvoZeus 唯一 `uat/current` 中的 `channels/uat.json`。
4. 组件实现：组件 Repo exact Commit、CI 和 Release。
5. 架构与治理：EvoZeus `docs/decisions/`、`docs/governance/` 和 active Design Doc。

本地多仓 clone、worktree、编辑器 workspace 和历史 Mega Repo 均为开发便利层，不声明用户版本。

## 4. 变更路由

```text
产品/协议/治理           -> EvoZeus
Lesson/Harness/Skill生命周期 -> EvoZeus-CoEvolve
Runtime/Scanner/Ledger   -> EvoZeus-infra
Session Signal/Factor tool -> EvoZeus-session-signal-skill
官网与安装交接           -> EvoZeus-web
```

跨组件变更由 EvoZeus ADR 和产品清单协调。组件 PR 先各自验证，再更新唯一 UAT；正式发布固定相同的已验证 Commit，不通过额外协调仓库中转。

## 5. 开发工作区

开发者可在任意本地目录并列 clone 多个 Repo，或使用独立 worktree。禁止通过父仓库 gitlink表达组件当前版本；禁止把客户资料、raw session、secret 或未脱敏 evidence 放入公共 Repo。
