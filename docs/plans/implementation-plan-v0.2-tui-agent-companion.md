# EvoZeus TUI + Agent Companion v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v0.2 shortest loop and optional TUI / browser companion foundations defined in `docs/design/active/design_doc-v0.2-tui-agent-companion-workflow.md`.

**Architecture:** Start with manual session review as the default zero-install path, then add an optional Python CLI/TUI package. The CLI owns `onboard`, `status`, `doctor`, and `tui`; local state lives under `.evozeus/`; browser companion starts only for review and authorization screens.

**Tech Stack:** Python 3.11+, Typer, Textual, Pydantic, FastAPI + Jinja2, pytest.

---

## Document Type

This file is an implementation plan. It translates the active design doc into executable slices.

| Source | Role |
| --- | --- |
| `docs/design/active/design_doc-v0.2-tui-agent-companion-workflow.md` | Product and interaction design |
| `docs/plans/implementation-plan-v0.2-tui-agent-companion.md` | Development execution plan |
| `docs/reference/` | Stable schemas created by this plan |

## Source Docs

- Design: `docs/design/active/design_doc-v0.2-tui-agent-companion-workflow.md`
- Vision: `VISION.md`
- Agent entry: `SKILL.md`
- Privacy: `docs/governance/privacy-and-redaction.md`
- Factor protocol: `docs/reference/factor-analysis-protocol.md`
- Report templates: `docs/reference/report-templates.md`

## Source-Driven Evidence

- Textual official docs describe Python terminal UI apps and browser-capable Textual apps: <https://textual.textualize.io/>
- Typer official testing docs use `typer.testing.CliRunner`: <https://typer.tiangolo.com/tutorial/testing/>
- FastAPI official testing docs use `fastapi.testclient.TestClient`: <https://fastapi.tiangolo.com/tutorial/testing/>

## Scope

### In Scope

- Manual Session Review copy prompt and verdict card shape.
- Optional Python package scaffold.
- CLI commands: `evozeus status`, `evozeus onboard`, `evozeus doctor`, `evozeus tui`.
- `.evozeus/` local workspace contract.
- TUI skeleton with the v0.2 menu.
- Browser companion with one-time token and review pages.
- Factor analysis protocol and inspect path.
- Golden path validation for the shortest loop.

### Out of Scope

- hook auto-start
- cron auto-start
- automatic upload
- full factor marketplace
- graph database
- hosted dashboard
- GitHub issue / PR automation beyond local draft readiness

## File Map

| Path | Action | Responsibility |
| --- | --- | --- |
| `README.md` | Modify | Add shortest-loop copy blocks and opt-in next steps |
| `SKILL.md` | Modify | Add Manual Session Review default and verdict card output |
| `docs/reference/verdict-card.md` | Create | Stable schema for default verdict card |
| `pyproject.toml` | Create | Python package metadata and dependencies |
| `src/evozeus/__init__.py` | Create | Package version |
| `src/evozeus/cli.py` | Create | Typer CLI commands |
| `src/evozeus/models.py` | Create | Shared Pydantic models |
| `src/evozeus/workspace.py` | Create | `.evozeus/` workspace detection and creation |
| `src/evozeus/verdict_card.py` | Create | Verdict card model and Markdown renderer |
| `src/evozeus/doctor.py` | Create | Failure evidence classification |
| `src/evozeus/tui/app.py` | Create | Textual TUI skeleton |
| `src/evozeus/companion/app.py` | Create | FastAPI browser companion |
| `src/evozeus/companion/tokens.py` | Create | One-time token helpers |
| `src/evozeus/factors/protocol.py` | Create | Factor analysis protocol models |
| `src/evozeus/factors/manifest.py` | Create | Community factor manifest parser and validator |
| `tests/` | Create | CLI, workspace, verdict, doctor, companion and factor tests |
| `docs/README.md` | Modify | Add plans entry |
| `docs/governance/changelog.md` | Modify | Record implementation plan |

## Validation Defaults

Run after each code slice:

```bash
python -m pytest -q
git diff --check
```

Expected:

```text
pytest exits 0
git diff --check exits 0
```

## Task 1: Manual Session Review Docs

**Files:**

- Modify: `README.md`
- Modify: `SKILL.md`
- Create: `docs/reference/verdict-card.md`

- [ ] **Step 1: Add shortest-loop copy blocks to README**

Add a `Manual Session Review` section near `Start Here`:

