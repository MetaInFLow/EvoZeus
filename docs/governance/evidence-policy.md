# Evidence Policy

- Status: active
- Last updated: 2026-06-16

EvoZeus uses evidence proof instead of score, taste, or maintainer intuition.

## Evidence Levels

| Level | Meaning |
| --- | --- |
| 0 | Opinion only |
| 1 | Synthetic example |
| 2 | Local reproduction |
| 3 | Real session evidence |
| 4 | Repeated evidence across sessions |
| 5 | Independently reproduced by another user |

## Merge Floors

| Target | Minimum evidence |
| --- | --- |
| Community Candidate | Level 2+ |
| Reviewed Candidate | Level 3+ |
| Core Candidate | Level 4+ |
| Runtime behavior change | Real behavior proof |
| Skill or instruction change | Before/after agent behavior proof |

Tests, mocks, lint, type checks, snapshots, and CI are useful but supplemental. They do not replace real behavior proof for behavior-changing PRs.
