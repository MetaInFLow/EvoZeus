---
name: evozeus-factor-authoring
description: Use when an agent is inspecting, enabling, writing, updating, reviewing, or rolling back EvoZeus factors or factor library manifests.
---

# EvoZeus Factor Authoring

Use this skill for factor library work.

## When to Use

- Inspecting a factor manifest.
- Binding a factor to an analysis framework stage.
- Writing or reviewing factor input and output contracts.
- Enabling, updating, disabling, or rolling back factors.
- Explaining heavy dependencies, model calls, network calls, or privacy behavior.

## Required Factor Manifest Fields

```text
id
version
stage
input_contract
output_contract
privacy_level
dependencies
fallback
rollback
```

## Rules

- Default factors should be light, explainable, disableable, and rollbackable.
- Heavy factors and external dependencies require explicit approval.
- Factor Result must remain stable enough for reports and community review.
