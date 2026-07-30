# EvoZeus Release Notes

This directory is the repository source for versioned GitHub Release descriptions.

## Contract

- One file per product tag: `vMAJOR.MINOR.PATCH.md`.
- The file title must name the same product version.
- `.github/workflows/release.yml` resolves the current tag as `docs/releases/${GITHUB_REF_NAME}.md` and refuses to publish when that file is missing or empty.
- `CHANGELOG.md` remains the compact version index; GitHub Releases remain the public distribution surface.
- Versioned Release Notes must not be added to the repository root.

## History

- [v0.4.0](v0.4.0.md)
- [v0.3.5](v0.3.5.md)
- [v0.3.4](v0.3.4.md)
- [v0.3.3](v0.3.3.md)
- [v0.3.2](v0.3.2.md)
- [v0.3.1](v0.3.1.md)
- [v0.3.0](v0.3.0.md)
