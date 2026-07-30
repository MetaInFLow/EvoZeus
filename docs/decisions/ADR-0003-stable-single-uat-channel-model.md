# ADR-0003：Stable与唯一UAT由EvoZeus统一控制

- Status: accepted
- Date: 2026-07-26
- Amended: 2026-07-31
- Deciders: Anthony.F / MetaInFlow
- Linked Design Doc: `docs/design/active/design_doc-v0.4-version-channel-system.md`

## Context

EvoZeus当前跨多个Repo交付。正式Release、UAT分支、Web部署、本地Core、Runtime和CoEvolve dispatcher存在独立版本状态，用户无法可靠判断自己使用的版本。UAT Bug修复还缺少“覆盖同一个测试候选”的系统约束。

## Options Considered

### 选项A：各Repo自行更新

- 优点：组件自治。
- 缺点：用户需要理解多个版本，无法完成原子更新和统一回滚。
- 退出成本：多个安装器和状态文件会持续存在。

### 选项B：每次UAT修复发布新的测试版本

- 优点：历史版本天然不可变。
- 缺点：用户会看到多个UAT，偏离单一测试候选的产品要求。
- 退出成本：需要清理测试标签、入口和本地副本。

### 选项C：EvoZeus统一控制Stable与唯一UAT

- 优点：一个入口、一个产品清单、一个活动UAT；支持隔离、事务更新和回滚。
- 缺点：Core需要承担跨组件编排，并维护产品清单发布门禁。
- 退出成本：未来可将清单解析抽为独立包，CLI契约保持兼容。

## Decision

选择选项C。

- 用户可见渠道固定为`stable|uat`。
- `stable`只解析不可变Release。
- `uat`持续覆盖唯一`uat/current`候选。
- `EvoZeus`拥有版本解析、安装、更新、Doctor和回滚。
- 组件Repo提供版本、Commit、安装物料和固定健康检查。
- Stable与UAT代码及Runtime state隔离。
- Stable 与 UAT 都在运行入口自动检查当前订阅渠道。
- 更新以 Core、活动 Plugin、Runtime、Session Signal 与 CoEvolve 的单一事务执行。
- 自动更新不切换 Stable/UAT 订阅；失败时保留上一验证版本。

## Consequences

正面：

- 用户能够明确识别正式/测试环境。
- UAT Bug修复不会制造第二个测试产品。
- 跨Repo更新可以先验证后切换。
- Doctor可以根据版本事实判断健康。
- 用户无需为每次同渠道更新重复运行对齐命令。

负面：

- Release流程必须生成产品清单并验证所有组件。
- Core渠道模块成为高风险维护面，需要完整事务测试。

中性：

- 组件继续保留自己的SemVer。
- 开发分支数量不受限制，用户渠道仍只有一个UAT。

## Validation

- `design_doc-v0.4-version-channel-system.md` 的完整渠道、事务、回滚和发布门禁全部通过。
- 任何出现第二个用户可见UAT的实现触发ADR重审。
- 任何 Stable 从可变分支获取安装物、自动切到 UAT，或越过失败回滚的行为触发 ADR 重审。
