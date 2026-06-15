# Runtime Keywords

- Status: active
- Last updated: 2026-06-15
- Language: en

## Overview

The runtime layer turns session input into judgment signals.

```text
Analysis Framework
-> Stage
-> Factor
-> Factor Result
-> Evidence / Case / Verdict
```

## Keywords

| Term | Meaning | Use |
| --- | --- | --- |
| Analysis Framework | The context, stages, and output constraints for an analysis task | Defines where factors run |
| Stage | A runtime phase inside a framework | Controls factor order and responsibility |
| Factor Runtime | The local layer that executes factors and collects results | Runs default factors and checks result health |
| Factor | A reusable judgment algorithm bound to a stage | Produces tag, score, evidence ref, verdict signal |
| Factor Result | Stable factor output | Feeds Evidence, Case, and Verdict |
| runtime_profile | Factor execution profile | Separates default, heavy, and community factors |
| Heavy Factor | A factor requiring extra models, higher resources, or external services | Enabled explicitly by the user |
| Community Factor | A factor from the community registry | Enabled after inspect |

## Analysis Framework

Default framework:

```text
agent_session_review.v0
```

It defines how EvoZeus judges Agent Sessions.

Default stages:

```text
ingest
-> normalize
-> signal_extraction
-> evidence_building
-> case_building
-> verdict_building
-> insight_aggregation
```

## Factor

Minimal factor declaration:

```yaml
id: default.tool_failure
framework_id: agent_session_review.v0
stage: signal_extraction
runtime_profile: default
default_enabled: true
inputs:
  - tool_event
  - command_output
outputs:
  - tag
  - score
  - evidence_ref
  - verdict_signal
```

## Factor Result

Factor Result must include:

- `factor_id`
- `framework_id`
- `stage`
- `target_type`
- `target_id`
- `tags`
- `scores`
- `evidence_refs`
- `verdict_signals`
- `confidence`

A Factor provides verdict signals. The Judgment layer decides the final Verdict.

## Runtime Profiles

| Profile | Default State | Meaning |
| --- | --- | --- |
| `default` | enabled | Lightweight, local, low dependency |
| `heavy` | disabled | Extra models, higher latency, higher resources, or external services |
| `community` | disabled | Community sourced, requires inspect and confirmation |

## Default Factors

Initial default factors:

- `default.tool_failure`
- `default.open_loop`
- `default.same_target_rework`
- `default.correction_loop`
- `default.negative_signal`
- `default.usage_sentence`
- `default.key_sentence`
- `default.skill_tool_source_activity`
- `default.success_factor`

## Confirmation Boundaries

Requires confirmation:

- enable a heavy factor
- install heavy factor dependencies
- enable a community factor
- access the community registry
- modify factor configuration
- delete or overwrite factor results

Low-risk actions:

- view local factor status
- view default factor results
- summarize evidence refs
- generate a local debug hint

## Related Docs

- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
- [TUI + Agent Companion Workflow](../design/active/design_doc-v0.2-tui-agent-companion-workflow.md)
- [Privacy and Redaction](../governance/privacy-and-redaction.md)
