# Factors

This directory is the public Factor registry surface for the `EvoZeus` protocol repo.
It is not the storage location for executable Factor packs, scanner modules, or unreviewed
Factor submissions.

## Repository Boundary

| Asset | Primary location |
| --- | --- |
| Factor proposal / Candidate | GitHub issue or Candidate PR in `EvoZeus` |
| Draft Factor pack or scanner module | `evozeus-factor-lab` |
| Reviewed but unreleased Factor asset | `evozeus-factor-lab/reviewed/` |
| Official released Factor pack | `evozeus-factors-official` |
| Stable public registry pointer | `EvoZeus` main registry / docs |

## Factor Contract

A Factor is a reusable judgment rule that produces tags or supports verdicts.

A Factor should define:

- trigger condition
- required evidence
- possible tags or verdicts
- failure modes
- privacy constraints
- promotion source and review state

Factors are not prompts by default. They can be simple checks, heuristics, scripts,
or model-assisted reviewers. Executable code must be reviewed through the Factor lab
and official release flow before it is referenced by the main registry.
