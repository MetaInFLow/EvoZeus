# Protected Paths

- Status: active
- Last updated: 2026-07-30

These paths require owner review and must not be auto-merged.

| Path | Reason |
| --- | --- |
| `SKILL.md` | Agent entrypoint |
| `skills/` | Scenario instructions |
| `maintainer/skills/` | Maintainer instructions |
| `.codex-plugin/`, `.claude-plugin/` | Plugin identity and default user surface |
| `hooks/` | Host lifecycle adapters and injected Agent context |
| `packages/runtime/` | Local evidence processing, permissions, storage and reports |
| `packs/session-signal/` | Built-in review Factors and signal contracts |
| `.github/workflows/` | GitHub token and workflow behavior |
| `.github/CODEOWNERS` | Ownership enforcement |
| `.github/PULL_REQUEST_TEMPLATE/` | Review gate inputs |
| `.github/ISSUE_TEMPLATE/` | Intake gate inputs |
| `scripts/github/` | Triage and PR automation |
| `schemas/` | Candidate, session, and report compatibility |
| `docs/governance/` | Maintainer rules |
| `docs/rfcs/` | Governance change proposals |
| `docs/reference/ontology.md` | Candidate semantic boundary |
| `docs/reference/evidence-grading.md` | Proof standard |
| `docs/governance/privacy-and-redaction.md` | Privacy rule |
| `candidates/core/` | Core reusable library |
| `candidates/reviewed/` | Maintainer-reviewed Candidate library |
| future `factors/registry/` | Main Factor registry and install trust boundary |
| independent Factor extension manifests | Versioned third-party Factor distribution surface |

CODEOWNERS requests review for these paths. Branch protection or repository rulesets must enable code owner review to enforce it.

Repository settings are listed in `docs/governance/github-settings.md`.
