---
name: evozeus-runtime
description: Use when working on EvoZeus runtime behavior, local registry, CLI, TUI, Doctor, browser companion, workspace state, or report generation surfaces.
---

# EvoZeus-Runtime

Runtime work must preserve local-first behavior and user approval gates. `EvoZeus` main repo is Protocol-only; runtime implementation belongs in `evozeus-runtime`. This skill is the routing and trust-policy skill for runtime work from the main repo context.

## Runtime Principles

- Zero-install by default for root `SKILL.md`.
- Local-first: raw sessions and runtime state stay under `.evozeus/`.
- Markdown/JSON first before dashboards or charts.
- Opt-in packs for scanner, factor code, MCP, LLM, browser, or visualization behavior.
- Manifest before download: show dependencies, permissions, inputs, outputs, and fallback.
- User approval before upload, GitHub issue, PR, or external sync.

## User Journey Role

Runtime is optional component assembly after Start Here:

```text
EvoZeus skeleton
  -> user approves runtime
  -> runtime reads EvoZeus registry pointer
  -> runtime verifies default official factors
  -> runtime runs local judgment
```

Do not silently install, scan, network, or create local state. Show what will be read, written, installed, and verified before enabling runtime.

## Default Official Factors

When the user asks to use default factors:

1. Read the main `EvoZeus` registry pointer.
2. Resolve only official release manifests.
3. Verify checksum, SBOM / attestation, compatibility, and review state.
4. Enable only the selected factors.
5. Keep raw session data local.

If the registry pointer, manifest, checksum, or attestation is missing, stop and report the blocker instead of inventing an install path.

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

Implementation PRs for these surfaces go to `evozeus-runtime`. Main repo changes should be limited to protocol, schemas, trust policy, registry pointer, or routing docs.

## Required Checks

Runtime work should include:

- reproduction or real behavior proof
- command used after the patch
- before/after output or generated artifact
- privacy impact
- fallback when optional dependencies are unavailable

For main repo protocol or routing changes, use the appropriate `../../.github/PULL_REQUEST_TEMPLATE/*` template and run `python3 scripts/check_pr_ready.py --base <base-ref>`. For runtime implementation, open the PR in `evozeus-runtime` and use that repo's checks.
