# Changelog

## [Unreleased]

### Added

- Added the read-only `evozeus.session-signal.lesson-candidate.v1` method, CLI and method contract for normal Chat correction and durable-rule candidates.
- Added deterministic target selection using cwd containment, canonical repository identity or one unique caller-provided alias.

### Security

- The method performs no persistence or network access and does not return raw prompts, local paths or signal identifiers.

### Fixed

- Synchronized the Lesson candidate method and its regression suite byte-for-byte from Session Signal revision `5d6ccce7eb821809e8594ecc3968e26211b31f12`, including choice-question neutralization, Java `Caused by` filtering, present-tense attribution handling and visible-prose-only alias routing.
- Preserved durable-rule scope across natural comma clauses and generalized reporting-verb attribution to named sources and caller-defined roles.
- Recognized comma-delimited log milliseconds and stopped inferring unregistered repository basenames as target aliases.
- Distinguished Chinese report nouns from reporting verbs, accepted contracted durable prohibitions, and filtered RFC 3339 `Z` log timestamps.
- Distinguished past-participle answer modifiers, scoped Python ExceptionGroup tracebacks, and aligned lowercase direct-answer sentence boundaries.
- Required log levels after timestamps, added bare result/output corrections, and recognized sentence-initial `Never` prohibitions.
- Scoped arbitrary exception terminals to tracebacks, required imperative/modal English durable rules, and extended self-doubt across colons.

### Verification

- Added 147 deterministic Lesson candidate tests, including pasted-log, attribution, traceback, durable-scope, question-scope, alias and subprocess privacy regressions.

## [v0.1.0] - 2026-07-26

### Added

- Session Signal SKILL synthesis method and seven official Factor tools.
- Golden-session evaluation, official Factor contracts, privacy boundaries and packaged resource checks.
- Stable and single-UAT release distribution through the EvoZeus product manifest.

### Verification

- `python -m pytest -q` (97 passed, 2 optional checks skipped, 18 subtests passed).
- `python scripts/validate_official_factor_spec.py factors/*/spec.json`.
