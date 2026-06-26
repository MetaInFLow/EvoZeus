---
name: evozeus-registry-release
description: Use when working on EvoZeus registry pointers, default official factors, official release references, manifest compatibility, checksum, SBOM, attestation, deprecation, or yank behavior.
---

# EvoZeus Registry Release

The main repo owns registry pointers, not pack bodies. Runtime uses registry pointers to find official releases and then verifies immutable release metadata.

## Registry Consumption Flow

```text
EvoZeus registry pointer
  -> official release manifest
  -> checksum
  -> SBOM / attestation
  -> selected pack
  -> runtime lockfile
```

## Main Repo Responsibilities

- define registry schema and compatibility rules
- point to allowlisted official releases
- define default official factor set
- track channel, version pinning, review state, deprecation, and yank behavior
- route official pack body changes to `evozeus-session-signal-skill`

## Default Official Factors

Default factors must be explicit, not silent:

- default means recommended, not automatically enabled
- runtime must show what will be installed or enabled
- runtime must verify manifest, checksum, SBOM / attestation, compatibility, and review state
- missing release metadata blocks enablement

## Boundaries

- Do not store official pack bodies in the main repo.
- Do not reference lab moving branches.
- Do not invent manifests, checksums, or reviewed status.
- Do not let runtime bypass the registry pointer.
