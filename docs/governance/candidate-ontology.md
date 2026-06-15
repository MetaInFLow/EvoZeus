# Candidate Ontology

- Status: active
- Last updated: 2026-06-16

This policy defines what can enter the EvoZeus Candidate lifecycle. It complements `docs/reference/ontology.md`.

## Candidate Is

A Candidate is a session-derived reusable judgment unit with enough evidence for another reviewer or agent to evaluate.

Required fields:

- `source_session`
- `observed_behavior`
- `evidence`
- `pattern`
- `operational_rule`
- `when_to_use`
- `when_not_to_use`
- `counterexamples`
- `privacy_review`
- `status`

## Candidate Is Not

Candidate is not:

- prompt tip
- productivity advice
- philosophical insight
- best-practice slogan
- blog summary
- vague review opinion
- one-off private workaround

## Lifecycle

```text
draft -> community -> reviewed -> core -> deprecated
draft -> rejected
reviewed -> deprecated
core -> deprecated
```

Promotion gates live in `docs/governance/candidate-lifecycle.md`. Rejection reasons should map to `docs/reference/negative-patterns.md`.
