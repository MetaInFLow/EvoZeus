---
name: evozeus-runtime-routing
description: Use when routing approved EvoZeus runtime behavior, local registry, CLI, TUI, browser companion, workspace state, scanner execution, factor execution, or report execution from the main repo context to evozeus-runtime.
---

# EvoZeus-Runtime Routing

Runtime routing preserves local-first behavior and user approval gates. `EvoZeus` main repo is Protocol-only; runtime implementation belongs in `evozeus-runtime`. This skill is the routing and trust-policy handoff from the main repo context to the runtime component.

## Runtime Principles

- Zero-install by default for root `SKILL.md` and `/skill`.
- Local-first: raw sessions and runtime state stay under `.evozeus/`.
- Markdown/JSON first before dashboards or charts.
- Opt-in packs for scanner, factor code, MCP, LLM, browser, or visualization behavior.
- Manifest before download: show dependencies, permissions, inputs, outputs, and fallback.
- User approval before upload, GitHub issue, PR, or external sync.

## User Journey Role

Runtime is optional component assembly after registration, skeleton install, and skills install:

```text
Web /skill
  -> EvoZeus-Install Registration
  -> EvoZeus skeleton + skills installed
  -> user approves runtime
  -> read evozeus-runtime/SKILL.md
  -> runtime reads EvoZeus registry pointer
  -> runtime verifies default official factors
  -> runtime runs local judgment
```

Do not silently install, scan, network, or create local state. Show what will be read, written, installed, and verified before enabling runtime.

## Handoff

When runtime is approved:

1. Read the component repo root skill at `evozeus-runtime/SKILL.md`.
2. State the requested capability: scanner execution, factor execution, local registry, report generation, TUI, browser companion, or runtime development.
3. State files to read, files to write, commands to run, dependencies, network behavior, rollback path, and privacy impact.
4. Stop if the runtime repo lacks the required manifest, checksum, attestation, lockfile schema, or implementation.

## Default Official Factors

When the user asks to use default factors, this skill routes consumption only. Registry publication or default set changes belong to `../evozeus-registry-release/SKILL.md`.

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
| Doctor implementation | environment check implementation after diagnosis identifies a runtime change |
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

## Boundaries

- Do not use this skill for `/skill` registration or skeleton/skills installation; use `../evozeus-install-registration/SKILL.md`.
- Do not use this skill for report content writing; use `../evozeus-reporting/SKILL.md` unless local file generation or runtime execution is needed.
- Do not use this skill for first-pass diagnosis; use `../evozeus-doctor-debugging/SKILL.md`.
- Do not bypass the main registry pointer or consume lab `reviewed` assets as default user-installable releases.
