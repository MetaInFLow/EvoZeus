# Maintainer Playbook

- Status: active
- Last updated: 2026-06-16

This playbook is for maintainers handling the PR queue.

## New PR Triage

1. Confirm the template matches the PR type.
2. Read bot labels and the EvoZeus triage comment.
3. Check linked issue, Case, RFC, or maintainer request.
4. Verify proof, privacy, scope, and owner path requirements.
5. Route to review, needs-info, needs-redaction, convert-to-rfc, owner-only, or close.

## Require Proof

Ask for proof when the PR changes behavior, instructions, schema, workflow, dependencies, or Candidate lifecycle and only provides assertions, mocks, lint, type checks, or CI.

## Require Redaction

Pause review when evidence includes raw session logs, secrets, private paths, internal URLs, customer data, or unreleased business context.

## Convert To RFC

Use RFC route for governance changes, workflow/security changes, branch protection changes, Candidate lifecycle changes, or broad architecture changes.

## Merge Conditions

Merge only when:

- scope is narrow and understandable
- required template fields are complete
- proof gate is satisfied or explicitly overridden by maintainer
- privacy scan is clear or manually cleared
- CODEOWNERS review is satisfied for protected paths
- conversations are resolved
- no active `triage:dirty-pr`, `proof:needed`, `candidate:needs-redaction`, or `triage:rfc-needed` label remains

Do not merge via bot. EvoZeus automation may label, comment, and block; it must not approve or merge.
