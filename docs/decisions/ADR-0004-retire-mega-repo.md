# ADR-0004：退役 EvoZeus Mega Repo

- Status: accepted
- Date: 2026-07-30
- Deciders: Anthony.F / MetaInFlow
- Execution Plan: [`../governance/mega-repo-retirement-plan.md`](../governance/mega-repo-retirement-plan.md)

## Context

Mega Repo 曾承担跨 Repo 方向、索引、submodule、资料和决策。产品频道系统上线后，版本与安装事实已由 EvoZeus 产品清单统一控制；组件职责也分别落在 CoEvolve、Infra、Session Signal 和 Web。Mega Repo 的 gitlink、Repo Index 和教程持续滞后，形成第二套事实源并增加维护成本。

## Decision

退役 `MetaInFLow/EvoZeus-MegaRepo` 的 active coordination 职责：

- `MetaInFLow/EvoZeus` 接管跨组件架构、Repo 拓扑、ADR 和发布治理。
- 各组件 Repo 继续独立维护实现、测试、版本和 Release。
- 本地多仓开发使用 clone/worktree，不通过公共父仓库 gitlink 管理。
- Mega Repo 保留只读历史，迁移完成后在 GitHub 设置为 archived。

## Consequences

正面：

- 用户、Agent 和维护者只需查一个治理事实源。
- 组件升级不再要求更新父仓库指针。
- 版本频道、Repo 职责和发布证据进入同一产品控制层。

代价：

- 历史链接仍指向归档仓库，需要通过归档 README 导航。
- 跨 Repo 文档变更需要进入 EvoZeus 主仓库治理 PR。

## Validation

- 主仓库提供 canonical Repo 拓扑。
- Mega Repo 无 submodule 和 active validation dependency。
- GitHub archive 状态可验证。
- Stable/UAT 安装和运行健康不受影响。
