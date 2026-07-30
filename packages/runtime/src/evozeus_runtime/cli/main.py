from __future__ import annotations

import os
from pathlib import Path

import typer

from evozeus_runtime import __version__
from evozeus_runtime.ledger.graph_repository import GraphQLiteNotInstalledError
from evozeus_runtime.ledger.migrate_sqlite_to_graphqlite import migrate_workspace_sqlite_to_graphqlite
from evozeus_runtime.use_cases.generate_ai_usage_profile_report import generate_ai_usage_profile_report
from evozeus_runtime.use_cases.generate_graph_ledger_browser import generate_graph_ledger_browser
from evozeus_runtime.use_cases.generate_project_insights import generate_project_insights, generate_project_insights_site
from evozeus_runtime.use_cases.generate_report import generate_report
from evozeus_runtime.use_cases.run_codex_official_visualization import run_codex_official_visualization
from evozeus_runtime.use_cases.run_factors import run_factors
from evozeus_runtime.use_cases.scan_sessions import scan_sessions

app = typer.Typer(help="EvoZeus local scanner and factor runner runtime.")


@app.command()
def status() -> None:
    typer.echo(f"evozeus-runtime {__version__}: scanner-runner-runtime")


@app.command()
def scan(
    provider: str = typer.Option("codex", "--provider"),
    source: Path | None = typer.Option(None, "--source"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
) -> None:
    result = scan_sessions(workspace_root=workspace, provider=provider, source_dir=source)
    typer.echo(f"scanned_sessions={result.session_count}")
    typer.echo(f"ledger={result.ledger_path}")


@app.command()
def run(
    session_id: str = typer.Option(..., "--session-id"),
    factor: list[str] = typer.Option(..., "--factor"),
    pack_root: Path = typer.Option(..., "--pack-root"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
) -> None:
    result = run_factors(
        workspace_root=workspace,
        session_id=session_id,
        factor_ids=factor,
        pack_root=pack_root,
    )
    typer.echo(f"results={result.result_count}")
    typer.echo(f"errors={result.error_count}")
    typer.echo(f"analysis_run_id={result.analysis_run_id}")


@app.command()
def report(
    session_id: str = typer.Option(..., "--session-id"),
    format: list[str] = typer.Option(["markdown"], "--format"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
) -> None:
    result = generate_report(workspace_root=workspace, session_id=session_id, formats=format)
    typer.echo(f"markdown={result.markdown_path}")
    typer.echo(f"json={result.json_path}")
    typer.echo(f"html={result.html_path}")


@app.command("session-insights")
@app.command("scan-session-report")
def session_insights(
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    official_repo_root: Path | None = typer.Option(
        None,
        "--official-repo-root",
        help="Explicit path to EvoZeus-session-signal-skill. EVOZEUS_OFFICIAL_REPO_ROOT is also supported.",
    ),
    output: Path | None = typer.Option(
        None,
        "--output",
        help="HTML output path for the ledger visualizer. Project insights always use runtime reports/project-insights.",
    ),
    force: bool = typer.Option(False, "--force", help="Run all factors even when previous results are fresh."),
    no_skip_fresh: bool = typer.Option(False, "--no-skip-fresh", help="Disable reuse of fresh factor results."),
    project_min_sessions: int = typer.Option(8, "--project-min-sessions", min=1),
    project_top_n: int = typer.Option(20, "--project-top-n", min=1, max=200),
) -> None:
    resolved_official_root = official_repo_root
    if resolved_official_root is None and os.environ.get("EVOZEUS_OFFICIAL_REPO_ROOT"):
        resolved_official_root = Path(os.environ["EVOZEUS_OFFICIAL_REPO_ROOT"])
    if resolved_official_root is None:
        raise typer.BadParameter(
            "Provide --official-repo-root or EVOZEUS_OFFICIAL_REPO_ROOT; sibling-directory guessing is disabled."
        )
    result = run_codex_official_visualization(
        workspace_root=workspace,
        official_repo_root=resolved_official_root.expanduser().resolve(),
        force=force,
        skip_fresh=not no_skip_fresh,
        output_path=output,
        project_min_sessions=project_min_sessions,
        project_top_n=project_top_n,
        progress=lambda message: typer.echo(f"[session-insights] {message}", err=True),
    )
    typer.echo(f"sessions={result.session_count}")
    typer.echo(f"factors={result.factor_count}")
    typer.echo(f"ran={result.ran_count}")
    typer.echo(f"skipped={result.skipped_count}")
    typer.echo(f"errors={result.error_count}")
    typer.echo(f"db_size_bytes={result.db_size_bytes}")
    typer.echo(f"ledger={result.ledger_path}")
    typer.echo(f"html={result.html_path}")
    typer.echo(f"project_insights_html={result.project_insights_html_path}")
    typer.echo(f"usage_profile_html={result.usage_profile_html_path}")
    typer.echo(f"project_insights_projects={result.project_insights_project_count}")
    typer.echo(f"project_insights_sessions={result.project_insights_session_count}")


@app.command("usage-profile-report")
def usage_profile_report(
    format: list[str] = typer.Option(["json", "html"], "--format"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Output directory. Defaults to runtime reports/ai-usage-profile."),
    subject: str = typer.Option("用户", "--subject", help="Display name used in the generated report."),
) -> None:
    result = generate_ai_usage_profile_report(
        workspace_root=workspace,
        formats=format,
        output_dir=output_dir,
        subject=subject,
    )
    typer.echo(f"sessions={result.session_count}")
    typer.echo(f"factor_results={result.factor_result_count}")
    typer.echo(f"mbti={result.mbti_code}")
    typer.echo(f"ledger={result.ledger_path}")
    typer.echo(f"json={result.json_path}")
    typer.echo(f"markdown={result.markdown_path}")
    typer.echo(f"html={result.html_path}")


@app.command("project-insights")
def project_insights(
    project: str = typer.Option(..., "--project", help="Project label/key to analyze."),
    format: list[str] = typer.Option(["markdown", "json", "html"], "--format"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Output directory. Defaults to runtime reports/project-insights."),
    contains: bool = typer.Option(False, "--contains", help="Match project by substring instead of exact label/key."),
    top_n: int = typer.Option(30, "--top-n", min=1, max=200),
) -> None:
    result = generate_project_insights(
        workspace_root=workspace,
        project=project,
        formats=format,
        match_mode="contains" if contains else "exact",
        output_dir=output_dir,
        top_n=top_n,
    )
    typer.echo(f"project={result.project}")
    typer.echo(f"sessions={result.session_count}")
    typer.echo(f"exact_phrases={result.exact_phrase_count}")
    typer.echo(f"session_local_repeats={result.session_local_repeat_count}")
    typer.echo(f"quoted_material_phrases={result.quoted_material_phrase_count}")
    typer.echo(f"protocol_templates={result.protocol_template_count}")
    typer.echo(f"delegated_task_phrases={result.delegated_task_phrase_count}")
    typer.echo(f"key_sentence_labels={result.key_sentence_label_count}")
    typer.echo(f"repeated_requests={result.repeated_request_count}")
    typer.echo(f"markdown={result.markdown_path}")
    typer.echo(f"json={result.json_path}")
    typer.echo(f"html={result.html_path}")


@app.command("project-insights-site")
def project_insights_site(
    format: list[str] = typer.Option(["markdown", "json", "html"], "--format"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Output directory. Defaults to runtime reports/project-insights."),
    min_sessions: int = typer.Option(8, "--min-sessions", min=1, help="Minimum sessions required for a project to appear."),
    top_n: int = typer.Option(20, "--top-n", min=1, max=200),
) -> None:
    result = generate_project_insights_site(
        workspace_root=workspace,
        formats=format,
        output_dir=output_dir,
        min_sessions=min_sessions,
        top_n=top_n,
    )
    typer.echo(f"projects={result.project_count}")
    typer.echo(f"sessions={result.session_count}")
    typer.echo(f"total_projects={result.total_project_count}")
    typer.echo(f"markdown={result.markdown_path}")
    typer.echo(f"json={result.json_path}")
    typer.echo(f"html={result.html_path}")


@app.command("migrate-ledger")
def migrate_ledger(
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    legacy_db: Path | None = typer.Option(None, "--legacy-db", help="Legacy SQLite ledger path. Defaults to workspace results.sqlite3."),
    output: Path | None = typer.Option(None, "--output", help="Graph ledger output path. Defaults to results.graph.sqlite3."),
    no_backup: bool = typer.Option(False, "--no-backup", help="Do not copy results.sqlite3 to results.sqlite3.legacy."),
) -> None:
    try:
        result = migrate_workspace_sqlite_to_graphqlite(
            workspace_root=workspace,
            legacy_db_path=legacy_db,
            output_db_path=output,
            backup=not no_backup,
        )
    except GraphQLiteNotInstalledError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(2) from exc
    typer.echo(f"migration_id={result.migration_id}")
    typer.echo(f"legacy={result.legacy_db_path}")
    typer.echo(f"graph={result.output_db_path}")
    if result.backup_db_path is not None:
        typer.echo(f"backup={result.backup_db_path}")
    for check in result.checks:
        status = "ok" if check.ok else "failed"
        typer.echo(
            f"check={check.name} legacy={check.legacy_count} graph={check.graph_count} "
            f"op={check.operator} status={status}"
        )
    if not result.ok:
        raise typer.Exit(1)


@app.command("graph-browser")
def graph_browser(
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    graph: Path | None = typer.Option(None, "--graph", help="GraphQLite ledger path. Defaults to results.graph.sqlite3."),
    legacy: Path | None = typer.Option(None, "--legacy", help="Legacy SQLite ledger path. Defaults to results.sqlite3."),
    output: Path | None = typer.Option(None, "--output", help="HTML output path. Defaults to evozeus-graph.html."),
) -> None:
    result = generate_graph_ledger_browser(
        workspace_root=workspace,
        graph_path=graph,
        legacy_path=legacy,
        output_path=output,
    )
    typer.echo(f"html={result.html_path}")
    typer.echo(f"graph={result.graph_path}")
    typer.echo(f"legacy={result.legacy_path}")
    typer.echo(f"nodes={result.node_count}")
    typer.echo(f"edges={result.edge_count}")


if __name__ == "__main__":
    app()
