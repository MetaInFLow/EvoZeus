import os
from pathlib import Path

import pytest

from evozeus_runtime.factors.base import FactorContext
from evozeus_runtime.factors.official_bridge import OfficialFactorPackBuilder
from evozeus_runtime.factors.packs import FactorPackRepository
from evozeus_runtime.sessions.schema import SessionEnvelope, SessionEvent


EXPECTED_OFFICIAL_FACTOR_IDS = {
    "official.key-sentence-trends",
    "official.repeated-request",
    "official.semantic-phrase-clusters",
    "official.session-resource-usage",
    "official.task-completion",
    "official.tool-failure-frequency",
    "official.user-input-sentiment",
}


def test_official_factor_bridge_builds_loadable_packs_for_all_official_factors(tmp_path):
    pack_root = tmp_path / "official-packs"

    result = OfficialFactorPackBuilder(
        official_repo_root=_official_repo_root(),
        output_pack_root=pack_root,
    ).build()

    assert set(result.factor_ids) == EXPECTED_OFFICIAL_FACTOR_IDS
    packs = FactorPackRepository(pack_root).discover()
    assert {pack.manifest.id for pack in packs} == EXPECTED_OFFICIAL_FACTOR_IDS


def test_official_factor_bridge_uses_source_factor_xml_contract(tmp_path):
    pack_root = tmp_path / "official-packs"

    OfficialFactorPackBuilder(
        official_repo_root=_official_repo_root(),
        output_pack_root=pack_root,
    ).build()

    pack = FactorPackRepository(pack_root).get("official.user-input-sentiment")

    assert pack.manifest.outputs == ["user_sentiment", "frequency_distribution"]
    assert pack.manifest.run["input_channels"] == "user_input"
    assert pack.manifest.run["required_python_packages"] == "scikit-learn,jieba,rapidfuzz,snownlp"
    assert "dissatisfaction risk" in pack.introduction.summary_en.lower()
    assert "raw body" in pack.introduction.privacy_en.lower()


def test_official_factor_bridge_preserves_semantic_phrase_clusters(tmp_path):
    pack_root = tmp_path / "official-packs"
    OfficialFactorPackBuilder(
        official_repo_root=_official_repo_root(),
        output_pack_root=pack_root,
    ).build()

    factor = FactorPackRepository(pack_root).load("official.semantic-phrase-clusters")
    result = factor.run(
        FactorContext(
            session=SessionEnvelope(
                session_id="s1",
                provider="codex",
                source_ref="/tmp/s1.jsonl",
                events=[
                    SessionEvent(event_id="u1", role="user", content="把项目拉起来"),
                    SessionEvent(event_id="u2", role="user", content="启动 dev server"),
                ],
            )
        )
    )

    assert result.status == "matched"
    assert result.datasets[0]["semantic_type"] == "semantic_phrase_cluster_set"
    assert result.datasets[0]["records"][0]["cluster_id"] == "intent.run_project"
    assert result.tags == [{"type": "semantic_phrase", "value": "clustered"}]


def _official_repo_root() -> Path:
    configured = os.environ.get("EVOZEUS_OFFICIAL_REPO_ROOT")
    if not configured:
        pytest.skip("EVOZEUS_OFFICIAL_REPO_ROOT is required for cross-repo Factor integration tests")
    return Path(configured).expanduser().resolve()
