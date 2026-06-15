# Factor Analysis Protocol

- Status: draft
- Last updated: 2026-06-15

Factor 必须绑定到一个 analysis framework stage，并产出稳定的 Factor Result。这样 factors 可以和分析框架一起演进，避免只留下松散 tag。

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
| `factor_id` | 因子 ID | 稳定 factor id |
| `framework_id` | 框架 ID | Analysis framework id |
| `stage` | 阶段 | 绑定的 analysis stage |
| `target_type` | 目标类型 | 例如 `session` |
| `target_id` | 目标 ID | 被分析对象的 id |
| `tags` | 标签 | 算法生成的 tags |
| `scores` | 信号值 | 数值型算法信号 |
| `evidence_refs` | 证据引用 | 指向证据，不携带原始私密内容 |
| `verdict_signals` | 裁决信号 | 支持哪些可能的 Verdict |
| `confidence` | 置信度 | 0 到 1 的 confidence |

Python contract 位于 `src/evozeus/factors/protocol.py`。
