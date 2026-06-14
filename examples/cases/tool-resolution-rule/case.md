# Case: CLI Path Resolution Before Declaring Tool Missing

## Context

An Agent tries to use a CLI and assumes it is missing because it is not available in the default shell path.

## Evidence

Redacted example:

```text
tool: gh --version
result: command not found

tool: which gh
result: no gh in default PATH

tool: find common install paths
result: /opt/homebrew/bin/gh
```

## Proposed Verdict

`Fix Environment`

## Action

Before declaring a CLI missing, check common install locations and shell initialization differences:

- `/opt/homebrew/bin`
- `/usr/local/bin`
- tool-specific config paths
- login vs non-login shell PATH

## Why It Matters

Agents often misdiagnose environment issues as missing dependencies. This wastes user time and can cause unnecessary reinstall instructions.

## Privacy Note

Local private paths are generalized. No raw session logs are included.
