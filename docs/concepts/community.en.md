# Community Keywords

- Status: active
- Last updated: 2026-06-15
- Language: en

## Overview

The community layer turns redacted personal experience into shared cases and a rule graph.

```text
Private Case
-> Redaction
-> Scenario + Rule Proposal
-> Issue / PR
-> Accepted Rule / Golden Case
```

## Keywords

| Term | Meaning | Use |
| --- | --- | --- |
| Scenario | The context where a rule applies | Defines rule boundaries |
| Rule | An executable judgment or behavior rule | Guides future Agent behavior |
| Rule Proposal | A rule draft waiting for review | Enters issue / PR flow |
| Redacted Case | A Case after privacy cleanup | Public contribution |
| Golden Case | A high-quality, reviewable, reusable Case | Example and evidence source |
| Accepted Rule | A public rule accepted into the library | Can be referenced by Agents |
| Disputed Rule | A rule with counterexamples or boundary conflicts | Needs more Cases |
| Rejected Pattern | A low-value or risky behavior pattern | Prevents repeated mistakes |
| Contribution History | Historical contribution records | Helps new contributors learn norms |

## Scenario

Scenario describes the context where a rule applies.

Suggested fields:

- task type
- agent type
- skill usage
- tool usage
- failure / success type
- user preference tag
- privacy tag
- boundary

Example:

```text
task type: debug
agent type: Codex
failure type: tool failure
user preference: evidence-first
boundary: only applies when auth check succeeds and push still fails
```

## Rule

Rule is an executable instruction for Agents.

Shape:

```text
When <scenario>,
if <evidence pattern>,
then <recommended behavior>,
unless <boundary>.
```

Example:

```text
When debugging GitHub delivery,
if auth status succeeds but push fails with timeout,
then inspect network / proxy before asking the user to re-authenticate,
unless the token check itself fails.
```

## Contribution States

| State | Meaning |
| --- | --- |
| `candidate` | Valuable and under review |
| `accepted` | Evidence supports adding it to the public library |
| `disputed` | Counterexamples or boundary disputes exist |
| `deprecated` | Replaced by a newer rule or no longer recommended |
| `rejected` | Low-value, risky, or insufficiently supported |

## Contribution Gates

Public contribution must pass:

- Evidence Gate: concrete evidence exists.
- Privacy Gate: public content is safe.
- Value Gate: another user or Agent can reuse it.
- Operational Gate: the recommended action is executable.

## GitHub Mapping

| GitHub Surface | Meaning |
| --- | --- |
| Issue | candidate graph fragment |
| PR | curated graph fragment |
| main | accepted rule library |

## Related Docs

- [Contributing](../../CONTRIBUTING.md)
- [Privacy and Redaction](../governance/privacy-and-redaction.md)
- [Verdicts](../reference/verdicts.md)
- [Factor Analysis Protocol](../reference/factor-analysis-protocol.md)
