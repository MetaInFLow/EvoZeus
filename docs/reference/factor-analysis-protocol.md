# Factor Analysis Protocol

- Status: active
- Last updated: 2026-06-15

Factor Analysis Protocol 定义 EvoZeus 中 `Analysis Framework` 与 `Factor` 的最小绑定协议。

协议目标：

- 让每个 factor 明确服务哪套分析框架。
- 让每个 factor 明确在哪个 stage 运行。
- 让 factor 输出稳定的 tag、score、evidence ref 和 verdict signal。
- 让默认本地因子、可选 heavy factor、社区 factor 使用同一份轻合约。

## Core Model

```text
Analysis Framework
-> Stage
-> Factor
-> Factor Result
-> Evidence / Case / Verdict
```

### Analysis Framework

`Analysis Framework` 是一套分析任务的上下文、阶段和输出约束。

最小字段：

| Field | Meaning |
| --- | --- |
| `id` | 稳定 id，例如 `agent_session_review.v0` |
| `purpose` | 这套框架要判断什么 |
| `scope` | 适用范围 |
| `stages` | 允许 factor 挂载的阶段 |
| `allowed_inputs` | factor 可以读取的输入类型 |
| `expected_outputs` | factor 应产出的结果类型 |

默认 framework：

```yaml
id: agent_session_review.v0
purpose: Judge real Agent Sessions from evidence.
scope:
  - current_session
  - local_history
stages:
  - ingest
  - normalize
  - signal_extraction
  - evidence_building
  - case_building
  - verdict_building
  - insight_aggregation
allowed_inputs:
  - session
  - event
  - user_turn
  - assistant_turn
  - tool_event
  - task_span
  - command_output
  - file_diff
  - environment_signal
  - final_answer
expected_outputs:
  - tag
  - score
  - evidence_ref
  - verdict_signal
  - confidence
```

## Stage Contract

| Stage | Responsibility | Typical Factor Output |
| --- | --- | --- |
| `ingest` | 发现 session、资源和输入来源 | source tag, import note |
| `normalize` | 标准化 event、tool call、turn、task span | normalized event, task span |
| `signal_extraction` | 抽取失败、纠偏、重复、未闭环、工具异常等信号 | tag, score, evidence ref |
| `evidence_building` | 把信号组织成可复核 evidence | evidence ref, excerpt summary |
| `case_building` | 把 evidence 聚合成 Case candidate | case signal, boundary |
| `verdict_building` | 生成 verdict signal 和建议动作 | verdict signal, confidence |
| `insight_aggregation` | 跨 session 聚合长期规律 | repeated pattern, skill proposal signal |

## Factor

`Factor` 是绑定到某个 framework stage 的可复用判断算法。

最小字段：

| Field | Meaning |
| --- | --- |
| `id` | 稳定 id，例如 `default.same_target_rework` |
| `framework_id` | 绑定的 analysis framework |
| `stage` | 运行阶段 |
| `runtime_profile` | `default`、`heavy`、`community` |
| `default_enabled` | 是否默认开启 |
| `inputs` | 输入类型 |
| `outputs` | 输出类型 |
| `evidence_policy` | 证据引用和原文暴露规则 |
| `verdict_signals` | 可能支持的 Verdict |

示例：

```yaml
id: default.same_target_rework
name: Same Target Rework
framework_id: agent_session_review.v0
stage: signal_extraction
runtime_profile: default
default_enabled: true

inputs:
  - user_turn
  - task_span

outputs:
  - tag
  - score
  - evidence_ref
  - verdict_signal

evidence_policy:
  required: true
  min_refs: 2
  raw_content_allowed: false

verdict_signals:
  - Promote to Skill
  - Extract Factor
  - Open Case
```

## Runtime Profiles

| Profile | Default | Use |
| --- | --- | --- |
| `default` | on | 轻量、本地、低依赖、可在首期默认运行 |
| `heavy` | off | 需要额外模型、较高耗时、较高资源消耗或外部服务 |
| `community` | off | 来自社区 registry，需要 inspect 和用户确认后启用 |

规则：

