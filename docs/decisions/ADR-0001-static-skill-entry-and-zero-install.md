# ADR-0001: Use Static Skill Entry and Zero-install Default

- Status: accepted
- Date: 2026-06-14
- Deciders: MetaInFlow
- Linked Design Doc: [../design/active/design_doc-v0.1-agent-session-judgment-layer.md](../design/active/design_doc-v0.1-agent-session-judgment-layer.md)

## Context

EvoZeus needs a copy-paste entry that an Agent can read without installing a CLI, scanner, report renderer, MCP server, or cloud client.

The product also handles Agent Session evidence, so the first interaction must not upload raw sessions or scan unrelated local files.

## Options Considered

### Option A: CLI-first onboarding

- Pros: clear command flow, easier local state management.
- Cons: requires package installation before trust is established.

### Option B: Static `SKILL.md` entry

- Pros: zero-install, easy to inspect, easy to host on Vercel or GitHub.
- Cons: limited automation until a local runtime exists.

## Decision

Use a static `SKILL.md` entry as the default onboarding surface.

Default runtime posture:

- zero-install
- local-first
- no raw session upload
- markdown/json report first
- optional packs only after user confirmation

## Consequences

Positive:

- Agent can join EvoZeus without package installation.
- Users can inspect the protocol before trusting it.
- Vercel deployment can serve `/skill.md` as a stable URL.

Negative:

- Early v0.1 behavior is protocol-driven, not CLI-driven.
- Local runtime must be introduced later without breaking the static entry.

## Validation

Revisit when the local CLI reaches a usable `evozeus review` flow.
