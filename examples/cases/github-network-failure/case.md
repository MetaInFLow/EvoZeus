# Case: GitHub Failure Is Not Always Auth Failure

## Context

An Agent repeatedly sees GitHub push or API failures and assumes `gh` authentication is broken.

## Evidence

Redacted example:

```text
gh auth status
result: authenticated

git push origin main
result: network timeout

retry after network change
result: success
```

## Proposed Verdict

`Fix Environment`

## Action

When GitHub operations fail, check authentication and network separately:

- `gh auth status`
- DNS or proxy symptoms
- repeated timeout pattern
- whether non-GitHub network requests are also failing

## Why It Matters

This prevents Agents from asking users to re-authenticate when the real issue is network instability.

## Privacy Note

Repository URL, account name, and network details are generalized.
