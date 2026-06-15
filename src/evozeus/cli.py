from __future__ import annotations

import typer

from evozeus import __version__
from evozeus.checks import current_branch_name, validate_branch_name

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
def doctor(evidence: str = typer.Option("", "--evidence")) -> None:
    """Run lightweight debug diagnosis."""
    if evidence:
        from evozeus.doctor import classify_failure

        typer.echo(f"EvoZeus doctor verdict: {classify_failure(evidence).value}")
        return
    typer.echo("EvoZeus doctor: collect evidence before changes")


@app.command()
def check(branch: str = typer.Option("", "--branch")) -> None:
    """Run basic pre-upload checks."""
    branch_name = branch or current_branch_name()
    result = validate_branch_name(branch_name)
    typer.echo(result.message)
    if not result.ok:
        raise typer.Exit(1)


@app.command()
def tui(dry_run: bool = typer.Option(False, "--dry-run")) -> None:
    """Open the TUI."""
    if dry_run:
        typer.echo("Current Session | Debug Verdicts | Case Drafts | Skill Proposals | Factor Runtime | History")
        return
    from evozeus.tui.app import EvoZeusApp

    EvoZeusApp().run()
