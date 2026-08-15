---
name: maintain-evozeus
description: Use when 用户要求安装 EvoZeus、对齐本地组件、检查版本、在 stable 与单一 UAT 之间切换、更新、运行 Doctor、回滚、晋级 UAT 或诊断旧安装时使用。
---

# 维护 EvoZeus

## 用户可见模型

- `stable`：正式且不可变的发布版本。
- `uat`：一个可变的测试候选。UAT 缺陷修复会替换这个候选。
- `development`：维护者工作树或分支，永远不作为用户版本展示。

Stable 和 UAT 都是质量订阅。两者都会自动检查更新；自动更新只在用户选定的频道内进行，不会切换用户订阅。

Runtime 和 Session Signal 内置于 EvoZeus，并与 EvoZeus 共用版本。CoEvolve 是唯一可选的独立组件，拥有自己的版本和 Harness。

## 安装步骤 0

每次安装、加入、恢复或询问“EvoZeus 是否已安装”时，读取 `../../docs/reference/install-preflight.md`，并在 Release 解析、产品下载、确认或对齐前识别本地状态。

1. 检查 `EVOZEUS_HOME`（默认 `~/.evozeus`）、`bin/evozeus`、`active-channel.json`、`channel-state.json` 和旧版标记。
2. 已安装 CLI 存在时，设置 `EVOZEUS_AUTO_UPDATE=0` 和 `EVOZEUS_AUTO_UPDATE_CHILD=1`，然后在任何 launcher 刷新前直接运行 `version --json` 和 `doctor --json` 检查。
3. 使用无 payload 的 Stable HEAD 区分 `healthy_current` 和 `update_available`。
4. 只返回一个状态：`not_installed`、`healthy_current`、`update_available`、`repair_required`、`legacy_migration_required` 或 `unknown_or_unverifiable`。
5. 证据未知时停止。`healthy_current` 必须返回严格的零下载、零写入、零注册 no-op。
6. 只有 `not_installed` 可以进入全新安装。运行 inline pre-fetch gate，验证独立 checker 的 checksum，然后在任何产品资源下载或 `~/.evozeus` 写入前要求 schema 有效的完整 Stable preflight。

对于已安装或可信的本地 checker，完整 preflight 命令是 `evozeus install preflight --channel stable --json`。从 Release 获取的 checker 必须通过 `--checker-asset-get-count 2` 报告 checker 和 checksum GET。Preflight v1 拒绝 UAT；Stable 健康后，UAT 从已安装的 UAT manifest 源解析，并使用频道对齐流程。

## 一条命令完成对齐

优先使用一个产品操作完成选定频道解析、受管路径校验、事务式更新和 Doctor 检查，并仅在检查通过后切换活动指针。不要要求用户手动更新各个 Repo。

规范命令是：

```text
evozeus align --channel <stable|uat> --host auto --approve-write --json
```

它必须同时对齐 Runtime 和唯一活动的 Codex/Claude 插件。Host 注册失败且存在回滚目标时，恢复此前已验证的频道。

写入前报告：

```text
🧭 EvoZeus · 版本状态｜当前 <channel/version> → 目标 <channel/version>
```

安装确认会创建 `~/.evozeus/update-policy.json`，并为两个频道启用已验证的自动更新。切换频道、回滚、修改策略或替换无关受管文件时，分别询问用户。只读的 `version`、`status` 和 Doctor 检查可以直接运行。

## 自动更新契约

- 在 Claude SessionStart 以及每次 EvoZeus 或 CoEvolve 受管入口运行时检查。
- 默认使用一小时 freshness window，避免重复网络请求。
- 将 EvoZeus Core、活动 Plugin、Runtime、Session Signal 和固定版本的 CoEvolve 作为一个事务更新。
- 切换活动指针前验证新产品；失败时恢复此前已验证的产品。
- 只有状态发生变化时，才显示 `🧭 EvoZeus · 发现更新`、`🛠️ EvoZeus · 自动更新中` 以及一个完成或失败标记。
- 已安装产品为当前版本时保持安静。
- 遵守 `~/.evozeus/update-policy.json` 中的 `enabled`、各频道开关和 interval；切换失败后的回滚是不可配置的安全不变量。

## 晋级

只有获授权的 Release administrator 才能将唯一已验证的 UAT Commit 晋级为 stable。晋级过程不得重新构建不同的源代码。

## 历史安装

旧版根 Skill 会路由到 `using-evozeus`，其第一个动作是运行已安装的 launcher。已发布的 bootstrap 通过选定的产品 manifest 自我升级，然后刷新 Plugin 和内置表面。在频道 launcher 出现前安装的旧版本，会持续提供迁移提示，直到用户完成一次已确认的对齐。

Stable `v0.4.0` 及更早版本无法追溯获得此行为，因为其已安装 launcher 只检查 UAT。它们需要一次已确认的对齐以升级到 `v0.4.1+`；之后频道内的更新都会自动进行。启用了自动刷新的活动 `v0.4.0` UAT，可以直接从被覆盖的 `uat/current` 候选启动 bootstrap。

## 验证目标

- 活动频道和精确 Commit 可见。
- Stable 与 UAT 路径保持隔离。
- UAT 修复后仍只有一个用户可见的 UAT。
- 对齐后 Doctor 通过。
- 回滚目标仍然可用。
- 内部 Web 部署不会作为本地产品组件出现。
