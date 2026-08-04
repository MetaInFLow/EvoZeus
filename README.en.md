<h1 align="center">
  <img src="assets/icons/evozeus-gold-128.png" alt="EvoZeus" width="44"><br>
  EvoZeus
</h1>

<p align="center">
  <strong>Build an AI usage profile from approved local Codex history, and attach a governed evolution Harness to independent Skillware.</strong>
</p>

> Origin: EvoZeus came from a retrospective between [Anthony](https://github.com/HaodiFan) and [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) after a hackathon that did not go well.

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="#two-primary-capabilities">Primary capabilities</a> ·
  <a href="#use-cases">Use Cases</a> ·
  <a href="#see-evozeus-in-action">Demos</a> ·
  <a href="#install-evozeus">Install</a> ·
  <a href="#user-visible-lifecycle-markers">Visible markers</a> ·
  <a href="#try-a-concrete-demo-skill">Demo Skill</a> ·
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

EvoZeus first helps users understand how they work with AI and helps delivered Skillware absorb real feedback. The current profile route supports local Codex history only. Reading that history, running Factors, and writing reports require explicit approval. Target-repository changes and GitHub actions require separate authorization.

```text
Agent work → Evidence → Judgment → Lesson → Verified improvement
```

## Two primary capabilities

1. **Build an AI usage profile:** the current release supports local Codex history only. Start with a read-only scan plan. After the user explicitly approves Codex-history access and report writes, generate an evidence-backed view of AI usage habits, strengths, blind spots, and a session-derived personality tendency such as `INTJ tendency`. Thin evidence produces an explicit insufficient-evidence result.
2. **Continuously evolve Skillware:** inspect the independent Git repository containing a specified Skill, plugin, or path, prepare an attachment plan, and attach the [EvoZeus-CoEvolve](https://github.com/MetaInFLow/EvoZeus-CoEvolve) Harness after approval so real feedback can enter a governed Feedback, Design, PR, UAT, and Release loop.

Single-Session review, Lesson capture, feature discovery, Stable/UAT, Doctor, update, and rollback remain available as supporting capabilities.

## Use Cases

EvoZeus is designed for teams that need to ship Agent products early and improve them through real use. Two scenarios define the current product boundary.

| **OPC · From fast MVP to engineered product** | **FDE · From customer delivery to continuous improvement** |
| --- | --- |
| **For**<br>A One Person Company building products with Agents. | **For**<br>Forward Deployed Engineers and teams delivering Skills into customer workflows. |
| **Core problem**<br>The MVP can launch quickly, but real-user issues scatter and the product stays at the “it runs” stage. | **Core problem**<br>Feedback spreads across chats, support messages, demos, and acceptance sessions after delivery. |
| **Improvement loop**<br>`Fast MVP → Real use → Lesson → Fix → UAT → Stable` | **Improvement loop**<br>`Deliver Skill → Customer use → Confirm Lesson → Repo change → Customer UAT → Release` |
| **How EvoZeus helps**<br>① Launch early and expose boundaries through real use.<br>② Turn corrections and failures into reusable Lessons.<br>③ Separate product, Skill, environment, and execution problems.<br>④ Route approved changes through verification, one UAT, and release. | **How EvoZeus helps**<br>① Attach a governed evolution Harness to the independent Skill repository.<br>② Surface reusable Lessons inside the normal working conversation.<br>③ Ask and redact before recording while raw sessions stay local by default.<br>④ Connect feedback, changes, verification, UAT, release, and rollback. |
| **Outcome**<br>Keep MVP speed while building verifiable, maintainable, and reversible engineering quality. | **Outcome**<br>Turn one-off delivery into a maintainable, verifiable, and transferable Skill product. |

## Why EvoZeus

Agent teams already have logs, chat histories, diffs, errors, and user corrections. The hard part is deciding which observations deserve action and proving that the resulting change actually helped.

EvoZeus provides that judgment loop:

- review one task or a set of sessions with evidence;
- separate product, Skill, environment, and execution problems;
- ask before recording a reusable Lesson;
- preserve the Lesson as a Case, rule, habit, Skill change, or environment fix;
- connect an independent Skillware repository to a governed evolution lifecycle.

## See EvoZeus in action

These two short demos show the complete business loop: first make a useful Skill maintainable, then turn a dissatisfied user response into an improvement that the team can review.

### 1. Give a Skill a governed lifecycle

Connect an independent Skill repository to source, version, validation, feedback, and release governance while preserving its business behavior.

<p align="center">
  <img src="assets/demos/skill-evolution-harness.gif" alt="50-second demo: attach an EvoZeus evolution Harness to an independent Skill repository" width="100%">
</p>

<sub>50-second looping demo · [Download the original MP4](assets/demos/skill-evolution-harness.mp4?raw=1)</sub>

### 2. Turn dissatisfaction into traceable improvement

Keep the normal conversation intact, ask before recording the reusable Lesson, and create a reviewable Feedback Issue without silently starting a fix.

<p align="center">
  <img src="assets/demos/managed-feedback-loop.gif" alt="39-second demo: capture user dissatisfaction as an authorized Skill Feedback Issue" width="100%">
</p>

<sub>39-second looping demo · [Download the original MP4](assets/demos/managed-feedback-loop.mp4?raw=1)</sub>

## Install EvoZeus

The official website owns the installation and registration journey. Open a compatible Agent host and paste one line:

```text
加入 EvoZeus: https://evozeus-community.vercel.app/skill
```

The [official Install Skill](https://evozeus-community.vercel.app/skill) will:

1. inspect the local CLI, version, Doctor, and key state read-only, then choose exactly one fresh, healthy no-op, update, repair, migration, or stop route;
2. run the same Stable preflight for a fresh candidate before any product download or `~/.evozeus` write, exposing dependencies, fallbacks, blockers, and remediation;
3. allow only `not_installed` into fresh install while preserving the current version and rollback evidence for every other route;
4. explain local writes and network behavior, then ask for approval before installation or registration;
5. detect Codex, Claude Code, or both, register the single active `evozeus` plugin, and align Runtime and plugin to one channel;
6. run Doctor after installation, enable in-channel automatic updates, and request a new chat when the host must reload.

Preflight downloads no product, extracts nothing, registers nothing, and writes nothing under `~/.evozeus`. A healthy current installation returns a strict no-op. Preflight decides whether an install route is safe; post-install Doctor verifies product integrity. Preflight v1 accepts Stable only, while UAT remains a separate installed-channel workflow after Stable is healthy.

The website remains the canonical installation handoff, so this README does not duplicate a second set of installer commands. UAT remains a separate, explicit choice after Stable is healthy.

## Try a concrete Demo Skill

[Enterprise AI Scenario Diagnosis Skill](https://github.com/MetaInFLow/diagnose-enterprise-ai-scenarios) is the real business demo for learning how EvoZeus works around a managed Skill. It has a published [Stable `v0.1.0`](https://github.com/MetaInFLow/diagnose-enterprise-ai-scenarios/releases/tag/v0.1.0). Its [Stable `SKILL.md`](https://github.com/MetaInFLow/diagnose-enterprise-ai-scenarios/blob/v0.1.0/SKILL.md) always returns three distinct candidate scenarios, one recommended scenario, and one minimum validation action with a measurable pass condition. The current `main` [Harness manifest](https://github.com/MetaInFLow/diagnose-enterprise-ai-scenarios/blob/main/.evozeus-wrapper/wrapper.json) records EvoZeus-CoEvolve `v0.14.0`, the canonical repository, and `prompt_runtime_check` integration.

```text
A company provides custom enterprise software. Sales leads arrive through multiple group chats, presales proposals depend on individual experience, and past cases are scattered. Diagnose three AI scenarios to validate first.
```

Follow one complete EvoZeus journey:

| Moment | Business action | EvoZeus action |
| --- | --- | --- |
| 1. Run | Provide the company context, ask for three priority validation scenarios, and select one recommended starting point | Verify the current repository, Harness version, and integration mode, then show the managed-run identity |
| 2. Correct | Point out that a candidate lacks available inputs, an evidence gap, or a measurable pass condition | Complete the business correction, then summarize one reusable Lesson |
| 3. Confirm | Decide whether the Lesson should be recorded | Create a Skill Feedback Issue only after confirmation |
| 4. Evolve | Separately authorize repository changes | Use the existing repository Harness to route the approved change through Design, PR, verification, UAT, and Release |

The Demo explains product usage. Installation and registration continue to use the official website `/skill` entry above.

## Use EvoZeus

After installation, start with the two primary capabilities:

```text
First prepare a plan to scan my local Codex history and wait for my explicit approval. Codex is the only supported history provider in the current release. Do not read history before approval. After approval, generate an AI usage profile covering habits, strengths, blind spots, and a session-derived personality tendency such as INTJ tendency.
```

```text
Attach a CoEvolve Harness to the independent Skillware repository I specify. Inspect it and show the plan first; wait for explicit approval before changing the repository or GitHub.
```

```text
List all EvoZeus features and check the current installation and Stable/UAT health.
```

The feature list still provides direct routes for one-Session review, recording a confirmed Lesson, Doctor, update, and rollback.

EvoZeus responds inside the normal conversation. Lifecycle events use a compact marker:

```text
🧙 EvoZeus · 捕捉到一条 Lesson｜版本检查不应阻断用户的真实任务。要记录下来吗？
```

No raw JSON block is shown for a normal Lesson prompt, and nothing is recorded before confirmation.

## User-visible lifecycle markers

EvoZeus shows one compact line only when its lifecycle state changes. Ordinary analysis and individual tool calls do not produce markers.

| Marker | Meaning |
| --- | --- |
| `🧙 EvoZeus · 已启动｜<task>` | EvoZeus was explicitly activated |
| `👁️ EvoZeus · 受管运行｜<Skillware> · <channel>` | A verified managed Skillware target is running |
| `🧙 EvoZeus · 捕捉到一条 Lesson｜<summary>。要记录下来吗？` | A reusable Lesson is proposed, not persisted |
| `📝 EvoZeus · Lesson 已记录｜<record>` | The approved Lesson was persisted |
| `🔐 EvoZeus · 等待确认｜<action>` | A specific write or external action needs approval |
| `🧭 EvoZeus · 版本状态｜<current → target>` | An install, alignment, or channel decision is pending |
| `🧭 EvoZeus · 发现更新｜<current → target>` | The selected channel has a new product version |
| `🛠️ EvoZeus · 自动更新中｜<managed surfaces>` | The product-level update transaction is running |
| `✅ EvoZeus · 自动更新完成｜<channel/version>` | The verified product update completed |
| `🛡️ EvoZeus · 自动更新失败｜<retained version>` or `恢复未完成` | The previous version remains active only after product, bootstrap, and Plugin recovery pass; otherwise manual recovery is required |
| `🛠️ EvoZeus · 进化中｜<Repo> · <change>` | An approved evolution change is executing |
| `🧪 EvoZeus · UAT 就绪｜<Repo> · <Commit>` | The single UAT candidate passed its gates |
| `🚀 EvoZeus · 已发布｜<Repo> · <Release>` | A Stable Release was published |
| `↩️ EvoZeus · 已回滚｜<channel/version>` | A verified previous version was restored |
| `🛡️ EvoZeus · 暂停｜<blocker>` | Evidence, privacy, or permission blocks progress |
| `✅ EvoZeus · 已验证｜<checks>` | Completion evidence passed |

See the [canonical event contract](docs/reference/user-visible-events.md) for exact triggers and safety rules.

Host support determines how the Lesson check starts:

| Host | Behavior |
| --- | --- |
| Claude Code plugin | The built-in `SessionStart` adapter loads the Lesson-check contract and checks the selected product channel. It stays quiet when current and shows update markers only when state changes. |
| Codex plugin | EvoZeus is selected from explicit or semantically matching requests. Version checks run when EvoZeus or a CoEvolve-managed Skill starts. |

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
- Both channels automatically check and update at product entry, with a default one-hour remote-check interval.
- Automatic updates remain in the selected channel; Stable never switches itself to UAT.
- A UAT fix replaces the current UAT candidate; it never creates a second user-visible UAT.
- Stable and UAT use isolated code and local state.
- Promotion publishes the exact verified UAT source as Stable.
- Codex and Claude expose only one active `evozeus` plugin; switching channels overwrites that plugin rather than creating a second UAT plugin.

Installed Stable `v0.4.0` and earlier need one explicit alignment into `v0.4.1+`; subsequent updates inside the selected channel are automatic. An active `v0.4.0` UAT with auto-refresh can bootstrap directly from the overwritten `uat/current` candidate.

The approved transaction used by the official installer is:

```bash
evozeus align --channel stable --host auto --approve-write --json
```

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
- Initial install approval includes verified automatic updates inside the selected channel. Channel switching, GitHub changes, and external uploads still require separate approval.
- Users can disable automatic updates or change the interval in `~/.evozeus/update-policy.json`.
- Public artifacts must remove secrets, customer data, private paths, unnecessary identities, and unreleased code.
- Running an older Skill invokes the installed launcher for an in-channel check; failed validation keeps the previous version active.

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
