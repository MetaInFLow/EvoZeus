# Workflow Security

- Status: active
- Last updated: 2026-06-16

GitHub Actions must preserve least privilege.

## Defaults

- Default workflow permissions should be read-only in repository settings.
- Workflows must declare `permissions`.
- `pull_request_target` workflows must not checkout or execute untrusted PR head code.
- Automation must not approve or merge PRs.
- Third-party actions should be minimized and pinned when used.

## Current Automation Mode

EvoZeus governance automation is dry-run by default:

```text
labels + marker comment + status signal
no approval
no merge
no promotion
no auto-close unless explicitly enabled
```

Manual repository settings still need to enable branch protection and code owner review.
