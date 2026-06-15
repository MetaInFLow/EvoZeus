# Report Templates

- Status: draft
- Last updated: 2026-06-15

EvoZeus reports should help a human or Agent review evidence and reach a verdict.

Report type explanations and reading paths live in [../reports/README.zh-CN.md](../reports/README.zh-CN.md).

Reports should not output scores.

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
