# Report Templates

- Status: draft
- Last updated: 2026-06-14

EvoZeus reports should help a human or Agent review evidence and reach a verdict.

Reports should not output unexplained raw scores. A declared visualization component can show structured scores when the score is part of the factor contract.

## Factor Result HTML

Purpose: review selected `FactorResult` objects in one local HTML page.

Input:

- `FactorResult`
- `FactorPack`
- `FACTOR.xml` visualization component

Output:

- `.evozeus/sessions/<session_id>/factor-results.html`

Component routing:

- `verdict_card`
- `open_loop_card`
- `tag_frequency_card`
- `rework_card`
- `score_card`
- `task_span_table`
- `evidence_list`
- `correction_loop_card`

P0 HTML uses static sections with `data-component`. Rich TUI or browser components can use the same field later.

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
