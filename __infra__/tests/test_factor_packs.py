from pathlib import Path

from evozeus.factors.base import FactorContext
from evozeus.factors.packs import FactorPackRepository
from evozeus.factors.runner import FactorRunner
from evozeus.scanners.base import ScanRequest
from evozeus.scanners.providers.codex import CodexScanner


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PACK_ROOT = PROJECT_ROOT / "__infra__" / "factor_packs"
SESSION_ROOT = PROJECT_ROOT / "__infra__" / "testdata" / "codex_sessions"


def test_factor_packs_are_independent_folders_with_manifest_and_code():
    repository = FactorPackRepository(PACK_ROOT)
    packs = repository.discover()

    assert len(packs) == 3
    assert {pack.manifest.id for pack in packs} == {
        "default.negative_feedback",
        "default.same_target_rework",
        "default.tool_failure",
    }
    for pack in packs:
        assert pack.root.is_dir()
        assert (pack.root / "factor.json").is_file()
        assert (pack.root / "factor.py").is_file()


def test_factor_pack_repository_loads_and_runs_specified_factor():
    session_ref = CodexScanner().discover(ScanRequest(provider="codex", source_dir=SESSION_ROOT))[0]
    session = CodexScanner().load(session_ref)
    repository = FactorPackRepository(PACK_ROOT)
    factor = repository.load("default.tool_failure")

    summary = FactorRunner([factor]).run(FactorContext(session=session))

    assert not summary.errors
    assert summary.results[0].factor_id == "default.tool_failure"
    assert summary.results[0].status == "matched"
