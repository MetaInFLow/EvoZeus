from pathlib import Path

import pytest

from evozeus_runtime.reports.ai_usage_profile import (
    AiUsageProfileSnapshot,
    render_ai_usage_profile_html,
    validate_ai_usage_profile_payload,
)


def _payload() -> dict:
    return {
        "schema_version": "evozeus.ai_usage_profile_report.v1",
        "meta": {
            "subject": "用户",
            "generated_at": "2026-07-09T00:00:00+08:00",
            "scan_scope": "local_codex_sessions",
            "ledger_path": "/tmp/results.sqlite3",
        },
        "profile": {
            "code": "INTJ",
            "display_name": "INTJ 倾向",
            "archetype": "战略型拆解者",
            "confidence": 0.9,
            "evidence_count": 16,
            "known_dimensions": "4/4",
            "one_sentence": "先定义问题、标准和边界，再推动 AI 执行。",
            "reason_summary": ["T-F 选择 T：T 4.0 vs F 0.0"],
            "dimensions": [
                {
                    "axis": "T-F",
                    "selected_pole": "T",
                    "left_score": 4.0,
                    "right_score": 0.0,
                    "evidence_count": 4.0,
                    "confidence": 0.9,
                }
            ],
            "evidence": [
                {
                    "event_id": "u1",
                    "axis": "T-F",
                    "pole": "T",
                    "marker": "判断依据",
                    "matched_excerpt": "先定义成功标准。",
                    "weight": 1.5,
                }
            ],
        },
        "session_review": {
            "scanned_sessions_total": 3,
            "analyzed_sessions_total": 3,
            "high_quality_sessions": 1,
            "low_quality_sessions": 2,
            "factor_results": 24,
            "representative_sessions": [
                {
                    "session_id": "s1",
                    "title": "检查报告链路",
                    "label": "高质量候选",
                    "reason": "用户重复要求看到最终 HTML 报告。",
                }
            ],
        },
        "usage_patterns": {
            "cross_session_phrases": [{"text": "检查下", "session_count": 2, "occurrence_count": 3}],
            "frequent_sentences": [{"text": "不要只给结果，要给判断依据", "count": 2, "weight": 3.0}],
            "session_local_repeats": [],
            "protocol_templates": [{"text": "先整体 / 全局 / 链路", "occurrence_count": 4}],
            "delegated_task_phrases": [],
        },
        "factor_summary": {
            "mbti": {"code": "INTJ", "confidence": 0.9},
            "key_sentences": [{"label": "先定义成功标准", "count": 2}],
            "repeated_requests": [{"session_id": "s1", "summary": "重复要求看到报告"}],
            "sentiment": {"dominant": "correction"},
            "resource_usage": {"skills": 3, "tools": 5},
            "tool_failures": {"total": 1},
            "task_completion": {"completed": 2, "not_completed": 1},
        },
        "evidence_policy": {
            "direct_user_only": True,
            "accepted_origins": ["event_msg", "event_msg_mirror", "response_item_mirror"],
            "excluded_origins": ["synthetic_context"],
            "excluded_scopes": ["delegated_task", "automation", "subagent_event", "context_wrapper"],
            "source_fields": ["session_id", "event_id", "source_ref", "source_line"],
        },
    }


def test_validate_ai_usage_profile_payload_accepts_complete_payload():
    validate_ai_usage_profile_payload(_payload())


def test_validate_ai_usage_profile_payload_rejects_missing_profile_field():
    payload = _payload()
    del payload["profile"]["code"]

    with pytest.raises(ValueError, match="profile.code"):
        validate_ai_usage_profile_payload(payload)


def test_render_ai_usage_profile_html_includes_mbti_and_old_review_content():
    html = render_ai_usage_profile_html(
        AiUsageProfileSnapshot(
            payload=_payload(),
            ledger_path=Path("/tmp/results.sqlite3"),
            markdown_href="summary.md",
        )
    )

    assert "INTJ 倾向" in html
    assert "战略型拆解者" in html
    assert "AI 使用画像与 Session 价值报告" in html
    assert "AI 使用画像<br>年度评测报告" in html
    assert "zeusAorN 四维画像" in html
    assert "下一阶段使用处方" in html
    assert "@media (max-width: 760px)" in html
    assert 'id="scrollProgressBar"' in html
    assert "initScrollStory" in html
    assert "IntersectionObserver" in html
    assert "prefers-reduced-motion: reduce" in html
    assert "代表性 Session" in html
    assert "zeusAorN 判断依据" in html
    assert "不要只给结果，要给判断依据" in html
    assert "判断依据" in html
    assert "T-F 选择 T" in html
    assert "检查下" not in html
    assert "高质量候选" in html
    assert "重复要求看到报告" in html
    assert "任务完成" in html
    assert "证据口径" in html
    assert "direct_user_only" in html