```md
## Manual Session Review

Default mode is zero-install and zero-upload.

Copy this to your Agent:

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。先只输出 Session Verdict Card，不写本地文件，不提交 GitHub。
```

The default output is:

```text
Session Verdict Card
- Task context
- Key evidence
- Judgment signals
- Proposed verdict
- Suggested next action
- Privacy note
- Optional next steps
```
```

- [ ] **Step 2: Update SKILL default behavior**

Add this section after `## Core Rule`:

```md
## Default Mode

Default mode is `Manual Session Review`.

In default mode:

- Do not create local files.
- Do not register a persistent session.
- Do not enable hooks.
- Do not schedule cron.
- Do not upload raw session content.
- Do not create GitHub issues or PRs.
- Produce a `Session Verdict Card`.

Ask before any opt-in action: local write, TUI, browser review, community contribution, factor install, hook, cron.
```

- [ ] **Step 3: Create verdict card reference**

Create `docs/reference/verdict-card.md`:

```md
# Session Verdict Card

- Status: active
- Last updated: 2026-06-15

The Session Verdict Card is the default zero-install output for Manual Session Review.

## Fields

| Field | Meaning |
| --- | --- |
| Task context | What the Agent was trying to do |
| Key evidence | Minimal evidence visible in the current session |
| Judgment signals | Failure, delay, misjudgment, correction, unexpectedly good outcome |
| Proposed verdict | Preserve, Promote to Skill, Extract Factor, Keep as Habit, Fix Environment, Reject Pattern, Open Case |
| Suggested next action | Save, ignore, debug, draft Case, open TUI, contribute |
| Privacy note | What stays private and what needs redaction |
| Optional next steps | Explicit opt-in actions |

## Markdown Shape

```md
## Session Verdict Card

### Task context

### Key evidence

### Judgment signals

### Proposed verdict

### Suggested next action

### Privacy note

### Optional next steps
```
```

- [ ] **Step 4: Validate docs**

Run:

```bash
rg -n "Manual Session Review|Session Verdict Card|zero-upload" README.md SKILL.md docs/reference/verdict-card.md
git diff --check
```

Expected:

```text
rg prints matches in all three files
git diff --check exits 0
```

## Task 2: Python Package Scaffold

**Files:**

- Create: `pyproject.toml`
- Create: `src/evozeus/__init__.py`
- Create: `src/evozeus/cli.py`
- Create: `tests/test_cli.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "evozeus"
version = "0.0.1"
description = "Agent Session Judgment Layer"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "typer>=0.12",
  "rich>=13.7",
  "pydantic>=2.7",
  "textual>=0.80",
  "fastapi>=0.115",
  "uvicorn>=0.30",
  "jinja2>=3.1",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "httpx>=0.27",
]

[project.scripts]
evozeus = "evozeus.cli:app"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
```

- [ ] **Step 2: Create package init**

```python
# src/evozeus/__init__.py
__version__ = "0.0.1"
```

- [ ] **Step 3: Create CLI**

```python
# src/evozeus/cli.py
from __future__ import annotations

import typer

from evozeus import __version__

app = typer.Typer(help="EvoZeus local judgment workbench.")


@app.command()
def version() -> None:
    """Print EvoZeus version."""
    typer.echo(__version__)


@app.command()
def status() -> None:
    """Print local EvoZeus status."""
    typer.echo("EvoZeus status: manual-session-review")


@app.command()
def onboard() -> None:
    """Run first-time setup checks."""
    typer.echo("EvoZeus onboard: local-first, zero-upload")


@app.command()
def doctor() -> None:
    """Run lightweight debug diagnosis."""
    typer.echo("EvoZeus doctor: collect evidence before changes")


@app.command()
def tui(dry_run: bool = typer.Option(False, "--dry-run")) -> None:
    """Open the TUI."""
    if dry_run:
        typer.echo("Current Session | Debug Verdicts | Case Drafts | Factor Runtime | History")
        return
    from evozeus.tui.app import EvoZeusApp

    EvoZeusApp().run()
```

- [ ] **Step 4: Create CLI tests**

```python
# tests/test_cli.py
from typer.testing import CliRunner

from evozeus.cli import app


runner = CliRunner()


def test_status_command_reports_manual_mode():
    result = runner.invoke(app, ["status"])
    assert result.exit_code == 0
    assert "manual-session-review" in result.output


def test_tui_dry_run_lists_menu_items():
    result = runner.invoke(app, ["tui", "--dry-run"])
    assert result.exit_code == 0
    assert "Current Session" in result.output
    assert "Factor Runtime" in result.output
```

