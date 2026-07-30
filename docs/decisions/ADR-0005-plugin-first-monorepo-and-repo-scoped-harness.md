# ADR-0005：EvoZeus 采用插件入口、主仓内聚与 Repo 级 Harness

- Status: accepted
- Date: 2026-07-30
- Deciders: Anthony.F / MetaInFlow
- Linked Design Doc: [`../design/active/design_doc-v0.5-plugin-monorepo.md`](../design/active/design_doc-v0.5-plugin-monorepo.md)
- Harness Policy: [`../governance/harness-boundary-policy.md`](../governance/harness-boundary-policy.md)

## Context

EvoZeus 当前同时存在根 `SKILL.md`、14 个场景 Skill、CLI feature router、capability router 和四组件产品清单。用户需要先理解安装器、组件版本、Runtime、Factor、Harness 和频道，才能完成一次普通使用。Infra 与 Session Signal 以独立 Repo 发布，但它们只服务 EvoZeus 主产品，导致内部实现被暴露为用户产品矩阵。

Harness 也缺少明确治理边界。若 monorepo 内的 package、pack 或 Skill 都能携带独立 Harness，同一 Git 历史中会出现多套版本、反馈、迁移和发布事实源，无法可靠回答“当前哪个 Harness 生效”。

## Decision

### 1. 用户入口

- `MetaInFLow/EvoZeus` 是唯一用户可见主产品和控制面。
- EvoZeus 通过 Agent plugin 暴露能力；插件内只安装少量用户任务 Skill。
- 根 `SKILL.md` 保留一个兼容周期，只负责把旧调用路由到插件入口，不继续承载完整产品说明。
- CLI 负责可验证执行与版本管理；Skill 负责意图识别、解释和审批边界。

### 2. Repo 拓扑

- EvoZeus Runtime 迁入主仓 `packages/runtime/`，随主产品发布。
- Session Signal 迁入主仓 `packs/session-signal/`，作为内置官方判断包随主产品发布。
- `MetaInFLow/EvoZeus-CoEvolve` 保持独立 Repo，作为可单独接入任意 Skillware Repo 的进化扩展和 Harness SDK。
- `MetaInFLow/EvoZeus-web` 保持独立前端部署，不进入用户本地产品矩阵、插件组件清单或本地版本对齐。
- 旧 Infra 与 Session Signal Repo 仅在主仓 Stable/UAT 验证完成后归档。

### 3. Harness 边界

- 只有独立 Git Repo 可以拥有进化 Harness。
- 一个 Git Repo 最多拥有一个活动 Harness，且只能位于 Repo 根目录。
- monorepo 内的 package、pack、Skill、app 和其他子目录继承根 Repo Harness，禁止创建嵌套 Harness。
- 某个内部模块需要独立 Harness 时，必须先完成独立 Repo 的架构决策、所有权和发布边界，再接入 Harness。
- Harness 写入、升级和上传要求目标 GitHub Repo 已验证的 `ADMIN` 权限；只读诊断和 dry-run 计划无需管理员权限。
- 归档 Repo 不保留活动维护承诺；其 Harness 只作为历史记录。

### 4. 版本与频道

- 用户可见频道继续固定为 `stable` 与唯一 `uat`。
- 产品清单只对独立发布单元做跨 Repo 固定：EvoZeus 主产品与 CoEvolve 扩展。
- Runtime 与 Session Signal 的代码版本由 EvoZeus 主产品 Commit 和 Release 唯一确定，不再单独下载和对齐。

## Consequences

正面：

- 用户只需理解一个产品、一个插件入口和两个频道。
- 内部模块与产品版本原子发布，避免四组件漂移。
- CoEvolve 保留通用复用价值，可以服务 EvoZeus 之外的独立 Skillware Repo。
- Harness 的反馈、版本、UAT 和发布事实源与 Git Repo 一一对应。

代价：

- 频道安装器、Doctor、README 和测试需要从四组件模型迁移到主仓内聚模型。
- 旧根 Skill 与旧组件 Repo 需要一个受控兼容窗口。
- CoEvolve 与主仓之间必须维持明确、版本化的契约。

## Rejected Alternatives

### 所有组件继续独立 Repo

内部实现边界持续暴露给用户，安装与版本对齐成本不会下降。

### 每个 monorepo package 拥有独立 Harness

Git 变更、Issue、PR 和 Release 仍由根 Repo 统一承载，子 Harness 无法形成独立事实源。

### 将 CoEvolve 一并并入主仓

会损失其面向任意独立 Skillware Repo 的通用接入价值，并把进化 SDK 与 EvoZeus 产品发布强绑定。

## Validation

- Agent plugin 清单通过官方 validator。
- 默认安装只暴露精简的用户任务 Skill。
- `packages/runtime/` 与 `packs/session-signal/` 不含嵌套 Harness。
- CI 拒绝任何子目录中的 `.evozeus-wrapper/` 或 `.evozeus_evoinfra/`。
- 产品清单不再要求 Infra 与 Session Signal 独立下载。
- Stable 与唯一 UAT 均可完成安装、切换、Doctor、回滚和核心场景验证。
- `EvoZeus-web` 不出现在本地产品组件清单中。
