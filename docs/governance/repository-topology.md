# EvoZeus Repo 拓扑与进化责任

- 状态：canonical
- 生效日期：2026-07-30
- Owner：MetaInFlow / EvoZeus maintainers
- 决策依据：[`ADR-0005`](../decisions/ADR-0005-plugin-first-monorepo-and-repo-scoped-harness.md)

本文是 EvoZeus 活跃 Repo、职责、版本边界和进化路径的唯一持续维护事实源。

## 1. 用户产品

用户只需要理解一个本地产品：`EvoZeus`。

```text
EvoZeus
├── Agent plugin 与用户任务 Skill
├── 产品 CLI、stable / 唯一 UAT、Doctor、回滚
├── 内置 Runtime
├── 内置 Session Signal pack
└── 可选 CoEvolve 独立扩展
```

`EvoZeus-web` 是独立前端部署，不属于用户本地产品矩阵，不参与本地版本对齐。

## 2. 活跃 Repo

| Repo | 生态位 | 用户关系 | Harness | 发布边界 |
| --- | --- | --- | --- | --- |
| `MetaInFLow/EvoZeus` | 主产品、插件、CLI、Runtime、内置判断包、频道和治理 | 默认安装和使用入口 | 允许一个根 Harness | PR 门禁 → 唯一 UAT → EvoZeus Release |
| `MetaInFLow/EvoZeus-CoEvolve` | 通用进化扩展与 Harness SDK | 按需接入独立 Skillware Repo | 允许一个根 Harness | 独立合同、PR、UAT 和 Release |
| `MetaInFLow/EvoZeus-web` | 官网和安装交接前端 | 浏览器入口；不安装到本地产品 | 可有自己的根 Harness | 私有 PR → test/build → deployment |

### 主仓内部模块

| 路径 | 职责 | 版本来源 | Harness |
| --- | --- | --- | --- |
| `packages/runtime/` | 本地证据处理、Runner、Ledger、Report | EvoZeus Commit / Release | 禁止；继承主仓根 Harness |
| `packs/session-signal/` | 官方 Session 判断规则和 Factor tools | EvoZeus Commit / Release | 禁止；继承主仓根 Harness |
| `plugin/skills/` | 默认用户任务 Skill | EvoZeus Commit / Release | 禁止；继承主仓根 Harness |

## 3. 待退役与历史 Repo

| Repo | 状态 | 退出条件 |
| --- | --- | --- |
| `MetaInFLow/EvoZeus-infra` | migration source / 待退役 | Runtime 已进入主仓，唯一 UAT 与 Stable 验证完成 |
| `MetaInFLow/EvoZeus-session-signal-skill` | migration source / 待退役 | Session Signal 已进入主仓，唯一 UAT 与 Stable 验证完成 |
| `MetaInFLow/EvoZeus-MegaRepo` | archived | 已完成；只保留历史 |
| `MetaInFLow/EvoZeus-factor-lab` | archived/private | 历史实验，不接收新贡献 |
| `MetaInFLow/EvoZeus-wrapper` | retired | 已由 CoEvolve 接管，只用于旧安装迁移识别 |

旧 Infra 与 Session Signal Repo 在退出条件满足前保持可读和可回滚，不继续增加独立产品能力。

## 4. 唯一事实源顺序

1. 用户运行版本：`~/.evozeus/bin/evozeus version --json`。
2. Stable：EvoZeus GitHub Release 中的产品清单。
3. UAT：EvoZeus 唯一 `uat/current` 中的 `channels/uat.json`。
4. 主产品实现：EvoZeus exact Commit、CI 和 Release。
5. CoEvolve 实现：CoEvolve exact Commit、合同、CI 和 Release。
6. 架构与治理：EvoZeus `docs/decisions/`、`docs/governance/` 和 active Design Doc。

本地多仓 clone、worktree、编辑器 workspace、旧组件 Release 和历史 Mega Repo 均不声明当前用户产品版本。

## 5. 变更路由

```text
插件 / CLI / Runtime / Session Signal / 产品治理 -> EvoZeus
独立 Repo 的 Lesson / Harness / Skill 生命周期 -> EvoZeus-CoEvolve
官网与安装交接前端                         -> EvoZeus-web
```

涉及主仓内部模块的变更统一进入 EvoZeus PR 和唯一 UAT。涉及通用 Harness 合同的变更进入 CoEvolve，并由 EvoZeus 按合同版本集成。

## 6. Harness 路由

- 主仓所有内部路径共享 EvoZeus 根 Harness。
- CoEvolve 作为独立 Repo 使用自己的根 Harness。
- Web 如启用进化，使用自己的根 Harness；Web 仍不进入本地产品矩阵。
- 待退役 Repo 不接受新的 Harness 能力或自动升级。
- 任何内部模块请求独立 Harness，先提交拆 Repo ADR。

完整规则见 [`harness-boundary-policy.md`](harness-boundary-policy.md)。

## 7. 开发工作区

开发者使用独立任务 branch 或 worktree。禁止通过父仓库 gitlink 表达用户产品版本；禁止把客户资料、raw session、secret 或未脱敏 evidence 放入公共 Repo。
