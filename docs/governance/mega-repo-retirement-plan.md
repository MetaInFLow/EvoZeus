# EvoZeus Mega Repo 退役执行方案

- 状态：执行中
- 日期：2026-07-30
- Owner：Anthony.F / MetaInFlow
- 决策记录：[`ADR-0004`](../decisions/ADR-0004-retire-mega-repo.md)
- 新事实源：[`repository-topology.md`](repository-topology.md)

## 1. 目标

退役 `MetaInFLow/EvoZeus-MegaRepo` 的 active coordination 职责，把跨组件架构、Repo 拓扑和发布治理统一收回 `MetaInFLow/EvoZeus`。旧仓库保留只读历史，停止维护 submodule、组件版本和第二套 Repo Index。

完成后必须满足：

1. `EvoZeus` 主仓库是产品、频道、拓扑、ADR 和治理的唯一持续维护入口。
2. 各组件仓库只维护自身实现、测试、版本和 Release。
3. Stable/UAT 事实只来自产品清单与本地 `version --json`。
4. Mega Repo 无 gitlink、无活动校验依赖、无新增资料入口。
5. 历史资料仍可查阅，GitHub 仓库明确标记为 archived。

## 2. 资产处理

| Mega Repo 内容 | 处理方式 | 新事实源 |
| --- | --- | --- |
| Repo Index、整体拓扑、组件职责 | 提炼并迁移 | `docs/governance/repository-topology.md` |
| 跨 Repo 决策 | 以后使用主仓库 ADR | `docs/decisions/` |
| Stable/UAT 规则 | 保留现有 ADR、Design 和 Release policy | `ADR-0003`、`design_doc-v0.4`、`release-and-promotion-policy.md` |
| 开发与贡献规则 | 使用主仓库现有治理文档 | `CONTRIBUTING.md`、`docs/governance/` |
| Submodule/gitlink | 删除 | 本地 clone/worktree，自身不构成产品事实 |
| 历史方案、交付报告、教程 | 留在归档仓库 | 只读历史，不再更新 |
| `20-materials/`、运行报告、私密上下文 | 不迁移 | 私有系统或本地归档 |

## 3. 执行切片

### Slice A：建立新事实源

- 新增 `ADR-0004`。
- 新增 Repo 拓扑与组件进化机制。
- 修正 `ADR-0003` 和版本频道 Design 对 Mega Repo 的依赖。
- 在 README 与 Docs 首页增加新入口。

验证：主仓库 PR readiness、文档链接、GitHub gates 全部通过。

### Slice B：冻结 Mega Repo

- 新增 `ARCHIVED.md`。
- README 改为归档入口。
- AGENTS 改为只读历史约束。
- 删除 `.gitmodules` 与全部 gitlink。
- 将旧 Skill 集群校验替换为归档契约校验。

验证：归档校验通过；仓库不再依赖组件 checkout。

### Slice C：切换并归档

- 主仓库迁移 PR 先合并。
- Mega Repo 归档 PR 后合并。
- 更新 GitHub description/homepage。
- 设置 GitHub `archived=true`。
- 最后复核主仓库文档、Mega Repo archive 状态和本地产品健康。

## 4. 非目标

- 不删除历史 Git 记录。
- 不迁移 raw session、客户资料、secret 或未脱敏 evidence。
- 不合并各组件源码到单体仓库。
- 不改变 Stable/UAT 用户频道。
- 不重写组件实现、版本或 Release。
- 不清理用户现有脏工作区。

## 5. 回滚

归档前可直接回退两个迁移 PR。归档后仍可由 GitHub Admin 取消 archive，再回退提交。历史内容和 tag 始终保留；组件仓库与用户安装不依赖 Mega Repo，因此退役失败不会影响 Stable/UAT 运行。

## 6. 验收标准

- [ ] 主仓库包含唯一 Repo 拓扑和退役 ADR。
- [ ] 主仓库无活动文档依赖 Mega Repo 才能解释版本频道。
- [ ] Mega Repo README 与 GitHub description 均显示 archived。
- [ ] Mega Repo 无 `.gitmodules` 和 gitlink。
- [ ] Mega Repo 归档校验不访问组件源码。
- [ ] 两个迁移 PR 的 CI/门禁通过并合并。
- [ ] GitHub Repo `archived=true`。
- [ ] `evozeus version --json` 与 `doctor --json` 仍健康。

## 7. 执行记录

执行完成后回填主仓库 PR、Mega Repo PR、merge commit、归档时间和最终验证结果。
