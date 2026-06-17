# Report Templates

- Status: draft
- Last updated: 2026-06-14

EvoZeus reports should help a human or Agent review evidence and reach a verdict.

Reports should not output unexplained raw scores. A report-level visualization can show structured scores when the score is part of the factor contract.

## Factor Result HTML

Purpose: review selected `FactorResult` objects in one local HTML page.

Rendering:

- React UMD
- Ant Design UMD
- Ant Design reset CSS
- local embedded report payload

Input:

- `FactorResult`
- `FactorPack`
- report-level visualization builder
- SQLite result index for cross-session workspace views

Output:

- `.evozeus/runtime/index/results.sqlite3`
- `.evozeus/sessions/<session_id>/factor-results.html`

Script entry:

```bash
PYTHONPATH=__infra__/src python __infra__/scripts/run_session_report.py \
  --source __infra__/testdata/codex_sessions \
  --factor default.tool_failure \
  --factor default.open_loop
```

P0 visualization:

- `word_cloud`

`word_cloud` input:

- `tags.type`
- `tags.value`
- `verdict_signals`
- `factor_id` as provenance, not as displayed term

`word_cloud` output:

- `terms.text`
- `terms.weight`
- `terms.source_factor_ids`

Factor 输出会影响词云输入和输出。Rich TUI 或 browser components 可以读取同一组 `ResultVisualization` 数据。

Dashboard sections:

- Summary statistics
- Word cloud
- Factor result matrix
- Factor result cards

The HTML report is a rendering artifact. Structured session/result/tag/evidence data lives in SQLite so the browser workspace can show all scanned sessions, selected-session dashboards, and incremental analysis status.

## Session Verdict Report

Purpose: review one session and decide whether it produced a Case.

Sections:

- Session ID
- Task context
- Evidence summary
- Triggered tags
- Cases
- Proposed verdicts
- Optimization suggestions
- Privacy notes

Suggested visualization:

- Timeline for session events
- Bar chart for tag frequency
- FlowGraph for evidence -> case -> verdict

## Evidence Graph

Purpose: trace a claim back to evidence.

Nodes:

- Tag
- Factor
- Tool call
- Error
- File diff
- Agent message
- Verdict

Suggested visualization:

- NetworkGraph
- Sankey
- MindMap

## Workspace Case Dashboard

Purpose: review repeated patterns across many sessions.

Sections:

- High-frequency Cases
- Repeated environment issues
- Rejected patterns
- Pending open Cases
- Accepted Factors and Skills

Suggested visualization:

- Heatmap
- Line
- Treemap
- Chord
