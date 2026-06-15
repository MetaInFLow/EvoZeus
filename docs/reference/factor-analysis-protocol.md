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
| `evidence_refs` | 证据引用 | 指向证据，不携带原始私密内容 |
| `verdict_signals` | 裁决信号 | 支持哪些可能的 Verdict |
| `confidence` | 置信度 | 0 到 1 的 confidence |

## Factor Pack Format

每个 factor pack 至少包含一个 manifest：

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

Python contracts 位于：

- `__infra__/src/evozeus/factors/protocol.py`
- `__infra__/src/evozeus/factors/manifest.py`
- `__infra__/src/evozeus/factors/base.py`
- `__infra__/src/evozeus/factors/registry.py`
- `__infra__/src/evozeus/factors/runner.py`

P0 落盘结果使用 Markdown report：

```text
.evozeus/sessions/<session_id>/factor-results.md
```

`FactorResult` 仍是内存中的结构化 contract，用户默认看到 Markdown。
