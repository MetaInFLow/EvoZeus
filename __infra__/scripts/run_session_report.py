from __future__ import annotations

import argparse
from pathlib import Path

from evozeus.factors.base import FactorContext
from evozeus.factors.packs import FactorPackRepository
from evozeus.factors.runner import FactorRunner
from evozeus.runtime.paths import RuntimePaths
from evozeus.scanners.base import ScanRequest, SessionRef
from evozeus.scanners.providers.codex import CodexScanner
from evozeus.storage.file_repository import FileSessionRepository


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="")
    parser.add_argument("--pack-root", default=str(PROJECT_ROOT / "__infra__" / "factor_packs"))
    parser.add_argument("--workspace", default=str(PROJECT_ROOT))
    parser.add_argument("--factor", action="append", default=[])
    parser.add_argument("--session-id", default="")
    parser.add_argument("--session-index", type=int, default=0)
    args = parser.parse_args()

    scanner = CodexScanner()
    refs = scanner.discover(
        ScanRequest(
            provider="codex",
            source_dir=Path(args.source) if args.source else None,
        )
    )
    assert refs, "no sessions found"
    session = scanner.load(_select_session_ref(scanner, refs, args.session_id, args.session_index))

    factor_repository = FactorPackRepository(Path(args.pack_root))
    packs = factor_repository.discover()
    selected_packs = [factor_repository.get(factor_id) for factor_id in args.factor] if args.factor else packs

    summary = FactorRunner(selected_packs).run(FactorContext(session=session))
    assert not summary.errors, summary.errors
    assert summary.results, "expected factor results"

    repository = FileSessionRepository(RuntimePaths.for_workspace(Path(args.workspace)).ensure())
    repository.write_session(session)
    repository.append_factor_results(session.session_id, summary.results)
    html_path = repository.write_factor_results_html(
        session.session_id,
        summary.results,
        packs,
        selected_factor_ids=args.factor or None,
    )
    md_path = html_path.with_name("factor-results.md")
    print(
        "session report ok: "
        f"session_id={session.session_id} "
        f"results={len(summary.results)} "
        f"md={md_path} "
        f"html={html_path}"
    )


def _select_session_ref(scanner: CodexScanner, refs: list[SessionRef], session_id: str, session_index: int) -> SessionRef:
    if session_id:
        for ref in refs:
            if ref.session_id == session_id:
                return ref
            session = scanner.load(ref)
            if session.session_id == session_id:
                return ref
        raise AssertionError(f"session not found: {session_id}")
    if session_index < 0 or session_index >= len(refs):
        raise AssertionError(f"session index out of range: {session_index}")
    return refs[session_index]


if __name__ == "__main__":
    main()
