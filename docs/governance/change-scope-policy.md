# Change Scope Policy

- Status: active
- Last updated: 2026-06-15
- Audience: 社区贡献者、开发者、维护者和 Agent

本文件定义 EvoZeus repo 的最小变更边界。默认原则是：一个 PR 只解决一个问题，只触碰完成这个问题所需的最小文件集合，不顺手修改规范、入口、协议或 infra。

## Change Modes

| Mode | 适用场景 | 默认可改 | 需要 linked issue / PR review | 默认禁止 |
| --- | --- | --- | --- | --- |
| Pair Contribution | 贡献一个 Scenario + Rule / Factor / Golden Case graph fragment | `cases/**`, `factors/**`, `patterns/**`, `examples/cases/**`, `examples/reports/**` | 同一贡献需要新增公开说明时，可申请改 `docs/community/**` | `SKILL.md`, `skills/**`, `docs/reference/**`, `docs/governance/**`, `docs/development/**`, `docs/design/**`, `docs/plans/**`, `docs/decisions/**`, `.github/**`, `CONTRIBUTING.md`, `SECURITY.md`, runtime / infra code |
| Community Docs / Content | 修正文档、示例、概念说明、用户入口 | `docs/start/**`, `docs/concepts/**`, `docs/community/**`, `docs/reports/**`, `docs/factors/**`, `docs/help/**`, `docs/glossary/**`, `assets/**` | `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/**`, `docs/governance/**`, `docs/reference/**` | 无 issue 背景时改 skill routing、协议 contract、ADR、开发计划或 runtime 架构 |
| Infra / Protocol Development | 修改 runtime、协议、skill routing、治理规则、开发规范、模板或架构记录 | 与 linked issue、Design Doc、Implementation Plan 或 ADR 对齐的最小文件集合 | 所有改动都需要 PR review；架构、安全、默认行为或 contract 变化需要 ADR 或明确说明为什么不需要 ADR | 把 Case / Factor 贡献和 infra 改动混在同一个 PR，除非 infra 改动是该贡献的必要前置 |

## Protected Paths

以下路径属于 protected paths。普通社区贡献和 Pair Contribution 默认不能修改：

- `SKILL.md`
- `skills/**`
- `docs/reference/**`
- `docs/governance/**`
- `docs/development/**`
- `docs/design/**`
- `docs/plans/**`
- `docs/decisions/**`
- `.github/**`
- `CONTRIBUTING.md`
- `SECURITY.md`
- runtime / infra code

修改 protected paths 时，PR 必须说明：

1. linked issue、Design Doc、Implementation Plan 或 ADR。
2. 为什么这个变更不能落在非 protected path。
3. 触碰的 contract、默认行为、隐私或授权影响。
4. 验证方式和 rollback path。

## Split Rules

- Pair Contribution 只能提交 graph fragment 本身；如果发现规范需要调整，另开 issue 或 infra PR。
- 文档修正不能顺手改 skill routing、ADR、schema、模板 contract 或 GitHub workflow。
- Infra PR 不应夹带无关 Case、Factor、Pattern 或示例扩写。
- 大范围重命名、目录迁移或术语替换必须先有 issue，并更新 [Folder Declaration](folder-declaration-v0.md)。

## Review Checklist

Reviewer 先看范围，再看内容：

1. PR 是否选对 Change Mode。
2. 改动路径是否符合该 Mode。
3. protected paths 是否有足够 issue / design / ADR 背景。
4. 是否可以拆成更小 PR。
5. 是否保留 redaction、local-first、opt-in-first 的默认边界。
