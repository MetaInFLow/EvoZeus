# Minimal Loop

- Status: draft
- Last updated: 2026-06-15

Minimal Loop 定义 EvoZeus 的最小可重复闭环。目标不是先做完整 runtime，而是让 agent 和 reviewer 能稳定地产出、审查和复用同一种结构。

## Loop

```text
Session Summary
  -> Evidence Packet
  -> Draft Case
  -> Candidate
  -> Verdict
  -> Artifact or Negative Pattern
```

## Step Contracts

| Step | Input | Output | Gate |
| --- | --- | --- | --- |
| Session Summary | 用户任务、agent 行为、关键结果 | 脱敏摘要 | 不包含 raw private session |
| Evidence Packet | 摘要、tool output、diff、error、message | evidence list with grades | 至少一个 `E1` |
| Draft Case | evidence packet | case statement | 有 claim 和 why it matters |
| Candidate | draft case | candidate with primary kind | kind 明确，最低 `E2` |
| Verdict | candidate + review | verdict decision | 绑定 evidence 和 next action |
| Artifact | accepted verdict | reusable asset | 有使用入口和边界 |

## Minimal Manual Format

```md
## Session Summary

## Evidence Packet

| evidence_id | grade | source_type | summary | redaction_note |
| --- | --- | --- | --- | --- |

## Draft Case

## Candidate

- primary_kind:
- target_artifact:
- reuse_scenario:
- not_covered:

## Proposed Verdict

## Privacy Note

## Next Action
```

## Deterministic Extraction Rules

- 没有 evidence，不生成 Candidate。
- 只有 `E0`，只能生成 observation，不能生成 Case。
- 最高 evidence 低于 `E2`，默认 `Open Case`。
- 没有 primary kind，不能进入 review。
- 没有 privacy note，不能进入 public contribution。
- 命中 `R_PRIVACY_RISK`，先修 privacy，不继续 review。

## MVP Boundary

P0 只承诺 Manual Session Review：

- 输入可以是用户粘贴的 session 摘要。
- 输出必须是 Markdown。
- 不要求自动 session logging。
- 不要求 graph database。
- 不要求 bot 或 label automation。

P1 才考虑：

- session event schema。
- deterministic extractor。
- local registry。
- repeat pattern dashboard。

P2 才考虑：

- graph model。
- public library browse。
- ranking、adoption feedback、community metrics。
