# Candidate Lifecycle

- Status: active
- Last updated: 2026-06-16

Candidate files live under `candidates/` and move through explicit lifecycle directories.

## Directories

| Directory | Meaning |
| --- | --- |
| `candidates/community/` | Submitted Candidate with schema-valid evidence |
| `candidates/reviewed/` | Maintainer-reviewed Candidate |
| `candidates/core/` | Stable reusable Candidate |
| `candidates/deprecated/` | Candidate no longer recommended |

## Promotion Gates

| Target | Gate |
| --- | --- |
| `community` | Schema valid, privacy checked, evidence Level 2+ |
| `reviewed` | Evidence Level 3+, reviewer approved, counterexamples present, operational rule present |
| `core` | Evidence Level 4+, used in at least 2 sessions, no unresolved privacy risk, owner approved |
| `deprecated` | Harmful, replaced, obsolete tool version, or unsupported evidence |

Draft Candidates that fail ontology, proof, or privacy gates should be rejected or kept outside the public lifecycle.