- `default` factor 可以随本地 review engine 默认运行。
- `heavy` factor 需要显式开启，并展示依赖、耗时、输入和输出。
- `community` factor 需要 manifest inspect、版本确认和本地启用记录。
- 所有 factor 都必须产出 evidence ref 或说明无证据原因。
- factor 输出只能提供 verdict signal，最终 Verdict 由 Judgment layer 汇总决定。

## Factor Result

Factor Result 是 factor 的稳定输出。

```json
{
  "factor_id": "default.same_target_rework",
  "framework_id": "agent_session_review.v0",
  "stage": "signal_extraction",
  "target_type": "session",
  "target_id": "ezs_20260615_001",
  "tags": [
    {
      "type": "rework",
      "value": "same_target_rework"
    }
  ],
  "scores": {
    "same_target_rework": 0.82
  },
  "evidence_refs": [
    {
      "ref_id": "event_0004",
      "kind": "user_turn",
      "summary": "用户第二次纠正同一目标。"
    },
    {
      "ref_id": "event_0011",
      "kind": "user_turn",
      "summary": "用户再次要求回到同一目标。"
    }
  ],
  "verdict_signals": [
    "Promote to Skill",
    "Open Case"
  ],
  "confidence": 0.78
}
```

## Default Factor Catalog

首期默认 factor 都应保持本地、轻量、低依赖。

| Factor ID | Stage | Input | Output |
| --- | --- | --- | --- |
| `default.tool_failure` | `signal_extraction` | tool event, command output | tool failure tag, debug evidence |
| `default.open_loop` | `signal_extraction` | task span, final answer | open loop tag, closure gap |
| `default.same_target_rework` | `signal_extraction` | user turn, task span | rework tag, evidence refs |
| `default.correction_loop` | `signal_extraction` | user turn, assistant turn | correction tag, confidence |
| `default.negative_signal` | `signal_extraction` | user turn, tool event | negative signal tag |
| `default.usage_sentence` | `signal_extraction` | user turn | reusable instruction signal |
| `default.key_sentence` | `evidence_building` | user turn, assistant turn | key constraint evidence |
| `default.skill_tool_source_activity` | `evidence_building` | tool event, source ref | activity summary |
| `default.success_factor` | `verdict_building` | evidence refs, task span | success factor score, verdict signal |

## Heavy Factor Examples

Heavy factor 默认关闭。

| Factor ID | Reason |
| --- | --- |
| `heavy.semantic_cluster` | 需要较重文本聚类或向量模型 |
| `heavy.deep_sentiment` | 需要额外 NLP 模型 |
| `heavy.llm_review` | 需要外部模型、成本和网络权限 |

Heavy factor 启用前必须展示：

- dependency
- runtime cost
- input scope
- output type
- privacy note
- fallback behavior

## Community Factor Manifest

社区 factor 使用同一协议，增加发布和信任字段。

```yaml
id: community.github_network_debug
name: GitHub Network Debug
framework_id: agent_session_review.v0
stage: verdict_building
runtime_profile: community
default_enabled: false
version: 0.1.0
status: candidate

inputs:
  - command_output
  - tool_event
  - environment_signal

outputs:
  - tag
  - evidence_ref
  - verdict_signal

permissions:
  - read_local_report

evidence_policy:
  required: true
  min_refs: 1
  raw_content_allowed: false

trust:
  source: github
  status: candidate
  reviewed_by: []
```

## Binding Rules

1. Factor 必须声明 `framework_id`。
2. Factor 必须声明 `stage`。
3. Factor 必须声明输入和输出。
4. Factor Result 必须包含 `factor_id`、`target_type`、`target_id` 和 `confidence`。
5. 支持 Verdict 的 factor 必须输出 `verdict_signals`，不能直接覆盖最终 Verdict。
6. 缺少 evidence ref 的 result 只能进入 `Open Case` 或 debug hint。
7. raw session content 默认留在本地；公开贡献只能使用 redacted evidence。

## Mapping to EvoZeus Objects

```text
Factor Result tags
-> Evidence
-> Case
-> Verdict
-> Rule / Skill Proposal / Environment Rule / Rejected Pattern
```

Factor Runtime 负责产生判断信号。Judgment layer 负责把信号转成 Case 和 Verdict。Community layer 负责把脱敏后的 Case、Rule 和 Factor proposal 进入 review。
