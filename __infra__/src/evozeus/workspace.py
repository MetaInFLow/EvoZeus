from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from evozeus.runtime.paths import RuntimePaths


@dataclass(frozen=True)
class Workspace:
    root: Path

    @property
    def sessions_dir(self) -> Path:
        return self.root / "sessions"

    @property
    def drafts_dir(self) -> Path:
        return self.root / "drafts"

    @property
    def factors_dir(self) -> Path:
        return self.root / "runtime" / "factors"

    @property
    def scanners_dir(self) -> Path:
        return self.root / "runtime" / "scanners"

    @property
    def history_dir(self) -> Path:
        return self.root / "history"


def detect_workspace(cwd: Path) -> Workspace | None:
    root = cwd / ".evozeus"
    if root.exists() and root.is_dir():
        return Workspace(root=root)
    return None


def create_workspace(cwd: Path) -> Workspace:
    root = cwd / ".evozeus"
    workspace = Workspace(root=root)
    RuntimePaths.for_workspace(cwd).ensure()
    workspace.sessions_dir.mkdir(parents=True, exist_ok=True)
    (workspace.drafts_dir / "rule-proposals").mkdir(parents=True, exist_ok=True)
    (workspace.drafts_dir / "skill-proposals").mkdir(parents=True, exist_ok=True)
    (workspace.factors_dir / "installed").mkdir(parents=True, exist_ok=True)
    (workspace.scanners_dir / "installed").mkdir(parents=True, exist_ok=True)
    workspace.history_dir.mkdir(parents=True, exist_ok=True)
    (root / "config.json").write_text('{"mode":"manual-session-review"}\n', encoding="utf-8")
    return workspace
