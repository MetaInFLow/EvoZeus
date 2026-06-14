# Privacy and Redaction

- Status: active
- Last updated: 2026-06-14

EvoZeus should make sessions reviewable without making private sessions public.

## Privacy Rules

1. Do not publish raw Agent Session logs.
2. Do not publish secrets, tokens, credentials, cookies, private keys, customer data, or private repository paths.
3. Prefer summaries plus targeted evidence excerpts.
4. Keep enough evidence for others to verify the verdict.
5. Ask the user before any network contribution.

## What Counts as Sensitive

| Sensitive item | Redaction |
| --- | --- |
| API key or token | `<TOKEN_REDACTED>` |
| Customer or person name | `<CUSTOMER_NAME>` |
| Local filesystem path | `<LOCAL_PATH>` |
| Private repository | `<PRIVATE_REPO>` |
| Email or phone | `<CONTACT_REDACTED>` |
| Proprietary code | summarize behavior, do not paste code |

## Evidence That Is Usually Safe

- Command shape without private arguments
- Error class and normalized message
- Timing, retry counts, and tool sequence
- Diff summary without private code
- Agent behavior summary
- Proposed verdict and rationale

## Contribution Checklist

Before opening an issue or PR:

- Evidence is minimized.
- Sensitive data is replaced with placeholders.
- The Case can be understood without raw logs.
- The user has approved external contribution.
- The proposed verdict is supported by evidence.
