---
name: evozeus-factor-authoring
description: Use when authoring, reviewing, refining, or promoting an EvoZeus Factor or judgment criterion from session evidence.
---

# EvoZeus-Factor Authoring

A Factor is a reusable judgment criterion. It should help reviewers make a more consistent Verdict; it should not become a vague principle or motivational sentence.

## Factor Requirements

A valid Factor should include:

- stable name
- purpose
- when to apply
- when not to apply
- observable signals
- evidence grade required
- positive and negative examples
- failure mode it prevents
- relation to existing ontology terms

Use `../../../docs/reference/ontology.md` for artifact boundaries and `../../../docs/reference/evidence-grading.md` for proof strength.

## Promotion Gate

Promote only when:

- the Factor is supported by real Session or Case evidence
- the evidence can be redacted safely
- it does not duplicate an existing Factor, Pattern, or Review Contract rule
- a reviewer can apply it without knowing the original private session
- rejection criteria are clear

## Repository Route

Use the public `EvoZeus` repo for Factor proposals, Candidate PRs, registry references, and governance changes.

Route assets as follows:

| Asset | Repo |
| --- | --- |
| Built-in official Factor | `EvoZeus/packs/session-signal/` |
| Built-in scanner or runner | `EvoZeus/packages/runtime/` |
| Third-party Factor pack or scanner | Independent extension Repo |
| Stable third-party registry pointer | `EvoZeus/factors/` |

Do not place raw private session evidence in any public Repo. Executable changes require high-risk owner review and the full product or extension UAT gate.

## Common Rejections

- too broad to evaluate
- only restates common sense
- depends on private context
- mixes Factor with Skill or runtime behavior
- lacks negative examples
- cannot be tied to observable evidence