- [ ] **Step 5: Validate scaffold**

Run:

```bash
python -m pip install -e ".[dev]"
python -m pytest tests/test_cli.py -q
```

Expected:

```text
2 passed
```

## Task 3: Local Workspace Contract

**Files:**

- Create: `src/evozeus/workspace.py`
- Create: `tests/test_workspace.py`

- [ ] **Step 1: Implement workspace helpers**

```python
# src/evozeus/workspace.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


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
        return self.root / "factors"

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
    workspace.sessions_dir.mkdir(parents=True, exist_ok=True)
    workspace.drafts_dir.mkdir(parents=True, exist_ok=True)
    (workspace.drafts_dir / "rule-proposals").mkdir(parents=True, exist_ok=True)
    (workspace.drafts_dir / "skill-proposals").mkdir(parents=True, exist_ok=True)
    workspace.factors_dir.mkdir(parents=True, exist_ok=True)
    (workspace.factors_dir / "installed").mkdir(parents=True, exist_ok=True)
    workspace.history_dir.mkdir(parents=True, exist_ok=True)
    (root / "config.json").write_text('{"mode":"manual-session-review"}\n', encoding="utf-8")
    return workspace
```

- [ ] **Step 2: Add tests**

```python
# tests/test_workspace.py
from evozeus.workspace import create_workspace, detect_workspace


def test_detect_workspace_returns_none_when_missing(tmp_path):
    assert detect_workspace(tmp_path) is None


def test_create_workspace_creates_expected_directories(tmp_path):
    workspace = create_workspace(tmp_path)
    assert workspace.root.exists()
    assert workspace.sessions_dir.exists()
    assert (workspace.drafts_dir / "rule-proposals").exists()
    assert (workspace.drafts_dir / "skill-proposals").exists()
    assert (workspace.factors_dir / "installed").exists()
    assert workspace.history_dir.exists()
    assert (workspace.root / "config.json").read_text(encoding="utf-8")
```

- [ ] **Step 3: Validate workspace**

Run:

```bash
python -m pytest tests/test_workspace.py -q
```

Expected:

```text
2 passed
```

## Task 4: Verdict Card Model and Renderer

**Files:**

- Create: `src/evozeus/models.py`
- Create: `src/evozeus/verdict_card.py`
- Create: `tests/test_verdict_card.py`

- [ ] **Step 1: Create shared models**

```python
# src/evozeus/models.py
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Verdict(StrEnum):
    PRESERVE = "Preserve"
    PROMOTE_TO_SKILL = "Promote to Skill"
    EXTRACT_FACTOR = "Extract Factor"
    KEEP_AS_HABIT = "Keep as Habit"
    FIX_ENVIRONMENT = "Fix Environment"
    REJECT_PATTERN = "Reject Pattern"
    OPEN_CASE = "Open Case"


class SessionVerdictCard(BaseModel):
    task_context: str
    key_evidence: list[str] = Field(default_factory=list)
    judgment_signals: list[str] = Field(default_factory=list)
    proposed_verdict: Verdict
    suggested_next_action: str
    privacy_note: str
    optional_next_steps: list[str] = Field(default_factory=list)
```

- [ ] **Step 2: Create Markdown renderer**

```python
# src/evozeus/verdict_card.py
from __future__ import annotations

from evozeus.models import SessionVerdictCard


def render_verdict_card(card: SessionVerdictCard) -> str:
    def bullets(items: list[str]) -> str:
        if not items:
            return "- None"
        return "\n".join(f"- {item}" for item in items)

    return "\n".join(
        [
            "## Session Verdict Card",
            "",
            "### Task context",
            card.task_context,
            "",
            "### Key evidence",
            bullets(card.key_evidence),
            "",
            "### Judgment signals",
            bullets(card.judgment_signals),
            "",
            "### Proposed verdict",
            card.proposed_verdict.value,
            "",
            "### Suggested next action",
            card.suggested_next_action,
            "",
            "### Privacy note",
            card.privacy_note,
            "",
            "### Optional next steps",
            bullets(card.optional_next_steps),
            "",
        ]
    )
```

- [ ] **Step 3: Add tests**

