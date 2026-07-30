---
name: evolve-skillware-repo
description: Use when the user asks to attach, inspect, upgrade, or repair EvoZeus CoEvolve for a Skill, plugin, or Skillware codebase. Enforce that only an independent Git repository root can own a Harness.
---

# Evolve a Skillware Repo

## Resolve the governance unit

1. Resolve the target's Git root.
2. If the target is a Skill, package, pack, or app inside that Repo, use the Git root as the evolution target.
3. If no Git root exists, provide a plan and explain that a Harness cannot be attached until the target becomes an independent Repo.
4. Check for the one allowed root Harness: `.evozeus-wrapper/`.
5. Treat `.evozeus_evoinfra/` as a migration signal, never as a new installation target.

## Modes

| Request | Action |
| --- | --- |
| Inspect/status | Read-only diagnosis |
| Attach | Generate the exact root-level Harness plan; write only with approval |
| Upgrade | Verify maintainer authority, current/target version, migration and tests |
| Upgrade all | Inventory registered independent Repos; ordinary users receive a plan, authorized maintainers may create per-Repo PRs |

Harness upgrades and pushes require verified target Repo `ADMIN` permission and maintainer policy authorization. UAT changes update the single UAT candidate for that Repo; stable releases use the verified UAT Commit.

## Output

Use this lifecycle tag for version decisions:

```text
🧭 EvoZeus · 版本状态｜<repo> · <stable|uat|development> · <current → target>
```

After authorized edits start, use `🛠️ EvoZeus · 进化中`. Use `🧪 EvoZeus · UAT 就绪` only after the unique UAT candidate passes its gates, and `🚀 EvoZeus · 已发布` only after the Stable Release exists.

## Verification target

- Target is an independent Git Repo root.
- No nested Harness exists.
- Exact current and target versions are known.
- Upgrade validation passes before PR or UAT promotion.
- Stable is untouched during UAT repair.
