import json

from evozeus_runtime.factors.protocol import FactorResult, FactorStage
from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository, SessionAnalysisStatus
from evozeus_runtime.reports.ai_usage_profile import AiUsageProfileSnapshot, render_ai_usage_profile_html
from evozeus_runtime.sessions.schema import SessionEnvelope, SessionEvent
from evozeus_runtime.use_cases.generate_ai_usage_profile_report import (
    _high_quality_count,
    _representative_sessions,
    build_ai_usage_profile_payload,
    generate_ai_usage_profile_report,
)


def test_generate_ai_usage_profile_report_uses_skill_synthesis_and_semantic_phrases(tmp_path):
    workspace = tmp_path / "workspace"
    paths = RuntimePaths.for_workspace(workspace).ensure()
    ledger = LedgerRepository(paths)
    session = SessionEnvelope(
        session_id="s1",
        provider="codex",
        source_ref="/tmp/s1.jsonl",
        metadata={"session_title": "检查报告链路", "session_group_label": "EvoZeus-infra"},
        events=[
            SessionEvent(
                event_id="u1",
                role="user",
                content="检查下当前链路，不要只给结果，要给判断依据和验收标准。",
                metadata={
                    "factor_channel": "user_input",
                    "message_scope": "direct_user",
                    "codex_user_origin": "event_msg",
                },
            )
        ],
    )
    ledger.record_factor_run(
        session,
        [
            FactorResult(
                    factor_id="official.key-sentence-trends",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                tags=[{"type": "mbti_profile", "value": "INTJ"}],
                scores={"mbti_profile_confidence": 0.9, "mbti_evidence_count": 16.0},
                statistics={"inferred_type": "INTJ", "known_dimension_count": 4, "evidence_count": 16},
                    datasets=[
                        {
                            "id": "key_sentence_trends",
                            "semantic_type": "key_sentence_trend",
                            "shape": "record_set",
                            "records": [
                                {"cluster_label": "先分析本质和长期定位", "count": 2},
                                {"cluster_label": "给出判断依据、准确标准和验证结果", "count": 2},
                                {"cluster_label": "先制定计划，按顺序完成验收", "count": 2},
                                {"cluster_label": "理解系统框架后再执行", "count": 2},
                            ],
                        },
                    {
                        "id": "mbti_personality_profile",
                        "semantic_type": "mbti_personality_profile",
                        "shape": "record_set",
                        "records": [
                            {
                                "axis": "E-I",
                                "left_pole": "E",
                                "right_pole": "I",
                                "selected_pole": "I",
                                "left_score": 1.0,
                                "right_score": 4.0,
                                "evidence_count": 5.0,
                                "confidence": 0.75,
                            },
                            {
                                "axis": "S-N",
                                "left_pole": "S",
                                "right_pole": "N",
                                "selected_pole": "N",
                                "left_score": 0.0,
                                "right_score": 4.0,
                                "evidence_count": 4.0,
                                "confidence": 0.9,
                            },
                            {
                                "axis": "T-F",
                                "left_pole": "T",
                                "right_pole": "F",
                                "selected_pole": "T",
                                "left_score": 4.0,
                                "right_score": 0.0,
                                "evidence_count": 4.0,
                                "confidence": 0.9,
                            },
                            {
                                "axis": "J-P",
                                "left_pole": "J",
                                "right_pole": "P",
                                "selected_pole": "J",
                                "left_score": 4.0,
                                "right_score": 0.0,
                                "evidence_count": 4.0,
                                "confidence": 0.9,
                            },
                        ],
                    },
                    {
                        "id": "mbti_dimension_evidence",
                        "semantic_type": "mbti_dimension_evidence",
                        "shape": "record_set",
                        "records": [
                            {
                                "event_id": "u1",
                                "axis": "T-F",
                                "pole": "T",
                                "marker": "判断依据",
                                "matched_excerpt": "检查下当前链路，不要只给结果，要给判断依据和验收标准。",
                                "weight": 1.5,
                            }
                        ],
                    },
                ],
                evidence_refs=[{"ref_id": "u1", "kind": "user_turn"}],
                confidence=0.9,
            ),
            FactorResult(
                    factor_id="official.semantic-phrase-clusters",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                            "id": "semantic_phrase_clusters",
                            "semantic_type": "semantic_phrase_cluster_set",
                        "shape": "record_set",
                        "records": [
                                {
                                    "cluster_id": "intent.verifiable_delivery",
                                    "label": "要求可验证交付",
                                    "representative_phrase": "不要只给结果，要给判断依据和验收标准",
                                    "variants": ["不要只给结果，要给判断依据和验收标准", "给出判断依据和验收标准"],
                                    "turn_count": 2,
                                },
                        ],
                    }
                ],
                evidence_refs=[{"ref_id": "u1", "kind": "user_turn"}],
                confidence=0.7,
            ),
        ],
    )

    result = generate_ai_usage_profile_report(workspace_root=workspace, formats=["json", "html"])

    assert result.html_path.exists()
    assert result.json_path.exists()
    assert result.mbti_code == "INTJ"
    payload = json.loads(result.json_path.read_text(encoding="utf-8"))
    assert payload["profile"]["dimensions"][0]["axis"] == "E-I"
    assert payload["profile"]["source"] == "skill_synthesis"
    assert any(row["marker"] == "判断依据" for row in payload["profile"]["evidence"])
    assert payload["usage_patterns"]["frequent_sentences"][0]["text"] == "不要只给结果，要给判断依据和验收标准"
    html = result.html_path.read_text(encoding="utf-8")
    assert "AI 使用画像与 Session 价值报告" in html
    assert "代表性 Session" in html
    assert "zeusAorN 判断依据" in html
    assert "INTJ 倾向" in html
    assert "判断依据" in html
    assert "可验证交付" in html
    assert "检查报告链路" in html
    assert (result.html_path.parent / "assets" / "evozeus-gold-512.png").exists()