```python
# tests/test_verdict_card.py
from evozeus.models import SessionVerdictCard, Verdict
from evozeus.verdict_card import render_verdict_card


def test_render_verdict_card_contains_required_sections():
    card = SessionVerdictCard(
        task_context="Agent debugged a failing git push.",
        key_evidence=["gh auth succeeded", "push timed out"],
        judgment_signals=["network failure"],
        proposed_verdict=Verdict.FIX_ENVIRONMENT,
        suggested_next_action="Check network and retry later.",
        privacy_note="No raw private session included.",
        optional_next_steps=["Save local draft", "Ignore"],
    )

    rendered = render_verdict_card(card)

    assert "## Session Verdict Card" in rendered
    assert "Fix Environment" in rendered
    assert "Save local draft" in rendered
```

- [ ] **Step 4: Validate verdict card**

Run:

```bash
python -m pytest tests/test_verdict_card.py -q
```

Expected:

```text
1 passed
```

## Task 5: Doctor Classification

**Files:**

- Create: `src/evozeus/doctor.py`
- Create: `tests/test_doctor.py`

- [ ] **Step 1: Implement classifier**

```python
# src/evozeus/doctor.py
from __future__ import annotations

from enum import StrEnum


class FailureKind(StrEnum):
    TOOL_PATH = "tool_path"
    AUTH = "auth"
    NETWORK = "network"
    PERMISSION = "permission"
    SKILL = "skill"
    WORKFLOW = "workflow"
    UNKNOWN = "unknown"


def classify_failure(text: str) -> FailureKind:
    lowered = text.lower()
    if "command not found" in lowered or "no such file or directory" in lowered:
        return FailureKind.TOOL_PATH
    if "unauthorized" in lowered or "authentication" in lowered or "forbidden" in lowered:
        return FailureKind.AUTH
    if "timeout" in lowered or "network" in lowered or "could not resolve host" in lowered:
        return FailureKind.NETWORK
    if "permission denied" in lowered or "operation not permitted" in lowered:
        return FailureKind.PERMISSION
    if "skill" in lowered and ("missing" in lowered or "failed" in lowered):
        return FailureKind.SKILL
    if "unclear requirement" in lowered or "needs clarification" in lowered:
        return FailureKind.WORKFLOW
    return FailureKind.UNKNOWN
```

- [ ] **Step 2: Add tests**

```python
# tests/test_doctor.py
from evozeus.doctor import FailureKind, classify_failure


def test_classify_tool_path_failure():
    assert classify_failure("zsh: command not found: gh") == FailureKind.TOOL_PATH


def test_classify_network_failure():
    assert classify_failure("fatal: unable to access repo: network timeout") == FailureKind.NETWORK


def test_classify_auth_failure():
    assert classify_failure("HTTP 403 Forbidden authentication failed") == FailureKind.AUTH
```

- [ ] **Step 3: Wire CLI doctor dry run**

Modify `src/evozeus/cli.py`:

```python
@app.command()
def doctor(evidence: str = typer.Option("", "--evidence")) -> None:
    """Run lightweight debug diagnosis."""
    if evidence:
        from evozeus.doctor import classify_failure

        typer.echo(f"EvoZeus doctor verdict: {classify_failure(evidence).value}")
        return
    typer.echo("EvoZeus doctor: collect evidence before changes")
```

- [ ] **Step 4: Validate doctor**

Run:

```bash
python -m pytest tests/test_doctor.py tests/test_cli.py -q
```

Expected:

```text
5 passed
```

## Task 6: TUI Skeleton

**Files:**

- Create: `src/evozeus/tui/__init__.py`
- Create: `src/evozeus/tui/app.py`
- Modify: `tests/test_cli.py`

- [ ] **Step 1: Create TUI app**

```python
# src/evozeus/tui/__init__.py
```

```python
# src/evozeus/tui/app.py
from __future__ import annotations

from textual.app import App, ComposeResult
from textual.widgets import Footer, Header, ListItem, ListView, Static


class EvoZeusApp(App[None]):
    TITLE = "EvoZeus"

    def compose(self) -> ComposeResult:
        yield Header()
        yield ListView(
            ListItem(Static("Current Session")),
            ListItem(Static("Debug Verdicts")),
            ListItem(Static("Case Drafts")),
            ListItem(Static("Skill Proposals")),
            ListItem(Static("Factor Runtime")),
            ListItem(Static("Community Contributions")),
            ListItem(Static("History")),
            ListItem(Static("Settings / Privacy")),
        )
        yield Footer()
```

- [ ] **Step 2: Keep CLI dry run as testable smoke**

Ensure `evozeus tui --dry-run` still prints all menu labels.

