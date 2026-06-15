# Privacy Redaction Policy

- Status: active
- Last updated: 2026-06-16

Canonical privacy rules live in `docs/governance/privacy-and-redaction.md`. This file defines the PR gate wording used by automation.

## Public Artifact Rule

Raw session logs are not public contribution material. Evidence must be minimized and redacted before it enters an issue, PR, example, Candidate, or report.

Always remove:

- secrets, tokens, cookies, credentials, and private keys
- customer data and personally identifying information
- private local paths
- unreleased code or proprietary prompts
- internal URLs and raw logs not required for review

Automation labels suspected leaks as `risk:privacy` and `candidate:needs-redaction`. Maintainers may require a new redacted evidence packet before review continues.