def test_ai_usage_profile_report_documents_delegated_task_exclusion(tmp_path):
    workspace = tmp_path / "workspace"
    paths = RuntimePaths.for_workspace(workspace).ensure()
    ledger = LedgerRepository(paths)
    session = SessionEnvelope(
        session_id="delegated",
        provider="codex",
        source_ref="/tmp/delegated.jsonl",
        events=[
            SessionEvent(
                event_id="u1",
                role="user",
                content="你负责审计这个子仓，只读检查，不要编辑。",
                metadata={
                    "factor_channel": "user_input",
                    "message_scope": "delegated_task",
                    "session_thread_source": "subagent",
                    "session_source_kind": "subagent",
                    "subagent_parent_thread_id": "parent",
                    "codex_user_origin": "event_msg_mirror",
                },
            )
        ],
    )
    ledger.record_session_envelope(session)

    result = generate_ai_usage_profile_report(workspace_root=workspace, formats=["json"])
    payload = json.loads(result.json_path.read_text(encoding="utf-8"))

    assert payload["evidence_policy"]["direct_user_only"] is True
    assert payload["evidence_policy"]["accepted_origins"] == ["event_msg", "event_msg_mirror", "response_item_mirror"]
    assert payload["evidence_policy"]["excluded_origins"] == ["synthetic_context"]
    assert "delegated_task" in payload["evidence_policy"]["excluded_scopes"]


def test_ai_usage_profile_synthesizes_mbti_from_cross_factor_user_phrases(tmp_path):
    payload = build_ai_usage_profile_payload(
        statuses=[],
        factor_results=[
            FactorResult(
                factor_id="official.key-sentence-trends",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "key_sentence_trends",
                        "semantic_type": "key_sentence_trend",
                        "shape": "record_set",
                        "records": [
                            {"cluster_label": "先分析本质和长期定位", "count": 2},
                            {"cluster_label": "给出判断依据、准确标准和验证结果", "count": 2},
                            {"cluster_label": "先制定计划，按顺序完成验收", "count": 2},
                            {"cluster_label": "理解系统框架后再执行", "count": 2},
                        ],
                    }
                ],
                confidence=0.8,
            )
        ],
        ledger_path=tmp_path / "results.sqlite3",
    )

    assert payload["profile"]["code"] == "INTJ"
    assert payload["profile"]["source"] == "skill_synthesis"
    assert payload["profile"]["evidence_count"] > 0
    assert payload["profile"]["dimensions"]
    assert payload["profile"]["reason_summary"]


