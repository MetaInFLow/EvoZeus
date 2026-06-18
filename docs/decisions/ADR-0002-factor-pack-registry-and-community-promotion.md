# ADR-0002: Factor Pack Registry and Community Promotion

- Status: accepted
- Date: 2026-06-18
- Deciders: MetaInFlow
- Related Governance: [../governance/factor-registry-governance.md](../governance/factor-registry-governance.md)

## Context

EvoZeus needs a Factor library that can grow through community contribution without making the main repository heavy or unsafe to clone.

Factors can be simple review rules, but some contributions will include scanner modules that execute code. Those two asset types have different risk levels:

- `factor.yaml` is a judgment rule and should be reviewed for evidence, semantics, ontology fit, and privacy.
- scanner modules are executable code and must also be reviewed for permissions, dependencies, sandbox behavior, determinism, and supply-chain risk.

The main repository already commits to zero-install entry, local-first evidence handling, opt-in runtime packs, dry-run GitHub automation, and user-approved external upload. A large built-in Factor library would weaken those commitments.

## Decision

Use a manifest-driven Factor pack model:

```text
EvoZeus main repository
  -> protocol, schemas, installer rules, minimal builtin factors, official registry

Factor lab repositories
  -> community submissions, candidate review, rejected records, reviewed releases

Official Factor pack repositories
  -> maintainer-promoted packs, GitHub Releases, checksums, SBOM, attestations
```

The main registry does not scan a lab repository's moving branch and does not copy full Factor content by default. It only accepts a reviewed, versioned, verifiable release reference through a Registry PR.

Accepted registry entries must point to stable inputs:

- GitHub repository
- immutable tag or commit SHA
- release manifest URL
- manifest checksum
- channel
- review state
- optional artifact attestation

## Registry Rule

The main registry is a curated allowlist, not a crawler.

Valid source:

```text
GitHub Release or tag
-> release manifest
-> checksum / provenance validation
-> Registry PR
-> maintainer review
-> main registry merge
```

Invalid source:

```text
lab repo main branch
-> direct registry import
-> default user install
```

## Community Upload Rule

Community contributors submit to a lab repository first. A contribution may become:

- rejected record
- community candidate
- reviewed candidate
- release candidate
- official release candidate
- stable registry entry
- deprecated or yanked entry

PR merge in a lab repository does not mean official publication. Official publication requires promotion, release, registry validation, and maintainer review.

## Scanner Module Rule

Scanner modules are treated as executable plugins, not plain Factor metadata.

Default scanner permissions:

- no network
- read-only filesystem access
- no environment variables
- no secrets
- bounded runtime
- bounded output size
- deterministic output over fixtures

Any broader permission must be explicit in the scanner manifest and reviewed before promotion.

## Consequences

Positive:

- The main repository stays small and zero-install.
- Community contribution can scale without default trust.
- Users can selectively install individual Factors or bundles.
- Registry entries are reproducible through tag, commit, checksum, and lockfile.
- Unsafe or low-quality submissions can still create learning value as rejected records.

Negative:

- Maintainers need a separate promotion workflow.
- Users may need to understand channels such as `stable`, `reviewed`, and `community`.
- Runtime installer work must validate manifests, checksums, channels, and scanner permissions.

## Validation

This decision should be revisited when:

- EvoZeus introduces a stable CLI installer.
- scanner modules require network or write permissions.
- community submission volume makes manual maintainer promotion insufficient.
- GitHub artifact attestation or release immutability policies change the supply-chain model.
