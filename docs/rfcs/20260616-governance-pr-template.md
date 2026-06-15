# RFC: Governance PR Template And Automation Gates

- Status: accepted-for-implementation
- Date: 2026-06-16

## Problem

EvoZeus cannot rely on maintainer intuition for PR routing. Contribution quality depends on proof, privacy, Candidate ontology, owner review, and queue discipline.

## Decision

Implement a minimal governance stack:

```text
rules -> templates -> labels -> CODEOWNERS -> dry-run gates -> maintainer playbook
```

Automation may label and comment, but must not approve, merge, promote core Candidates, or publish private evidence.

## Rollout

1. Add PR/issue templates and labels.
2. Add CODEOWNERS and protected path documentation.
3. Add dry-run label/proof/privacy/schema/dirty/queue gates.
4. Enable branch protection and code owner review in GitHub settings.
5. Consider enforcement only after a dry-run period.
