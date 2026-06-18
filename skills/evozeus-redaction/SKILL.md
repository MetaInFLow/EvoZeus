---
name: evozeus-redaction
description: Use when preparing EvoZeus evidence, reports, logs, screenshots, examples, issues, pull requests, or session excerpts for public sharing.
---

# EvoZeus-Redaction

Public EvoZeus artifacts must preserve judgment value while removing private data. Raw sessions are not public contribution material.

## Remove Or Generalize

Always remove:

- secrets, tokens, cookies, credentials, private keys
- customer names, user names, email, phone, address, account IDs
- private local paths when not needed for the Case
- unreleased code, proprietary prompts, private configs
- exact screenshots or logs that expose private work

Generalize when the detail is useful but identifying:

| Private detail | Public replacement |
| --- | --- |
| `/Users/alice/company/client-x/project` | `/private/workspace/project` |
| real customer name | `Customer A` |
| exact token or key | `[REDACTED_SECRET]` |
| internal URL | `https://internal.example/redacted` |

## Keep Judgment Value

Do not redact so much that evidence becomes meaningless. Keep:

- failure type
- relevant command shape
- artifact kind
- environment class
- before/after behavior
- reviewer-facing limitation

## Public Gate

Before opening an issue, PR, or example, check:

- Does the artifact contain only the minimum evidence needed?
- Can a reviewer understand the Case without private context?
- Does the privacy note state what was removed or generalized?
- Does the contribution follow `../../docs/governance/privacy-and-redaction.md`?

If unsure, keep the artifact local and ask for owner review.
