---
name: evozeus-scanner-pack-authoring
description: Use when authoring, reviewing, routing, or submitting executable Factor packs, scanner modules, scanner packs, resolvers, or pack permission declarations.
---

# EvoZeus Scanner Pack Authoring

Executable packs and scanner modules are components. They do not belong in the `EvoZeus` main repo; they start in `evozeus-factor-lab` and can become official only through release review.

## When To Use

Use this skill for:

- executable Factor pack
- scanner module
- scanner pack
- resolver script
- file/session ingestion logic
- pack permission declaration
- dependency, sandbox, or supply-chain review

## Route

```text
EvoZeus Case / Candidate
  -> maintainer route
  -> evozeus-factor-lab submission
  -> evidence + privacy + scanner permission gates
  -> reviewed / rejected
  -> optional promotion to evozeus-factors-official
```

## Required Packet

Every pack or scanner submission should include:

- source Case or Candidate link
- evidence packet
- purpose and trigger
- input files, env vars, commands, and network behavior
- output files, stdout, report fields, and local state changes
- dependencies, lockfile, license, checksum, or sandbox note
- failure modes and rollback path
- privacy note

## Read Next

- `../evozeus-factor-authoring/SKILL.md` for semantic Factor quality.
- `../evozeus-redaction/SKILL.md` before public evidence.
- `../../docs/reference/scanner-pack-protocol.md` for scanner pack contract.
- `evozeus-factor-lab/templates/scanner-submission.md` when working inside the lab repo.

## Boundaries

- Do not put executable scanner or pack code in the main repo.
- Do not treat lab review as official release.
- Do not let runtime consume lab moving branch.
- Do not skip security review for scanner code.
