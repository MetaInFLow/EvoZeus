---
name: evozeus-skill-index
description: Use when an agent needs to choose an EvoZeus scenario skill for session judgment, repo development, reports, factors, community contribution, redaction, debugging, or skill proposal work.
---

# EvoZeus Skill Index

This skill is the router for EvoZeus scenario skills. The root `SKILL.md` remains the zero-install entry. Local scenario skills can be read directly from `skills/<skill-id>/SKILL.md`; remote or downloadable scenario skills load only after a matched scenario is clear and the user approves download or activation.

Skill routing is part of EvoZeus Skill Driven Software: software behavior is shaped by code, scenario skills, factors, rules, reports, and runtime.

## Mode Selection

| Mode | Use When | Start With |
| --- | --- | --- |
| Use EvoZeus | Session judgment, Evidence Report, Case Draft, report reading, factor inspection, or community contribution preparation | Root `SKILL.md`, then the matched scenario skill |
| Develop EvoZeus | Repo implementation, docs structure, runtime / TUI, protocol, governance, templates, ADRs, validation rules, or skill package edits | `evozeus-development` plus `docs/governance/change-scope-policy.md` |

Do not route a development request into session judgment just because the root skill mentions Case, Evidence, or Verdict.

## Routing Matrix

| Scenario | Skill | Use When |
| --- | --- | --- |
| First session judgment | `evozeus` root skill | The agent only needs to produce a Session Verdict Card |
| Develop EvoZeus infra | `evozeus-development` | Changing repo infrastructure, docs structure, runtime architecture, templates, ADRs, or validation rules |
| Implement runtime / TUI | `evozeus-runtime` | Building TUI, browser companion, doctor, status, local workspace, or authorization gates |
| Work on reports | `evozeus-reporting` | Creating, reading, validating, or changing report types and report templates |
| Work on factor library | `evozeus-factor-authoring` | Inspecting, enabling, writing, updating, or reviewing factors |
| Prepare community contribution | `evozeus-community-contribution` | Turning a local Case, Rule, Factor, or Golden Case into a public contribution |
| Redact private context | `evozeus-redaction` | Preparing public issues, PRs, examples, reports, or community artifacts |
| Debug blocked tasks | `evozeus-doctor-debugging` | Debugging failed, delayed, or blocked Agent work |
| Draft scenario skill | `evozeus-skill-proposal` | Turning repeated corrections or strong adhoc results into a candidate skill |

## Download Gate

Before downloading or enabling a scenario skill, show:

```text
skill_id
version
matched_scenario
why_this_skill
files_or_templates_included
dependencies
permissions
inputs
outputs
privacy_behavior
rollback
```

Do not install, update, write local skill files, upload raw session data, or create GitHub issues / PRs before explicit user approval.

## Asset Boundaries

| Asset | Role |
| --- | --- |
| Skill | Teaches the Agent how to act in a scenario |
| Factor | Judges evidence inside an analysis stage |
| Report | Presents evidence, signals, verdict, and next action |
| Rule | Reusable scenario-specific judgment or action rule |