- [ ] **Step 3: Validate TUI import and CLI dry run**

Run:

```bash
python -m pytest tests/test_cli.py -q
python -c "from evozeus.tui.app import EvoZeusApp; assert EvoZeusApp.TITLE == 'EvoZeus'"
```

Expected:

```text
tests pass
python command exits 0
```

## Task 7: Browser Companion Skeleton

**Files:**

- Create: `src/evozeus/companion/__init__.py`
- Create: `src/evozeus/companion/tokens.py`
- Create: `src/evozeus/companion/app.py`
- Create: `tests/test_companion.py`

- [ ] **Step 1: Create token helper**

```python
# src/evozeus/companion/__init__.py
```

```python
# src/evozeus/companion/tokens.py
from __future__ import annotations

import secrets


def create_one_time_token() -> str:
    return secrets.token_urlsafe(24)


def token_matches(expected: str, provided: str | None) -> bool:
    return bool(provided) and secrets.compare_digest(expected, provided)
```

- [ ] **Step 2: Create FastAPI app factory**

```python
# src/evozeus/companion/app.py
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse

from evozeus.companion.tokens import token_matches


def create_app(token: str) -> FastAPI:
    app = FastAPI(title="EvoZeus Companion")

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request) -> str:
        provided = request.query_params.get("token")
        if not token_matches(token, provided):
            raise HTTPException(status_code=403, detail="Invalid token")
        return "<h1>EvoZeus Companion</h1><p>Review required.</p>"

    return app
```

- [ ] **Step 3: Add tests**

```python
# tests/test_companion.py
from fastapi.testclient import TestClient

from evozeus.companion.app import create_app


def test_companion_rejects_missing_token():
    client = TestClient(create_app(token="secret"))
    response = client.get("/")
    assert response.status_code == 403


def test_companion_accepts_valid_token():
    client = TestClient(create_app(token="secret"))
    response = client.get("/?token=secret")
    assert response.status_code == 200
    assert "EvoZeus Companion" in response.text
```

- [ ] **Step 4: Validate companion**

Run:

```bash
python -m pytest tests/test_companion.py -q
```

Expected:

```text
2 passed
```

## Task 8: Factor Analysis Protocol Inspect

**Files:**

- Create: `src/evozeus/factors/__init__.py`
- Create: `src/evozeus/factors/protocol.py`
- Create: `src/evozeus/factors/manifest.py`
- Create: `tests/test_factor_protocol.py`

- [ ] **Step 1: Create protocol and manifest models**

```python
# src/evozeus/factors/__init__.py
```

```python
# src/evozeus/factors/protocol.py
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RuntimeProfile(str, Enum):
    DEFAULT = "default"
    HEAVY = "heavy"
    COMMUNITY = "community"


class FactorStage(str, Enum):
    INGEST = "ingest"
    NORMALIZE = "normalize"
    SIGNAL_EXTRACTION = "signal_extraction"
    EVIDENCE_BUILDING = "evidence_building"
    CASE_BUILDING = "case_building"
    VERDICT_BUILDING = "verdict_building"
    INSIGHT_AGGREGATION = "insight_aggregation"


class EvidencePolicy(BaseModel):
    required: bool = True
    min_refs: int = 1
    raw_content_allowed: bool = False


class FactorSpec(BaseModel):
    id: str
    name: str
    framework_id: str
    stage: FactorStage
    runtime_profile: RuntimeProfile
    default_enabled: bool = False
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    evidence_policy: EvidencePolicy = Field(default_factory=EvidencePolicy)
    verdict_signals: list[str] = Field(default_factory=list)


class FactorResult(BaseModel):
    factor_id: str
    framework_id: str
    stage: FactorStage
    target_type: str
    target_id: str
    tags: list[dict[str, str]] = Field(default_factory=list)
    scores: dict[str, float] = Field(default_factory=dict)
    evidence_refs: list[dict[str, str]] = Field(default_factory=list)
    verdict_signals: list[str] = Field(default_factory=list)
    confidence: float
```

```python
# src/evozeus/factors/manifest.py
from __future__ import annotations

import json
from pathlib import Path

from pydantic import Field

from evozeus.factors.protocol import FactorSpec


class FactorManifest(FactorSpec):
    version: str
    status: str
    description: str
    permissions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    rollback: str


def load_manifest(path: Path) -> FactorManifest:
    data = json.loads(path.read_text(encoding="utf-8"))
    return FactorManifest.model_validate(data)
```

- [ ] **Step 2: Add tests**

