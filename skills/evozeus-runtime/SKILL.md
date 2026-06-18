---
name: evozeus-runtime
description: Use when working on EvoZeus runtime behavior, local registry, CLI, TUI, Doctor, browser companion, workspace state, or report generation surfaces.
---

# EvoZeus-Runtime

Runtime work must preserve local-first behavior and user approval gates. The repository currently promises protocol and contribution surfaces; runtime code is still reviewed per issue or PR.

## Runtime Principles

- Zero-install by default for root `SKILL.md`.
- Local-first: raw sessions and runtime state stay under `.evozeus/`.
- Markdown/JSON first before dashboards or charts.
- Opt-in packs for scanner, factor code, MCP, LLM, browser, or visualization behavior.
- Manifest before download: show dependencies, permissions, inputs, outputs, and fallback.
- User approval before upload, GitHub issue, PR, or external sync.

## Runtime Scope

Runtime PRs should state which surface changes:

| Surface | Examples |
| --- | --- |
| Local registry | session IDs, artifact index, cache |
| Report generation | Markdown/JSON evidence report |
| Doctor | environment checks, blocked-state diagnosis |
| TUI | local review flow |
| Browser companion | optional local UI inspection |
| Workspace state | `.evozeus/` structure and cleanup |

## Required Checks

Runtime work should include:

- reproduction or real behavior proof
- command used after the patch
- before/after output or generated artifact
- privacy impact
- fallback when optional dependencies are unavailable

Use `../../.github/PULL_REQUEST_TEMPLATE/code_change.md` and run `python3 scripts/check_pr_ready.py --base <base-ref>` from repository root before review.
