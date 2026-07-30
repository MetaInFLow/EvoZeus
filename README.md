<h1 align="center">
  <img src="assets/icons/evozeus-gold-128.png" alt="EvoZeus" width="44"><br>
  EvoZeus
</h1>

<p align="center">
  <strong>Turn real Agent work into verified improvements.</strong>
</p>

<p align="center">
  <a href="docs/README.zh-CN.md">简体中文</a> ·
  <a href="#start-here">Start here</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#safety">Safety</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <a href="https://github.com/MetaInFLow/EvoZeus/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/MetaInFLow/EvoZeus?display_name=tag"></a>
  <a href="https://github.com/MetaInFLow/EvoZeus/actions/workflows/ci.yml"><img alt="Product CI" src="https://github.com/MetaInFLow/EvoZeus/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center">
  <img src="assets/evozeus-banner.png" alt="EvoZeus reviews Agent work with evidence" width="100%">
</p>

EvoZeus reviews what happened in a real Agent task, identifies the lesson that can improve the next run, and routes an approved change into a reusable artifact. It is designed for teams building Skills, plugins, Agent workflows, and other Skillware.

```text
Agent work → Evidence → Judgment → Lesson → Verified improvement
```

## Why EvoZeus

Agent teams already have logs, chat histories, diffs, errors, and user corrections. The hard part is deciding which observations deserve action and proving that the resulting change actually helped.

EvoZeus provides that judgment loop:

- review one task or a set of sessions with evidence;
- separate product, Skill, environment, and execution problems;
- ask before recording a reusable Lesson;
- preserve the Lesson as a Case, rule, habit, Skill change, or environment fix;
- connect an independent Skillware repository to a governed evolution lifecycle.

## Start here

Enable the EvoZeus plugin in a compatible Agent host, then ask for the outcome you want. The public plugin distribution is introduced with the v0.4 product line; until that release is published, this repository is the development source.

Try one of these:

```text
复盘这次 Agent 执行，找出值得保留、修复或进化的内容。
```

```text
把这条已确认的 Lesson 保存为可追踪的改进。
```

```text
检查 EvoZeus 的 stable/UAT 状态，并告诉我唯一下一步。
```

EvoZeus responds inside the normal conversation. Lifecycle events use a compact marker:

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜版本检查不应阻断用户的真实任务。要记录下来吗？
```

No raw JSON block is shown for a normal Lesson prompt, and nothing is recorded before confirmation.

Host support determines how the Lesson check starts:

| Host | Behavior |
| --- | --- |
| Claude Code plugin | The built-in `SessionStart` adapter quietly loads the Lesson-check contract for startup, resume, clear, and compact. It performs no write and shows no banner. |
| Codex plugin | EvoZeus is selected from explicit or semantically matching requests. The current Codex plugin manifest has no session hook, so all-chat automatic detection is not claimed. |

In both hosts, EvoZeus finishes the user's task first and asks before recording any Lesson.

## How it works

### 1. Review

EvoZeus reads only the evidence placed in scope: the current conversation, an explicit file, a diff, a report, or an approved local session source.

### 2. Judge

Each meaningful finding receives an evidence-backed route such as Preserve, Promote to Skill, Keep as Habit, Fix Environment, Reject Pattern, or Open Case.

### 3. Confirm

When a reusable Lesson appears, EvoZeus summarizes it in one sentence and asks whether to record it.

### 4. Improve

Confirmed Lessons become reviewable artifacts. Changes to an independent Skillware repository can use [EvoZeus CoEvolve](https://github.com/MetaInFLow/EvoZeus-CoEvolve) for Harness, feedback, UAT, and release governance.

## What ships in the product

EvoZeus is one local product and one versioned release:

| Surface | Purpose |
| --- | --- |
| Agent plugin | Natural-language entry and task routing |
| User Skills | Review, capture, evolve, and maintenance workflows |
| Product CLI | Stable/UAT alignment, Doctor, update, and rollback |
| Built-in Runtime | Local evidence processing and reports |
| Built-in Session Signal pack | Official review signals and Factor tools |
| Optional CoEvolve extension | Evolution lifecycle for independent Skillware repositories |

Runtime and Session Signal are internal modules of this repository. They share the EvoZeus product version and do not require separate user updates.

## Stable and UAT

- `stable` is an immutable formal release.
- `uat` is one mutable test candidate.
- A UAT fix replaces the current UAT candidate; it never creates a second user-visible UAT.
- Stable and UAT use isolated code and local state.
- Promotion publishes the exact verified UAT source as Stable.

Read [ADR-0003](docs/decisions/ADR-0003-stable-single-uat-channel-model.md) for channel semantics and [ADR-0005](docs/decisions/ADR-0005-plugin-first-monorepo-and-repo-scoped-harness.md) for the product architecture.

## Repository evolution

An Evolution Harness belongs to a Git repository, because Issues, PRs, ownership, UAT, releases, and rollback all live at that boundary.

- one independent Git repository may own one root Harness;
- packages, packs, apps, and Skill directories inherit their repository Harness;
- nested Harness directories are rejected by CI;
- Harness upgrades and pushes require verified `ADMIN` permission on the target repository.

See the [Harness boundary policy](docs/governance/harness-boundary-policy.md).

## Safety

- Raw private sessions stay local by default.
- EvoZeus does not upload sessions automatically.
- EvoZeus asks before persistent local writes, GitHub changes, installs, updates, or external uploads.
- Public artifacts must remove secrets, customer data, private paths, unnecessary identities, and unreleased code.
- Running an older Skill does not silently overwrite the Stable installation.

## For maintainers

```bash
npm ci
npm test
npm run test:python
python3 scripts/check_pr_ready.py --allow-cross-layer
```

Key references:

- [Architecture and migration design](docs/design/active/design_doc-v0.5-plugin-monorepo.md)
- [Canonical repository topology](docs/governance/repository-topology.md)
- [Release and promotion policy](docs/governance/release-and-promotion-policy.md)
- [Plugin user entry](skills/using-evozeus/SKILL.md)
- [Maintainer Skills](maintainer/skills/index/SKILL.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Related repository

- [MetaInFlow/EvoZeus-CoEvolve](https://github.com/MetaInFLow/EvoZeus-CoEvolve) — optional evolution extension and Harness SDK for independent Skillware repositories.

## License

MIT. See [LICENSE](LICENSE).
