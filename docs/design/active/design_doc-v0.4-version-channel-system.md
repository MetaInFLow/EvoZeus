# Design Doc v0.4：Stable 与唯一 UAT 版本渠道系统

- Status: active
- Date: 2026-07-26
- Owner: Anthony.F / MetaInFlow
- Linked ADR: [`../../decisions/ADR-0003-stable-single-uat-channel-model.md`](../../decisions/ADR-0003-stable-single-uat-channel-model.md)
- Cross-repo plan: `EvoZeus-MegaRepo/00-global/evozeus-version-channel-execution-plan.md`

## 1. Goal

让正式用户与测试用户从同一个 EvoZeus 入口获得可识别、可验证、可更新、可回滚的产品安装：正式用户只运行不可变 Release；测试用户运行唯一、可覆盖更新的 UAT。

## 2. PSPS

| Persona | Scenario | Pain | Solution Surface |
| --- | --- | --- | --- |
| 正式用户 | 安装、运行或更新 EvoZeus | 无法判断本地代码是否来自正式 Release | Stable 产品清单、版本命令、只读更新检查、批准后覆盖更新 |
| UAT 用户 | 发现 Bug 后继续测试修复版 | 修复可能产生多个测试版本或污染正式环境 | 唯一 `uat`、隔离 worktree、独立 state、事务刷新 |
| Maintainer | 跨 Repo 发布产品 | 各组件版本、Commit、部署和本地安装无法统一对账 | EvoZeus 产品清单、组件门禁、发布证据 |
| Agent | 运行前检查环境 | Doctor 只检查文件存在，无法识别版本漂移 | 渠道状态、清单摘要、组件健康与 Legacy 诊断 |

## 3. Scope

- 产品清单 Schema 与解析。
- `stable`、唯一 `uat` 和诊断态 `legacy`。
- `version`、`channel status/use`、`update`、`doctor`。
- Stable Release 安装和 UAT Git worktree 事务更新。
- Stable / UAT Runtime state 隔离。
- 旧 install manifest 和 CoEvolve dispatcher 状态诊断、备份与迁移。
- 组件路径从渠道状态解析，环境变量只作为显式开发覆盖。

## 4. Non-goals

- 多 UAT 渠道。
- Stable 静默自动更新。
- 完整 TUI 或桌面更新器。
- Factor 算法和 Session Signal 判断逻辑修改。
- 自动执行目标 Repo 提供的任意脚本。

## 5. Owning Layer

| Concern | Owner |
| --- | --- |
| 产品渠道、清单解析、安装、更新、激活、Doctor、回滚 | EvoZeus |
| Runtime 执行、状态目录使用、组件运行健康 | EvoZeus-infra |
| CoEvolve contract / harness / target lifecycle | EvoZeus-CoEvolve |
| Session Signal方法和official factor tools | EvoZeus-session-signal-skill |
| 公开入口和部署版本展示 | EvoZeus-web |

组件 Repo 提供自身版本和固定验证入口。EvoZeus 聚合这些事实，不复制组件领域逻辑。

## 6. Product Manifest

Schema事实源：`schemas/product-channel-manifest.schema.json`。

每个组件必须声明：

- SemVer版本。
- 完整Git Commit。
- 来源类型、URL和Ref。
- 必需文件。
- Stable Release archive的SHA-256；UAT由Git Commit提供内容固定性。

Stable清单作为EvoZeus Release资产发布。UAT清单从唯一`uat/current`解析。UAT清单中的EvoZeus Commit固定为清单发布前的代码Commit；清单提交只更新渠道指针，运行代码仍检出固定Commit。

## 7. Local State

```text
~/.evozeus/
├── active-channel.json
├── channel-state.json
├── releases/stable/<product-version>/
├── worktrees/uat/versions/<manifest-digest>/
├── worktrees/uat/current -> versions/<manifest-digest>
├── state/stable/
├── state/uat/
├── backups/channel-migrations/
└── bin/evozeus
```

`active-channel.json`只允许`stable|uat`。`legacy`只用于Doctor诊断，不能被激活。

`channel-state.json`记录：

- 每个渠道当前manifest、digest、安装根目录和上一个可回滚版本。
- 最近成功/失败事务。
- UAT运行前自动刷新是否已由用户授权。

