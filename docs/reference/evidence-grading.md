# Evidence Grading

- Status: draft
- Last updated: 2026-06-26

Evidence Grading 用来判断一个 Case 或 Candidate 的证据强度。它不是评分系统，而是 review gate：证据等级不够时，不应进入 Library。

## Evidence Unit

一个 Evidence unit 至少包含：

| Field | Meaning |
| --- | --- |
| `evidence_id` | 稳定引用 id |
| `source_type` | evidence 来源类型 |
| `summary` | 脱敏后的事实摘要 |
| `location` | 可定位位置，例如 message、tool call、file、issue、PR |
| `redaction_note` | 脱敏说明 |
| `grade` | E0-E4 |

## Grades

| Grade | Name | Meaning | Can support |
| --- | --- | --- | --- |
| `E0` | Assertion | 只有主观判断或回忆 | 不能单独支持 Candidate |
| `E1` | Observation | 有可描述现象，但缺少原始定位 | Draft Case |
| `E2` | Excerpt | 有脱敏片段、错误信息、对话摘录或 diff 摘要 | Case |
| `E3` | Trace | 有 tool output、命令、文件变化、事件顺序或可复核 trace | Candidate review |
| `E4` | Reproducible Proof | 有可复现步骤、前后对照或多 session 重复 | Accepted Artifact |

## Source Types

| Source type | Examples |
| --- | --- |
| `message_excerpt` | 用户纠偏、agent 关键判断、最终答复 |
| `tool_output` | 命令输出、错误类型、HTTP 状态、CLI 结果 |
| `file_diff` | 相关 diff 摘要，不包含私有代码全文 |
| `event_sequence` | tool call 顺序、retry、失败恢复路径 |
| `environment_signal` | PATH、版本、权限、网络、认证状态 |
| `reproduction` | 复现步骤、重复 session、测试结果 |

## Gate Rules

| Target | Minimum grade |
| --- | --- |
| Draft Case | `E1` |
| Public Case | `E2` |
| Candidate Review | `E3` |
| Accepted Artifact | `E3`，高风险变更需要 `E4` |
| Negative Pattern | `E2`，系统性反模式建议 `E3` |

## Traceability Gate

证据能不能进入 review，不只看等级，也看可追溯性。

| Check | Rule |
| --- | --- |
| Locator | `location` 必须能让 reviewer 找回事件、命令、文件、issue、PR 或 session 片段 |
| Redaction | public evidence 必须先脱敏，不能暴露 raw private path、客户材料或完整私有 transcript |
| Claim fit | evidence 必须直接支撑 claim；只说明“发生过”不等于说明“应该沉淀” |
| Recheck path | `E3` / `E4` 应提供命令、diff、event sequence、复现步骤或多 session 重复依据 |
| Human review | factor output 只能提出 evidence-backed signal，不能单独把 artifact 标为 accepted |

## Strength Rules

- 多个低等级 Evidence 不会自动变成高等级 Evidence。
- Reviewer 可以把 evidence 降级，例如摘录无法定位时从 `E2` 降为 `E1`。
- 敏感信息未脱敏时，不能用作 public evidence。
- LLM reasoning 只能作为 context，不能单独作为 `E3` 或 `E4`。
- Reproducible proof 必须包含步骤和预期结果。

## Minimal Evidence Packet

Candidate 至少需要：

```text
context
claim
evidence_ids
highest_grade
privacy_note
reviewer_question
```

如果没有 `highest_grade >= E3`，默认 Verdict 应是 `Open Case` 或 `Preserve`，不是 `Promote to Skill` 或 `Extract Factor`。

## Rating Relationship

| Rating | Evidence requirement |
| --- | --- |
| Strong | 至少一个 `E3`，高风险或系统性规则建议 `E4` |
| Medium | `E2` 足够清楚，但 route、边界或重复性仍需补证 |
| Weak | `E1` 或低质量 `E2`，只能支持 Draft Case |
| Blocked | locator 缺失、未脱敏或 claim/evidence 不匹配 |