def test_ai_usage_profile_maps_mbti_to_ai_conversation_preferences(tmp_path):
    payload = build_ai_usage_profile_payload(
        statuses=[],
        factor_results=[
            FactorResult(
                factor_id="official.key-sentence-trends",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "key_sentence_trends",
                        "semantic_type": "key_sentence_trend",
                        "shape": "record_set",
                        "records": [
                            {"cluster_label": "先分析本质和全局机制，再修改文件、运行测试并检查数据结果", "count": 3},
                            {"cluster_label": "从第一性原理判断系统框架、长期定位和演进方向", "count": 2},
                            {"cluster_label": "给出判断依据、成功标准、因果逻辑和可验证验收结果", "count": 2},
                            {"cluster_label": "按计划先完成分析，再收敛方案并交付", "count": 2},
                        ],
                    }
                ],
                confidence=0.8,
            )
        ],
        ledger_path=tmp_path / "results.sqlite3",
        subject="Anthony",
    )

    dimensions = {row["axis"]: row for row in payload["profile"]["dimensions"]}
    assert payload["meta"]["subject"] == "Anthony"
    assert payload["profile"]["code"] == "INTJ"
    assert dimensions["S-N"]["selected_pole"] == "N"
    assert dimensions["S-N"]["selected_label"] == "抽象推演"
    assert dimensions["T-F"]["selected_pole"] == "T"
    assert dimensions["T-F"]["selected_label"] == "逻辑决策"

    html = render_ai_usage_profile_html(
        AiUsageProfileSnapshot(
            payload=payload,
            ledger_path=tmp_path / "results.sqlite3",
            markdown_href="summary.md",
        )
    )
    assert "Anthony" in html
    assert "先追问本质、机制、系统关系和长期方向" in html
    assert "用逻辑、因果、标准和验证结果" in html


def test_ai_usage_profile_repeated_request_sentence_counts_unique_turns_not_weighted_chains(tmp_path):
    repeated_text = "每次挪动一个node的时候，我需要same layer的和between layer的node 的距离都是 最佳排布"
    payload = build_ai_usage_profile_payload(
        statuses=[],
        factor_results=[
            FactorResult(
                factor_id="official.repeated-request",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "repeated_request_events",
                        "semantic_type": "evidence_record_set",
                        "shape": "record_set",
                        "records": [
                            {
                                "chain_id": "repeat_chain_1",
                                "first_event_id": "u1",
                                "repeat_event_id": "u2",
                                "repeat_input_text": repeated_text,
                                "similarity_score": 1.0,
                            },
                            {
                                "chain_id": "repeat_chain_2",
                                "first_event_id": "u1",
                                "repeat_event_id": "u3",
                                "repeat_input_text": repeated_text,
                                "similarity_score": 1.0,
                            },
                        ],
                    }
                ],
                confidence=0.72,
            )
        ],
        ledger_path=tmp_path / "results.sqlite3",
    )

    sentence = payload["usage_patterns"]["frequent_sentences"][0]
    assert sentence["text"] == repeated_text
    assert sentence["category"] == "重复请求代表句"
    assert sentence["chain_count"] == 2
    assert sentence["occurrence_count"] == 3
    assert sentence["count_label"] == "2 条重复链 / 3 turns"


def test_ai_usage_profile_merges_repeated_request_with_existing_key_sentence_candidate(tmp_path):
    repeated_text = "结合后端代码，帮我总结一份接口文档用openapi输出"
    payload = build_ai_usage_profile_payload(
        statuses=[],
        factor_results=[
            FactorResult(
                factor_id="official.key-sentence-trends",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "key_sentence_trend",
                        "semantic_type": "key_sentence_trend",
                        "shape": "record_set",
                        "records": [{"cluster_label": repeated_text, "count": 1, "score": 1.0}],
                    }
                ],
                confidence=0.7,
            ),
            FactorResult(
                factor_id="official.repeated-request",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "repeated_request_events",
                        "semantic_type": "evidence_record_set",
                        "shape": "record_set",
                        "records": [
                            {
                                "chain_id": "repeat_chain_1",
                                "first_event_id": "u1",
                                "repeat_event_id": "u2",
                                "repeat_input_text": repeated_text,
                                "similarity_score": 1.0,
                            }
                        ],
                    }
                ],
                confidence=0.72,
            ),
        ],
        ledger_path=tmp_path / "results.sqlite3",
    )

    sentence = payload["usage_patterns"]["frequent_sentences"][0]
    assert sentence["text"] == repeated_text
    assert sentence["category"] == "重复请求代表句"
    assert sentence["count_label"] == "1 条重复链 / 2 turns"


