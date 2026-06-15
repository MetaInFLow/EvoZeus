# Governance Review Contract

- Status: active
- Last updated: 2026-06-16

Reviewer decisions must be explicit and label-compatible. The detailed artifact review contract lives in `docs/reference/review-contract.md`.

## Decisions

| Decision | Standard |
| --- | --- |
| `accept` | Scope is narrow, proof is sufficient, privacy is clear, owner requirements satisfied |
| `request-changes` | Implementation or wording is wrong but direction is acceptable |
| `needs-evidence` | Claim is plausible but proof is missing or mock-only |
| `needs-redaction` | Evidence may expose private or sensitive data |
| `convert-to-rfc` | Rule, workflow, architecture, or governance change needs prior discussion |
| `close-duplicate` | Existing issue, PR, Candidate, or rule covers it |
| `close-low-signal` | No actionable evidence or operational rule |
| `owner-only` | High-risk path requires maintainer owner review |
