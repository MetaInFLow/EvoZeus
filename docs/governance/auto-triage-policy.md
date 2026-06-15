# Auto Triage Policy

- Status: active
- Last updated: 2026-06-16

EvoZeus automation is dry-run by default. It can label and comment, but cannot approve, merge, promote core Candidates, or bypass owner review.

## Bot Actions

| Condition | Label | Dry-run action |
| --- | --- | --- |
| Blank or incomplete template | `triage:blank-template` | Comment with missing fields |
| Missing real proof | `proof:needed` | Comment and block when enforcement is enabled |
| Mock-only proof | `proof:mock-only` | Comment and block when enforcement is enabled |
| Possible private data | `risk:privacy`, `candidate:needs-redaction` | Comment and require redaction |
| Too many open PRs | `triage:too-many-prs` | Comment; closing requires enforcement flag |
| Mixed surfaces | `triage:dirty-pr` | Comment and ask to split |
| Governance change without RFC | `triage:rfc-needed` | Comment and route to RFC |
| Protected path changed | `triage:owner-only` | Comment and require owner review |

All bot comments must use a marker comment so repeated runs update one report instead of spamming the thread.
