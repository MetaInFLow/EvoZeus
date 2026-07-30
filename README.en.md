<h1 align="center">
  <img src="assets/icons/evozeus-gold-128.png" alt="EvoZeus" width="44"><br>
  EvoZeus
</h1>

<p align="center">
  <strong>Turn real Agent work into verified improvements.</strong>
</p>

> Origin: EvoZeus came from a retrospective between [Anthony](https://github.com/HaodiFan) and [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) after a hackathon that did not go well.

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="#use-cases">Use Cases</a> ·
  <a href="#see-evozeus-in-action">Demos</a> ·
  <a href="#install-evozeus">Install</a> ·
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

EvoZeus reviews what happened in a real Agent task, identifies the lesson that can improve the next run, and routes an approved change into a reusable artifact. It is designed for teams building Skills, plugins, Agent workflows, and other Skillware.

```text
Agent work → Evidence → Judgment → Lesson → Verified improvement
```

## Use Cases

EvoZeus is designed for teams that need to ship Agent products early and improve them through real use. Two scenarios define the current product boundary.

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>OPC · From fast MVP to engineered product</h3>
      <p><strong>For</strong><br>A One Person Company building products with Agents.</p>
      <p><strong>Core problem</strong><br>The MVP can launch quickly, but real-user issues scatter and the product stays at the “it runs” stage.</p>
      <p><strong>Improvement loop</strong><br><code>Fast MVP → Real use → Lesson → Fix → UAT → Stable</code></p>
      <p><strong>How EvoZeus helps</strong></p>
      <ul>
        <li>Launch early and expose boundaries through real use;</li>
        <li>turn corrections and failures into reusable Lessons;</li>
        <li>separate product, Skill, environment, and execution problems;</li>
        <li>route approved changes through verification, one UAT, and release.</li>
      </ul>
      <p><strong>Outcome</strong><br>Keep MVP speed while building verifiable, maintainable, and reversible engineering quality.</p>
    </td>
    <td width="50%" valign="top">
      <h3>FDE · From customer delivery to continuous improvement</h3>
      <p><strong>For</strong><br>Forward Deployed Engineers and teams delivering Skills into customer workflows.</p>
      <p><strong>Core problem</strong><br>Feedback spreads across chats, support messages, demos, and acceptance sessions after delivery.</p>
      <p><strong>Improvement loop</strong><br><code>Deliver Skill → Customer use → Confirm Lesson → Repo change → Customer UAT → Release</code></p>
      <p><strong>How EvoZeus helps</strong></p>
      <ul>
        <li>Attach a governed evolution Harness to the independent Skill repository;</li>
        <li>surface reusable Lessons inside the normal working conversation;</li>
        <li>ask and redact before recording while raw sessions stay local by default;</li>
        <li>connect feedback, changes, verification, UAT, release, and rollback.</li>
      </ul>
      <p><strong>Outcome</strong><br>Turn one-off delivery into a maintainable, verifiable, and transferable Skill product.</p>
    </td>
  </tr>
</table>

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

1. resolve the latest immutable Stable release and verify its checksum;
2. explain the local writes and ask for approval before installation or registration;
3. install Stable, then verify the active channel, version, product manifest, and Doctor result.

The website remains the canonical installation handoff, so this README does not duplicate a second set of installer commands. UAT remains a separate, explicit choice after Stable is healthy.

## Try a concrete Demo Skill

[Enterprise AI Scenario Map Skill](https://github.com/MetaInFLow/Enterprise-ai-scenario-map-skill) is the concrete business demo for learning how EvoZeus is used around a real Skill. It researches a company, generates 30+ AI opportunities, prioritizes them, and proposes an implementation path.

```text
Use the Enterprise AI Scenario Map Skill to create a standard AI scenario map for a B2B software services company.
```

Follow one complete EvoZeus journey:

| Moment | Business action | EvoZeus action |
| --- | --- | --- |
| 1. Run | Generate the scenario map with the Demo Skill | Show the EvoZeus product channel and identify the target Skill; include Harness identity when the target repository already has one |
| 2. Correct | Point out a concrete gap, such as missing evidence or a missing Markdown deliverable | Finish the business correction and summarize one reusable Lesson |
| 3. Confirm | Decide whether the Lesson should be recorded | Create a Skill Feedback Issue only after confirmation |
| 4. Evolve | Separately authorize repository changes | Attach or follow the repository Harness, then route the approved change through Design, PR, verification, UAT, and Release |

The Demo explains product usage. Installation and registration continue to use the official website `/skill` entry above.

## Use EvoZeus

After installation, try one of these:

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
