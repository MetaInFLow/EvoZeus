# Factor Analysis Protocol

- Status: draft
- Last updated: 2026-06-16

Factor 必须绑定到一个 analysis framework stage，并产出稳定的 Factor Result。这样 factors 可以和分析框架一起演进，避免只留下松散 tag。

P0 的 factor pack 是本地 runtime asset，下载后进入：

```text
.evozeus/runtime/factors/installed/<factor_id>/<version>/
```

主代码只保留 framework、manifest contract、abstract class、runner 和 storage。

## Current Framework

```text
agent_session_review.v0
```

## Stage Values

- `ingest`
- `normalize`
- `signal_extraction`
- `evidence_building`
- `case_building`
- `verdict_building`
- `insight_aggregation`

## Result Fields

| Field | 中文名 | Meaning |
| --- | --- | --- |
| `schema_version` | 结果协议版本 | 固定为 `factor_result.v0` |
| `run_id` | 执行 ID | 单次 factor run 的稳定 id |
| `factor_id` | 因子 ID | 稳定 factor id |
| `factor_version` | 因子版本 | 产出该结果的 factor version |
| `framework_id` | 框架 ID | Analysis framework id |
| `stage` | 阶段 | 绑定的 analysis stage |
| `target_type` | 目标类型 | 例如 `session` |
| `target_id` | 目标 ID | 被分析对象的 id |
| `session_id` | 会话 ID | 当前 session id |
| `status` | 状态 | `matched`、`skipped` 或后续扩展状态 |
| `tags` | 标签 | 算法生成的 tags |
| `scores` | 信号值 | 数值型算法信号 |
| `evidence_refs` | 证据引用 | 指向 event / source locator，不携带原始私密内容 |
| `verdict_signals` | 裁决信号 | 支持哪些可能的 Verdict |
| `confidence` | 置信度 | 0 到 1 的 confidence |

## Factor Pack Format

每个 factor pack 至少包含：

```text
<factor_id>/<version>/
  factor.json
  FACTOR.xml
  factor.py
```

`factor.json` 是执行 manifest：

```json
{
  "schema_version": "factor.v0",
  "id": "community.github_network_debug",
  "name": "github-network-debug",
  "framework_id": "agent_session_review.v0",
  "stage": "signal_extraction",
  "runtime_profile": "community",
  "default_enabled": false,
  "version": "0.1.0",
  "status": "candidate",
  "description": "Classifies GitHub network failures.",
  "entrypoint": "factor:GithubNetworkDebugFactor",
  "inputs": ["session.events", "tool_event.result"],
  "outputs": ["tag", "evidence_ref", "verdict_signal"],
  "permissions": ["read_session_events"],
  "risks": ["misclassifies auth as network"],
  "rollback": "disable factor in local config",
  "run": {
    "mode": "sync",
    "timeout_ms": 1000
  }
}
```

`FACTOR.xml` 是固定介绍，供真人用户和 Agent 判断这个 factor 的用途、输入输出、适用时机、限制和隐私边界：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<factor id="community.github_network_debug" version="0.1.0">
  <name>github-network-debug</name>
  <summary>识别 GitHub 网络失败、DNS、timeout 或连接异常。</summary>
  <category>session-signal</category>
  <stage>signal_extraction</stage>
  <runtime>in_process</runtime>
  <inputs>
    <input>session.events</input>
    <input>tool_event.result</input>
  </inputs>
  <outputs>
    <output>tag</output>
    <output>evidence_ref</output>
    <output>verdict_signal</output>
  </outputs>
  <when_to_use>当需要判断任务是否因 GitHub 访问异常延后时使用。</when_to_use>
  <limitations>网络异常和权限异常可能混淆，需要结合工具 stderr 和后续重试判断。</limitations>
  <privacy>只读取标准化 SessionEnvelope，不输出 raw private content。</privacy>
</factor>
```

扫描 factor pack 时，runtime 会同时读取 `factor.json` 和 `FACTOR.xml`，并校验 id、version、stage、runtime 一致。

可视化机制属于 report layer。P0 HTML renderer 会把指定的 `FactorResult` 拼进一个 Ant Design dashboard，并基于这些结果生成聚合可视化。例如词云读取 `tags.type`、`tags.value` 和 `verdict_signals`，同时用 `factor_id` 生成 `terms.source_factor_ids`，用于追溯某个词来自哪些 factor。

Python contracts 位于：

- `__infra__/src/evozeus/factors/protocol.py`
- `__infra__/src/evozeus/factors/manifest.py`
- `__infra__/src/evozeus/factors/base.py`
- `__infra__/src/evozeus/factors/registry.py`
- `__infra__/src/evozeus/factors/runner.py`

P0 结构化结果写入本地 SQLite index：

```text
.evozeus/runtime/index/results.sqlite3
```

核心表：

| Table | Purpose |
| --- | --- |
| `sessions` | 记录扫描到的 session、来源、event 数、发现时间和最近加载时间 |
| `session_events` | 记录每条标准化 event 的 role、hash、redacted preview、locator 和 metadata |
| `analysis_runs` | 记录一次分析运行的 session、factor 列表、开始/完成时间和状态 |
| `factor_results` | 保存每个 `FactorResult` 的结构化字段、scores 和 verdict signals |
| `factor_tags` | 保存 result-level tags |
| `factor_evidence` | 保存 result 到具体 event 的 evidence refs |
| `event_factor_tags` | 保存最新的 event -> factor tag 映射，供 session table 和 dashboard drill-down 查询 |
| `factor_run_index` | 保存每个 session/factor 最近一次运行时间、状态和 result run |

`session_events` 不默认保存完整原文。原文定位字段遵循：

- [source-locator-protocol.md](source-locator-protocol.md)
- [scanner-pack-protocol.md](scanner-pack-protocol.md)

通用链路：

```text
evidence_refs
  -> event_factor_tags
  -> session_events(session_id, event_id)
  -> scanner_id / scanner_version
  -> event_locator_json / artifact_locator_json
  -> scanner pack resolver
  -> provider 原始 event 或 normalized artifact
```

Markdown report 仍会生成，适合 Agent 读取：

```text
.evozeus/sessions/<session_id>/factor-results.md
```

同时支持生成单页 HTML：

```text
.evozeus/sessions/<session_id>/factor-results.html
```

`FactorResult` 仍是内存中的结构化 contract。Markdown 适合 Agent 读取，HTML 适合真人用户快速查看多个 result。
