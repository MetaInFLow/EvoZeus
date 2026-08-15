---
name: evozeus-runtime-internal
description: Use when 设计、实现、复核或调试 EvoZeus 本地 scanner、SessionEnvelope、Factor runner、本地 ledger、报告生成、权限门、manifest 校验或 FactorPack 执行时使用。
---

# EvoZeus Runtime（内部）

此 package 是 EvoZeus 内置的 Python scanner 和 runner。它继承 EvoZeus Git Repo 根目录的产品版本、UAT、Release、Issue、PR 和 Harness 治理。

## 组件角色

```text
local session source
  -> scanner adapter
  -> SessionEnvelope
  -> selected FactorPack
  -> FactorRunner
  -> local ledger
  -> local report
```

## Runtime 执行前

识别并在需要时确认：

- 要读取的文件和目录
- 要写入的文件和本地状态
- 要读取的环境变量
- 要运行的外部命令
- 网络访问（如有）
- 选定的 scanner
- 选定的 Factor
- 回滚和清理路径

默认行为是 local-first、关闭上传、关闭网络、关闭外部命令，并显式选择 Factor。

## 依赖引导

Runtime 任务开始前先确认依赖是否已经安装。尤其是 Graph ledger / GraphQLite 迁移、cohort、cluster 相关任务，必须先安装 graph extra：

```bash
python -m pip install -e '.[graph]'
```

如果本轮还需要运行测试，安装 dev + graph：

```bash
python -m pip install -e '.[dev,graph]'
```

安装后至少验证一次：

```bash
python - <<'PY'
import graphqlite
print("graphqlite ok")
PY
```

Graph ledger 分支运行时 hard require `graphqlite`。正式迁移或 CLI Runtime 不允许 silent fallback 到 legacy SQLite；`--sqlite-test-backend` 只能用于 repository tests / migration tests。

## 架构规则

- Scanner 使用 Abstract Base Class + Adapter + Registry。每个本地应用或 session provider 必须实现独立 scanner adapter。
- Scanner 的 `scan` 阶段只记录 `session_id` 和 `message_id`，不得写入 message content、tool output 或 preview。
- Scanner 的 `load` 阶段才 materialize `SessionEnvelope`，必须通过 event generator 渐进读取，只供选定的 Factor Runtime 使用。
- SQLite `session_events` 在 scan 后是 message id index，用于关联后续 Factor evidence、tags、results。
- P0 内置 scanner 是 `CodexScanner`；未来的 provider adapter 通过 scanner registry 注册，不要在 use case 内部分支处理。
- Factor 使用 Abstract Base Class + Template Method。
- Runner 使用 Serial Pipeline。
- Runtime 隔离使用 Strategy / Resolver。
- Ledger 使用 Repository Pattern。
- 报告生成读取 ledger / results，不重新扫描或重新运行 Factor。

## 开发边界

涉及以下内容的 Runtime 变更归入此处：

- 本地 session scanner adapter
- `SessionEnvelope` / event locator schema
- FactorPack 加载和校验
- Factor runner 和 Runtime 隔离
- 本地 SQLite ledger
- 报告生成
- 权限门
- manifest checksum / attestation / 兼容性校验

Protocol、plugin、channel、治理和 registry 变更归 EvoZeus Repo 根目录。

## 输出结构

Runtime 计划或复核输出：

```text
能力 -> 输入 -> 输出 -> 权限 -> 验证 -> 回滚 -> 用户确认门
```
