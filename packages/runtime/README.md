# EvoZeus Runtime

Built-in local execution engine for [EvoZeus](../../README.md).

## Role

```text
approved local source
→ scanner
→ SessionEnvelope
→ selected Factors
→ local ledger
→ report
```

Runtime belongs to the EvoZeus main product. It ships inside the same Commit, Stable/UAT channel, archive, and rollback unit. Users do not install or update an `EvoZeus-infra` component separately.

## Safety defaults

- local-first;
- raw-session upload off;
- network off unless a selected capability requires and receives approval;
- factors explicitly selected;
- runtime state isolated by EvoZeus Stable/UAT channel;
- reports read the local ledger and do not rescan implicitly.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/evozeus_runtime/scanners/` | Session provider adapters |
| `src/evozeus_runtime/factors/` | Factor pack loading and execution contracts |
| `src/evozeus_runtime/runner/` | Isolated factor execution |
| `src/evozeus_runtime/ledger/` | Local evidence/result storage |
| `src/evozeus_runtime/reports/` | Markdown, JSON, and HTML outputs |
| `src/evozeus_runtime/cli/` | Internal Runtime CLI |
| `tests/` | Contract, unit, and integration tests |

The built-in Session Signal pack resolves from [`../../packs/session-signal/`](../../packs/session-signal/). `--official-repo-root` remains a development override.

## Development

From the EvoZeus repository root:

```bash
npm run test:runtime
```

For an editable environment:

```bash
python3 -m pip install -e "packages/runtime[dev]" -e "packs/session-signal[nlp]"
```

Changes affecting channels, installation, permissions, or user-visible output must also pass:

```bash
npm test
```

## Governance

- Issues, PRs, UAT, Releases, and versioning belong to `MetaInFLow/EvoZeus`.
- This package inherits the EvoZeus root Harness.
- A nested `.evozeus-wrapper/` is rejected by CI.
- Migration provenance is recorded in [MIGRATION.md](MIGRATION.md).
