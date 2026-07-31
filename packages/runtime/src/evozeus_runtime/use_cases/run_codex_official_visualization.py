from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter

from evozeus_runtime.factors.official_bridge import OfficialFactorPackBuilder
from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository
from evozeus_runtime.use_cases.generate_ai_usage_profile_report import generate_ai_usage_profile_report
from evozeus_runtime.use_cases.generate_ledger_browser import generate_ledger_browser
from evozeus_runtime.use_cases.generate_project_insights import generate_project_insights, generate_project_insights_site
from evozeus_runtime.use_cases.run_factors import run_factors
from evozeus_runtime.use_cases.scan_sessions import scan_sessions


@dataclass(frozen=True)
class CodexOfficialVisualizationResult:
    workspace_root: Path
    ledger_path: Path
    html_path: Path
    project_insights_html_path: Path
    usage_profile_html_path: Path
    project_insights_project_count: int
    project_insights_session_count: int
    session_count: int
    factor_count: int
    ran_count: int
    skipped_count: int
    error_count: int
    db_size_bytes: int


def run_codex_official_visualization(
    *,
    workspace_root: Path,
    source_dir: Path,
    official_repo_root: Path,
    force: bool = False,
    skip_fresh: bool = True,
    output_path: Path | None = None,
    project: str | None = None,
    project_contains: bool = False,
    project_min_sessions: int = 8,
    project_top_n: int = 20,
    progress: Callable[[str], None] | None = None,
) -> CodexOfficialVisualizationResult:
    started_at = perf_counter()
    paths = RuntimePaths.for_workspace(workspace_root).ensure()
    _emit(progress, f"runtime_root={paths.runtime_root}")
    _emit(progress, f"scan_start provider=codex source={source_dir}")
    scan_result = scan_sessions(workspace_root=workspace_root, provider="codex", source_dir=source_dir)
    _emit(progress, f"scan_done sessions={scan_result.session_count}")
    approved_session_ids = tuple(dict.fromkeys(scan_result.session_ids))
    approved_session_id_set = set(approved_session_ids)

    pack_root = paths.installed_factors_dir / "official-generated"
    _emit(progress, f"official_pack_start output={pack_root}")
    pack_result = OfficialFactorPackBuilder(
        official_repo_root=official_repo_root,
        output_pack_root=pack_root,
    ).build()
    factor_ids = pack_result.factor_ids
    _emit(progress, f"official_pack_done factors={len(factor_ids)}")

    ledger = LedgerRepository(paths)
    statuses = [
        status
        for status in ledger.list_session_statuses(factor_ids=factor_ids)
        if status.session_id in approved_session_id_set
    ]
    total_sessions = len(statuses)
    _emit(progress, f"run_start sessions={total_sessions} factors={len(factor_ids)} force={force} skip_fresh={skip_fresh}")
    ran_count = 0
    skipped_count = 0
    error_count = 0
    for index, status in enumerate(statuses, start=1):
        factor_ids_to_run = factor_ids
        if skip_fresh and not force:
            factor_ids_to_run = ledger.list_pending_factor_ids(session_id=status.session_id, factor_ids=factor_ids)
        if skip_fresh and not force and not factor_ids_to_run:
            skipped_count += len(factor_ids)
            if index == total_sessions or index % 100 == 0:
                _emit(
                    progress,
                    f"run_progress index={index}/{total_sessions} ran={ran_count} "
                    f"skipped={skipped_count} errors={error_count}",
                )
            continue
        if skip_fresh and not force:
            skipped_count += len(factor_ids) - len(factor_ids_to_run)
        session_started_at = perf_counter()
        pending_count = len(factor_ids_to_run)
        _emit(
            progress,
            f"session_start index={index}/{total_sessions} session_id={status.session_id} pending={pending_count}",
        )
        run_result = run_factors(
            workspace_root=workspace_root,
            session_id=status.session_id,
            factor_ids=factor_ids_to_run,
            pack_root=pack_root,
            progress=progress,
        )
        ran_count += len(factor_ids_to_run)
        error_count += run_result.error_count
        elapsed = perf_counter() - session_started_at
        _emit(
            progress,
            f"session_done index={index}/{total_sessions} session_id={status.session_id} "
            f"results={run_result.result_count} errors={run_result.error_count} elapsed={elapsed:.2f}s",
        )

    html_path = output_path or (paths.runtime_root / "reports" / "codex-factor-visualization.html")
    _emit(progress, f"html_start output={html_path}")
    html_result = generate_ledger_browser(
        workspace_root=workspace_root,
        output_path=html_path,
        session_ids=approved_session_ids,
    )
    _emit(progress, f"project_insights_start min_sessions={project_min_sessions} top_n={project_top_n}")
    if project:
        project_insights_result = generate_project_insights(
            workspace_root=workspace_root,
            project=project,
            formats=["markdown", "json", "html"],
            match_mode="contains" if project_contains else "exact",
            top_n=project_top_n,
            session_ids=approved_session_ids,
        )
        project_count = 1
    else:
        project_insights_result = generate_project_insights_site(
            workspace_root=workspace_root,
            formats=["markdown", "json", "html"],
            min_sessions=project_min_sessions,
            top_n=project_top_n,
            session_ids=approved_session_ids,
        )
        project_count = project_insights_result.project_count
    _emit(
        progress,
        f"project_insights_done projects={project_count} "
        f"sessions={project_insights_result.session_count} html={project_insights_result.html_path}",
    )
    _emit(progress, "usage_profile_start")
    usage_profile_result = generate_ai_usage_profile_report(
        workspace_root=workspace_root,
        formats=["markdown", "json", "html"],
        session_ids=approved_session_ids,
    )
    _emit(
        progress,
        f"usage_profile_done html={usage_profile_result.html_path} mbti={usage_profile_result.mbti_code}",
    )
    db_size = html_result.ledger_path.stat().st_size if html_result.ledger_path.exists() else 0
    elapsed = perf_counter() - started_at
    _emit(
        progress,
        f"run_done sessions={scan_result.session_count} factors={len(factor_ids)} "
        f"ran={ran_count} skipped={skipped_count} errors={error_count} "
        f"db_size_bytes={db_size} elapsed={elapsed:.2f}s",
    )
    return CodexOfficialVisualizationResult(
        workspace_root=workspace_root,
        ledger_path=html_result.ledger_path,
        html_path=html_result.html_path,
        project_insights_html_path=project_insights_result.html_path,
        usage_profile_html_path=usage_profile_result.html_path,
        project_insights_project_count=project_count,
        project_insights_session_count=project_insights_result.session_count,
        session_count=scan_result.session_count,
        factor_count=len(factor_ids),
        ran_count=ran_count,
        skipped_count=skipped_count,
        error_count=error_count,
        db_size_bytes=db_size,
    )


def _emit(progress: Callable[[str], None] | None, message: str) -> None:
    if progress is not None:
        progress(message)