def test_ai_usage_profile_uses_semantic_phrase_clusters_instead_of_sentence_cloud(tmp_path):
    payload = build_ai_usage_profile_payload(
        statuses=[],
        factor_results=[
            FactorResult(
                factor_id="official.semantic-phrase-clusters",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "semantic_phrase_clusters",
                        "semantic_type": "semantic_phrase_cluster_set",
                        "shape": "record_set",
                        "records": [
                            {
                                "cluster_id": "intent.run_project",
                                "label": "启动/运行项目",
                                "representative_phrase": "把项目拉起来",
                                "variants": ["把项目拉起来", "启动 dev server"],
                                "turn_count": 2,
                                "session_count": 1,
                            }
                        ],
                    }
                ],
                confidence=0.82,
            )
        ],
        ledger_path=tmp_path / "results.sqlite3",
    )

    phrase = payload["usage_patterns"]["cross_session_phrases"][0]
    assert phrase["cluster_id"] == "intent.run_project"
    assert phrase["text"] == "把项目拉起来"
    assert phrase["variants"] == ["把项目拉起来", "启动 dev server"]
    assert phrase["occurrence_count"] == 2


def test_high_quality_count_ignores_neutral_or_ordinary_completion() -> None:
    ordinary_completion = FactorResult(
        factor_id="official.task-completion",
        factor_version="v0.1.0",
        framework_id="evozeus.official",
        stage=FactorStage.SIGNAL_EXTRACTION,
        target_type="session",
        target_id="ordinary",
        session_id="ordinary",
        status="matched",
        statistics={"verdict": "completed", "verification": "verified"},
        confidence=0.9,
    )
    neutral_sentiment = FactorResult(
        factor_id="official.user-input-sentiment",
        factor_version="v0.1.0",
        framework_id="evozeus.official",
        stage=FactorStage.SIGNAL_EXTRACTION,
        target_type="session",
        target_id="ordinary",
        session_id="ordinary",
        status="not_matched",
        statistics={"dominant_sentiment_kind": "neutral_request"},
        confidence=0.7,
    )
    correction = FactorResult(
        factor_id="official.user-input-sentiment",
        factor_version="v0.1.0",
        framework_id="evozeus.official",
        stage=FactorStage.SIGNAL_EXTRACTION,
        target_type="session",
        target_id="correction",
        session_id="correction",
        status="matched",
        statistics={"dominant_sentiment_kind": "correction_request", "dissatisfaction_turn_count": 1},
        confidence=0.9,
    )

    assert _high_quality_count([ordinary_completion, neutral_sentiment]) == 0
    assert _high_quality_count([ordinary_completion, neutral_sentiment, correction]) == 1


def test_representative_sessions_put_high_quality_candidates_first() -> None:
    def status(session_id: str) -> SessionAnalysisStatus:
        return SessionAnalysisStatus(
            session_id=session_id,
            provider="codex",
            project_key="project",
            project_label="Project",
            source_ref=f"/tmp/{session_id}.jsonl",
            event_count=10,
            discovered_at="2026-07-11T00:00:00Z",
            last_analyzed_at="2026-07-11T00:00:00Z",
            analyzed_factor_count=7,
            pending_factor_count=0,
        )

    rows = _representative_sessions([status("ordinary"), status("high")], {"high"})

    assert rows[0]["session_id"] == "high"
    assert rows[0]["label"] == "高质量候选"
    assert rows[1]["label"] == "低质量 / 待复核"