```python
# tests/test_factor_protocol.py
import json

from evozeus.factors.manifest import load_manifest
from evozeus.factors.protocol import FactorResult


def test_load_manifest_binds_factor_to_framework_stage(tmp_path):
    path = tmp_path / "manifest.json"
    path.write_text(
        json.dumps(
            {
                "id": "community.github_network_debug",
                "name": "github-network-debug",
                "framework_id": "agent_session_review.v0",
                "stage": "verdict_building",
                "runtime_profile": "community",
                "default_enabled": False,
                "version": "0.1.0",
                "status": "candidate",
                "description": "Classifies GitHub network failures.",
                "inputs": ["command_output", "tool_event", "environment_signal"],
                "outputs": ["tag", "evidence_ref", "verdict_signal"],
                "permissions": ["read local report"],
                "risks": ["misclassifies auth as network"],
                "rollback": "disable factor in local config",
            }
        ),
        encoding="utf-8",
    )

    manifest = load_manifest(path)

    assert manifest.id == "community.github_network_debug"
    assert manifest.framework_id == "agent_session_review.v0"
    assert manifest.stage == "verdict_building"
    assert manifest.runtime_profile == "community"
    assert manifest.name == "github-network-debug"
    assert manifest.status == "candidate"
    assert manifest.rollback == "disable factor in local config"


def test_factor_result_requires_target_and_confidence():
    result = FactorResult(
        factor_id="default.same_target_rework",
        framework_id="agent_session_review.v0",
        stage="signal_extraction",
        target_type="session",
        target_id="ezs_001",
        tags=[{"type": "rework", "value": "same_target_rework"}],
        scores={"same_target_rework": 0.82},
        evidence_refs=[{"ref_id": "event_0004", "kind": "user_turn"}],
        verdict_signals=["Promote to Skill"],
        confidence=0.78,
    )

    assert result.target_id == "ezs_001"
    assert result.confidence == 0.78
```

- [ ] **Step 3: Validate protocol**

Run:

```bash
python -m pytest tests/test_factor_protocol.py -q
```

Expected:

```text
2 passed
```

## Task 9: Golden Path Integration

**Files:**

- Create: `tests/test_manual_session_review_golden_path.py`

- [ ] **Step 1: Add golden path test**

```python
# tests/test_manual_session_review_golden_path.py
from evozeus.models import SessionVerdictCard, Verdict
from evozeus.verdict_card import render_verdict_card


def test_manual_session_review_golden_path_has_no_required_local_write():
    card = SessionVerdictCard(
        task_context="Manual session review for a failed command.",
        key_evidence=["command failed with timeout"],
        judgment_signals=["failure", "debug"],
        proposed_verdict=Verdict.FIX_ENVIRONMENT,
        suggested_next_action="Retry after checking network.",
        privacy_note="No raw session leaves the current conversation.",
        optional_next_steps=["Save local draft", "Open TUI", "Ignore"],
    )

    rendered = render_verdict_card(card)

    assert "Session Verdict Card" in rendered
    assert "Save local draft" in rendered
    assert "No raw session leaves" in rendered
```

- [ ] **Step 2: Validate full suite**

Run:

```bash
python -m pytest -q
git diff --check
```

Expected:

```text
all tests pass
git diff --check exits 0
```

## Rollback

Each slice can be reverted independently:

- Docs-only changes: revert Markdown files.
- Python scaffold: remove `pyproject.toml`, `src/`, `tests/`.
- TUI slice: remove `src/evozeus/tui/` and the `tui` command.
- Browser companion slice: remove `src/evozeus/companion/` and companion tests.
- Factor protocol slice: remove `src/evozeus/factors/` and factor tests.

## Review Roles

| Slice | Review Roles |
| --- | --- |
| Manual Session Review docs | Product, DX, Privacy |
| Python scaffold | Engineering, DX |
| Workspace contract | Engineering, Privacy |
| Verdict card | Product, DX |
| Doctor classification | Engineering, QA |
| TUI skeleton | Product, DX |
| Browser companion | Security, UX, Engineering |
| Factor protocol | Security, Community |
| Golden path | Product, QA |

## Self-Review

- Spec coverage: covers default mode, shortest loop, roles, TUI, browser companion, factor inspect and contribution gates from v0.2 design doc.
- Open-marker scan: no unresolved markers.
- Type consistency: `SessionVerdictCard`, `Verdict`, `Workspace`, `FactorManifest` names are introduced before use.