## 8. Component Resolution

解析优先级：

1. 已激活渠道的`channel-state.json`组件路径。
2. 显式环境变量，例如`EVOZEUS_INFRA_ROOT`。
3. 开发态兄弟Repo探测，仅作兼容fallback并标记`source=development_fallback`。

正式与UAT健康判定不得依赖兄弟目录fallback。

## 9. Update Transactions

### 9.1 Stable

1. 获取最新正式Release清单。
2. Schema、渠道、Commit、archive checksum和必需文件预检。
3. 下载到事务目录并解包。
4. 固定smoke验证。
5. 原子更新Stable current state。
6. 用户批准后激活；运行内只返回`update_available`。

### 9.2 UAT

1. 获取唯一UAT清单。
2. 为各组件准备Git mirror/cache并检出固定Commit到事务目录。
3. 检查Commit、必需文件和固定smoke。
4. 原子切换`worktrees/uat/current`和UAT channel state。
5. 任一步失败时清理事务目录，保留旧current和旧state。

临时事务目录不进入用户渠道列表。

## 10. Permission Model

- `version`、`channel status`、`doctor`：只读。
- `update --dry-run`：只读网络检查或显式本地manifest检查。
- `update --approve-write`：写`~/.evozeus`，需要用户明确批准。
- `channel use`：默认plan；`--approve-write`后更新active channel。
- UAT自动刷新：加入UAT时单独保存`auto_refresh=true`授权。
- Stable始终禁止运行内自动写入。

## 11. Legacy Migration

识别条件：

- install manifest没有channel或exact release tag。
- Core来自未发布Commit。
- dispatcher来源为旧Repo、临时目录或无法验证路径。
- 已安装CLI缺少正式文档声明命令。

迁移先把`install-manifest.json`、`hooks/state.json`和相关dispatcher复制到`backups/channel-migrations/<timestamp>/`，再安装目标渠道。UAT覆盖更新和显式渠道切换都必须核对dispatcher是否缺失、仍为旧来源或版本不匹配，并自动修复到当前渠道。失败时恢复原文件、活动渠道和上一版已验证UAT。

## 12. CLI Contract

```text
evozeus version --json
evozeus channel status --json
evozeus channel use stable|uat [--approve-write] [--auto-refresh]
evozeus channel rollback stable|uat [--approve-write]
evozeus update --channel stable|uat --dry-run --json
evozeus update --channel stable|uat --manifest <path-or-url> --approve-write --json
evozeus doctor --json
```

所有JSON输出沿用EvoZeus envelope并增加：

- `active_channel`
- `product_version`
- `manifest_digest`
- `components`
- `health`
- `update_available`
- `rollback`

## 13. Failure Semantics

| Failure | Result |
| --- | --- |
| Manifest schema/channel错误 | 拒绝写入 |
| Commit不可获取 | 保留旧渠道 |
| Stable checksum错误 | 删除staging，保留旧Stable |
| 必需文件缺失 | 拒绝切换 |
| current指针切换失败 | 恢复旧指针和state |
| Legacy备份失败 | 禁止迁移 |
| 网络不可用 | Stable/UAT继续运行已安装版本 |

## 14. Validation

- Schema正例：Stable与UAT各一份。
- Schema反例：未知渠道、短Commit、Stable缺checksum、额外字段。
- CLI：version、status、use、dry-run、apply、Legacy、Mixed、Unsupported。
- UAT：首次安装、覆盖更新、重复执行、错误Commit、缺文件、切换失败和回滚。
- Stable：Release archive安装、checksum失败、运行内只提示。
- Doctor：当前真实Legacy样本必须返回`migration_required`。
- E2E：Stable和UAT同时存在，互不修改对方state。

## 15. Rollback

- Active channel保留旧值直到新渠道验证完成。
- 每个渠道state保留`previous`安装根和manifest digest。
- `channel rollback --approve-write`恢复上一成功版本；首版可由`update`结果提供等价恢复命令。
- Legacy迁移使用备份目录恢复原manifest和dispatcher。

## 16. Completion Gate

完成标准以Mega Repo方案中的V1-V8为准。代码合并、Release、部署和线上对账均属于完成条件。
