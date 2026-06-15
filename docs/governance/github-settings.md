# GitHub Settings Checklist

- Status: active
- Last updated: 2026-06-16

These settings must be configured in GitHub repository settings. They are not fully enforceable by committed files.

## Pull Requests

- Allow merge commits: off
- Allow squash merging: on
- Allow rebase merging: optional
- Always suggest updating pull request branches: on
- Automatically delete head branches: on
- Allow auto-merge: off initially

## Actions

- Default workflow permissions: read repository contents
- Allow GitHub Actions to create and approve pull requests: off
- Require approval for first-time contributors: on
- Allowed actions: selected or verified actions only

## Branch Protection / Ruleset For `main`

- Require a pull request before merging
- Require at least 1 approval
- Require review from Code Owners
- Dismiss stale approvals when new commits are pushed
- Require status checks to pass
- Require branches to be up to date before merging
- Require conversation resolution before merging
- Block force pushes
- Block deletions
- Restrict who can push to matching branches

## High-Risk Path Ruleset

Apply stricter manual review to:

- `SKILL.md`
- `skills/**`
- `.github/workflows/**`
- `.github/CODEOWNERS`
- `scripts/github/**`
- `schemas/**`
- `docs/governance/**`
- `candidates/core/**`
- `candidates/reviewed/**`

These paths should require CODEOWNERS review and should not allow auto-merge.
