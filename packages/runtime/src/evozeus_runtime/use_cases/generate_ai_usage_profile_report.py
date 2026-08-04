from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any

from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository, SessionAnalysisStatus
from evozeus_runtime.reports.ai_usage_profile import (
    AiUsageProfileSnapshot,
    copy_ai_usage_profile_assets,
    render_ai_usage_profile_html,
)


@dataclass(frozen=True)
class GenerateAiUsageProfileReportResult:
    html_path: Path
    json_path: Path
    markdown_path: Path
    ledger_path: Path
    session_count: int
    factor_result_count: int
    mbti_code: str


def generate_ai_usage_profile_report(
    *,
    workspace_root: Path,
    formats: list[str],
    output_dir: Path | None = None,
    subject: str = "用户",
    session_ids: tuple[str, ...] | None = None,
) -> GenerateAiUsageProfileReportResult:
    paths = RuntimePaths.for_workspace(workspace_root).ensure()
    ledger = LedgerRepository(paths)
    statuses = ledger.list_session_statuses()
    if session_ids is not None:
        allowed_session_ids = set(session_ids)
        statuses = [status for status in statuses if status.session_id in allowed_session_ids]
    factor_results = [
        result
        for status in statuses
        for result in ledger.list_factor_results(session_id=status.session_id)
    ]
    payload = build_ai_usage_profile_payload(
        statuses=statuses,
        factor_results=factor_results,
        ledger_path=paths.result_index_db,
        subject=subject,
    )

    report_dir = output_dir or (paths.runtime_root / "reports" / "ai-usage-profile")
    report_dir.mkdir(parents=True, exist_ok=True)
    html_path = report_dir / "index.html"
    json_path = report_dir / "report-data.json"
    markdown_path = report_dir / "summary.md"

    if "json" in formats:
        json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if "markdown" in formats:
        markdown_path.write_text(_render_markdown_summary(payload), encoding="utf-8")
    if "html" in formats:
        copy_ai_usage_profile_assets(report_dir)
        html_path.write_text(
            render_ai_usage_profile_html(
                AiUsageProfileSnapshot(
                    payload=payload,
                    ledger_path=paths.result_index_db,
                    markdown_href=markdown_path.name,
                )
            ),
            encoding="utf-8",
        )

    return GenerateAiUsageProfileReportResult(
        html_path=html_path,
        json_path=json_path,
        markdown_path=markdown_path,
        ledger_path=paths.result_index_db,
        session_count=len(statuses),
        factor_result_count=len(factor_results),
        mbti_code=str(payload["profile"]["code"]),
    )


def build_ai_usage_profile_payload(
    *,
    statuses: list[SessionAnalysisStatus],
    factor_results: list[Any],
    ledger_path: Path,
    subject: str = "用户",
) -> dict[str, Any]:
    mbti = _best_mbti(factor_results)
    high_quality_session_ids = _high_quality_session_ids(factor_results)
    high_quality_count = len(high_quality_session_ids)
    return {
        "schema_version": "evozeus.ai_usage_profile_report.v1",
        "meta": {
            "subject": subject.strip() or "用户",
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "scan_scope": "local_codex_sessions",
            "ledger_path": str(ledger_path),
        },
        "profile": mbti,
        "session_review": {
            "scanned_sessions_total": len(statuses),
            "analyzed_sessions_total": len(statuses),
            "high_quality_sessions": high_quality_count,
            "low_quality_sessions": max(0, len(statuses) - high_quality_count),
            "factor_results": len(factor_results),
            "representative_sessions": _representative_sessions(statuses, high_quality_session_ids),
        },
        "usage_patterns": {
            "cross_session_phrases": _usage_phrases(factor_results),
            "frequent_sentences": _frequent_sentences(factor_results),
            "session_local_repeats": [],
            "protocol_templates": _protocol_templates(factor_results),
            "delegated_task_phrases": [],
        },
        "factor_summary": {
            "mbti": mbti,
            "key_sentences": _dataset_records(factor_results, "key_sentence_trend")[:20],
            "repeated_requests": _dataset_records(factor_results, "evidence_record_set")[:20],
            "sentiment": _sentiment_summary(factor_results),
            "resource_usage": _resource_summary(factor_results),
            "tool_failures": _tool_failure_summary(factor_results),
            "task_completion": _completion_counts(factor_results),
        },
        "evidence_policy": {
            "direct_user_only": True,
            "accepted_origins": ["event_msg", "event_msg_mirror", "response_item_mirror"],
            "excluded_origins": ["synthetic_context"],
            "excluded_scopes": ["delegated_task", "automation", "subagent_event", "context_wrapper"],
            "source_fields": ["session_id", "event_id", "source_ref", "source_line"],
        },
    }


def _best_mbti(factor_results: list[Any]) -> dict[str, Any]:
    signals = _profile_signal_records(factor_results)
    if not signals:
        return {
            "code": "UNKNOWN",
            "display_name": "证据不足",
            "archetype": "待观察使用画像",
            "confidence": 0.0,
            "evidence_count": 0,
            "known_dimensions": "0/4",
            "one_sentence": "当前 session 证据不足，暂不推断 MBTI 倾向。",
            "source": "skill_synthesis",
            "dimensions": [],
            "evidence": [],
            "reason_summary": ["七个 Factor 尚未提取到足够的直接用户表达。"],
        }

    dimensions: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    selected_letters: list[str] = []
    confidence_values: list[float] = []
    for axis, (left, right, _left_label, _right_label) in MBTI_AXIS_DEFINITIONS.items():
        left_score, right_score, axis_evidence = _score_mbti_axis(signals, axis, left, right)
        total = left_score + right_score
        if total < 2.0 or left_score == right_score:
            selected = "X"
            confidence = 0.0
        elif left_score > right_score:
            selected = left
            confidence = _axis_confidence(left_score, right_score)
        else:
            selected = right
            confidence = _axis_confidence(right_score, left_score)
        selected_letters.append(selected)
        if selected != "X":
            confidence_values.append(confidence)
        dimensions.append(
            {
                "axis": axis,
                "left_pole": left,
                "right_pole": right,
                "selected_pole": selected,
                "selected_label": MBTI_SELECTED_SHORT.get(selected, selected),
                "left_score": round(left_score, 3),
                "right_score": round(right_score, 3),
                "evidence_count": len(axis_evidence),
                "confidence": confidence,
                "score": round(max(left_score, right_score) / total, 4) if total else 0.0,
            }
        )
        evidence.extend(axis_evidence)

    known_dimension_count = sum(1 for letter in selected_letters if letter != "X")
    code = "".join(selected_letters) if known_dimension_count >= 2 else "UNKNOWN"
    confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0.0
    reason_summary = _mbti_reason_summary(dimensions, code)
    return {
        "code": code,
        "display_name": f"{code} 倾向" if code != "UNKNOWN" else "证据不足",
        "archetype": _mbti_archetype(code),
        "confidence": round(confidence, 3),
        "evidence_count": len(evidence),
        "known_dimensions": f"{known_dimension_count}/4",
        "one_sentence": _mbti_one_sentence(code),
        "dimensions": dimensions,
        "evidence": sorted(evidence, key=lambda row: (-float(row["weight"]), str(row["axis"])))[:80],
        "reason_summary": reason_summary,
        "source": "skill_synthesis",
    }


def _profile_signal_records(factor_results: list[Any]) -> list[dict[str, Any]]:
    by_signal: dict[tuple[str, str], dict[str, Any]] = {}
    for result in factor_results:
        session_id = str(result.session_id or result.target_id or "")
        candidates: list[tuple[str, float, str]] = []
        for record in _result_dataset_records(result, "key_sentence_trend"):
            candidates.append((str(record.get("cluster_label") or ""), float(record.get("count") or 1), ""))
        for record in _result_dataset_records(result, "semantic_phrase_cluster_set"):
            event_ids = [str(value) for value in record.get("sample_event_ids") or []]
            for index, variant in enumerate(record.get("variants") or []):
                candidates.append((str(variant), 1.0, event_ids[index] if index < len(event_ids) else ""))
        for record in _result_dataset_records(result, "evidence_record_set"):
            candidates.append(
                (
                    str(record.get("repeat_input_text") or record.get("first_input_text") or ""),
                    1.0,
                    str(record.get("repeat_event_id") or record.get("event_id") or ""),
                )
            )
        for record in _result_dataset_records(result, "user_sentiment"):
            candidates.append(
                (
                    str(record.get("input_text") or record.get("matched_excerpt") or ""),
                    1.0,
                    str(record.get("event_id") or ""),
                )
            )
        for text, weight, event_id in candidates:
            normalized = " ".join(text.split()).strip()
            if not normalized:
                continue
            key = (session_id, normalized)
            existing = by_signal.get(key)
            if existing is None or float(existing["weight"]) < weight:
                by_signal[key] = {
                    "text": normalized,
                    "weight": min(3.0, max(1.0, weight)),
                    "event_id": event_id,
                    "session_id": session_id,
                    "factor_id": result.factor_id,
                }
    return list(by_signal.values())


def _score_mbti_axis(
    signals: list[dict[str, Any]],
    axis: str,
    left: str,
    right: str,
) -> tuple[float, float, list[dict[str, Any]]]:
    session_scores: dict[str, dict[str, float]] = defaultdict(lambda: {left: 0.0, right: 0.0})
    evidence: list[dict[str, Any]] = []
    for signal in signals:
        text = str(signal["text"])
        lowered = text.casefold()
        base_weight = float(signal["weight"])
        matches_by_pole: dict[str, list[tuple[str, float]]] = {}
        for pole, markers in MBTI_SYNTHESIS_MARKERS[axis].items():
            matches = [(marker, strength) for marker, strength in markers if marker.casefold() in lowered]
            if matches:
                matches_by_pole[pole] = matches
        if not matches_by_pole:
            continue

        mixed_signal_factor = 0.8 if len(matches_by_pole) > 1 else 1.0
        session_id = str(signal["session_id"])
        for pole, matches in matches_by_pole.items():
            marker_strength = min(2.5, sum(strength for _, strength in matches))
            signal_score = base_weight * marker_strength * mixed_signal_factor
            session_scores[session_id][pole] += signal_score
            for marker, strength in matches:
                evidence.append(
                    {
                        "event_id": signal["event_id"],
                        "axis": axis,
                        "pole": pole,
                        "marker": marker,
                        "matched_excerpt": text[:160],
                        "weight": round(base_weight * strength * mixed_signal_factor, 3),
                        "session_id": session_id,
                        "factor_id": signal["factor_id"],
                    }
                )

    left_score = sum(min(6.0, row[left]) for row in session_scores.values())
    right_score = sum(min(6.0, row[right]) for row in session_scores.values())
    return round(left_score, 3), round(right_score, 3), evidence


def _usage_phrases(factor_results: list[Any]) -> list[dict[str, Any]]:
    by_cluster: dict[str, dict[str, Any]] = {}
    for result in factor_results:
        for record in _result_dataset_records(result, "semantic_phrase_cluster_set"):
            cluster_id = str(record.get("cluster_id") or "").strip()
            text = str(record.get("representative_phrase") or record.get("label") or "").strip()
            if not cluster_id or not text:
                continue
            item = by_cluster.setdefault(
                cluster_id,
                {
                    "cluster_id": cluster_id,
                    "label": str(record.get("label") or text),
                    "text": text,
                    "count": 0,
                    "variants": set(),
                    "session_ids": set(),
                },
            )
            item["count"] += int(record.get("turn_count") or 1)
            item["variants"].update(str(value) for value in record.get("variants") or [] if str(value).strip())
            item["session_ids"].add(str(result.session_id or result.target_id))

    rows = []
    for item in by_cluster.values():
        rows.append(
            {
                "cluster_id": item["cluster_id"],
                "label": item["label"],
                "text": item["text"],
                "count": item["count"],
                "occurrence_count": item["count"],
                "weight": float(item["count"]),
                "variants": [item["text"], *sorted(item["variants"] - {item["text"]})],
                "session_count": len(item["session_ids"]),
                "sample_session_ids": sorted(item["session_ids"])[:5],
            }
        )
    rows.sort(key=lambda row: (-int(row["count"]), str(row["text"])))
    return rows[:50]


def _frequent_sentences(factor_results: list[Any]) -> list[dict[str, Any]]:
    by_text: dict[str, dict[str, Any]] = {}
    for result in factor_results:
        session_id = str(result.session_id or result.target_id)
        for record in _result_dataset_records(result, "evidence_record_set"):
            if result.factor_id != "official.repeated-request":
                continue
            text = _representative_sentence_from_text(
                str(record.get("repeat_input_text") or record.get("first_input_text") or record.get("request_signature") or "")
            )
            _add_repeated_request_sentence_candidate(by_text, text, record, session_id)
        for record in _result_dataset_records(result, "key_sentence_trend"):
            text = str(record.get("cluster_label") or record.get("text") or record.get("sentence") or "").strip()
            _add_sentence_candidate(
                by_text,
                text,
                int(record.get("count") or 1),
                float(record.get("score") or record.get("count") or 1.0),
                session_id,
                "关键句趋势",
            )
        for record in _result_dataset_records(result, "semantic_phrase_cluster_set"):
            text = str(record.get("representative_phrase") or record.get("label") or "").strip()
            _add_sentence_candidate(
                by_text,
                text,
                int(record.get("turn_count") or 1),
                float(record.get("turn_count") or 1),
                session_id,
                "语义短句簇",
            )

    rows = list(by_text.values())
    preferred_rows = [row for row in rows if _cjk_count(str(row["text"])) >= 6]
    if len(preferred_rows) >= 5:
        rows = preferred_rows
    rows.sort(
        key=lambda row: (
            -int(row["count"]),
            -float(row["weight"]),
            -int(row["session_count"]),
            -len(str(row["text"])),
            str(row["text"]),
        )
    )
    return [
        {
            "text": row["text"],
            "count": row["count"],
            "occurrence_count": row["occurrence_count"],
            "weight": round(float(row["weight"]), 3),
            "session_count": row["session_count"],
            "sample_session_ids": row["sample_session_ids"],
            "category": row.get("category", "高频短句"),
            "chain_count": row.get("chain_count", 0),
            "count_label": row.get("count_label") or f"{row['count']} 次",
            "reason": "来自 direct-user session 中重复出现的完整短句，已过滤代码、日志、模板标题和单词碎片。",
        }
        for row in rows[:30]
    ]


def _add_repeated_request_sentence_candidate(
    by_text: dict[str, dict[str, Any]],
    text: str,
    record: dict[str, Any],
    session_id: str,
) -> None:
    text = " ".join(str(text or "").split()).strip()
    if not _is_report_sentence(text):
        return
    item = by_text.setdefault(
        text,
        {
            "text": text,
            "count": 0,
            "occurrence_count": 0,
            "weight": 0.0,
            "session_ids": set(),
            "event_ids": set(),
            "chain_count": 0,
            "category": "重复请求代表句",
        },
    )
    item["category"] = "重复请求代表句"
    item.setdefault("event_ids", set())
    item.setdefault("chain_count", 0)
    item["chain_count"] += 1
    for key in ("first_event_id", "repeat_event_id", "event_id"):
        event_id = str(record.get(key) or "")
        if event_id:
            item["event_ids"].add(event_id)
    if session_id:
        item["session_ids"].add(session_id)
    unique_turn_count = len(item["event_ids"]) or int(item["chain_count"])
    item["count"] = unique_turn_count
    item["occurrence_count"] = unique_turn_count
    item["weight"] = float(item["chain_count"])
    item["session_count"] = len(item["session_ids"])
    item["sample_session_ids"] = sorted(item["session_ids"])[:5]
    item["count_label"] = f"{item['chain_count']} 条重复链 / {unique_turn_count} turns"


def _add_sentence_candidate(
    by_text: dict[str, dict[str, Any]],
    text: str,
    count: int,
    weight: float,
    session_id: str,
    category: str,
) -> None:
    text = " ".join(str(text or "").split()).strip()
    if not _is_report_sentence(text):
        return
    item = by_text.setdefault(
        text,
        {"text": text, "count": 0, "occurrence_count": 0, "weight": 0.0, "session_ids": set(), "category": category},
    )
    item["count"] += max(1, int(count))
    item["occurrence_count"] = item["count"]
    item["weight"] += float(weight)
    if session_id:
        item["session_ids"].add(session_id)
    item["session_count"] = len(item["session_ids"])
    item["sample_session_ids"] = sorted(item["session_ids"])[:5]


def _representative_sentence_from_text(value: str) -> str:
    for part in re.split(r"[\n\r。！？!?；;]+", value):
        normalized = " ".join(part.split()).strip("` -*#0123456789）).、 ")
        if _is_report_sentence(normalized):
            return normalized
    compact = " ".join(value.split()).strip()
    if _cjk_count(compact) >= 6 and len(compact) > 96:
        return compact[:96]
    return compact


def _protocol_templates(factor_results: list[Any]) -> list[dict[str, Any]]:
    phrases = _frequent_sentences(factor_results) or _usage_phrases(factor_results)
    protocol_terms = ("标准", "验收", "判断依据", "不要只给结果", "全链路", "检查")
    return [
        {"text": item["text"], "occurrence_count": item["occurrence_count"], "session_count": item["session_count"]}
        for item in phrases
        if any(term in item["text"] for term in protocol_terms)
    ][:20]


def _dataset_records(factor_results: list[Any], semantic_type: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for result in factor_results:
        for record in _result_dataset_records(result, semantic_type):
            rows.append(
                {
                    **record,
                    "session_id": result.session_id or result.target_id,
                    "factor_id": result.factor_id,
                    "confidence": result.confidence,
                }
            )
    return rows


def _completion_counts(factor_results: list[Any]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for result in factor_results:
        if result.factor_id != "official.task-completion":
            continue
        status = str(
            result.statistics.get("completion_status")
            or result.statistics.get("verdict")
            or _tag_value(result.tags, "task_completion")
            or result.status
        )
        counter[status] += 1
    return dict(counter) if counter else {"unknown": 0}


def _high_quality_count(factor_results: list[Any]) -> int:
    return len(_high_quality_session_ids(factor_results))


def _high_quality_session_ids(factor_results: list[Any]) -> set[str]:
    session_ids: set[str] = set()
    for result in factor_results:
        session_id = str(result.session_id or result.target_id or "")
        if not session_id:
            continue
        if result.factor_id == "official.user-input-sentiment":
            kinds = {
                str(record.get("sentiment_kind") or "")
                for record in _result_dataset_records(result, "user_sentiment")
            }
            dominant = str(result.statistics.get("dominant_sentiment_kind") or _tag_value(result.tags, "user_sentiment"))
            if kinds.intersection({"dissatisfaction", "problem_report", "correction_request"}) or dominant in {
                "dissatisfaction",
                "problem_report",
                "correction_request",
            }:
                session_ids.add(session_id)
        elif result.factor_id == "official.repeated-request":
            if _result_dataset_records(result, "evidence_record_set"):
                session_ids.add(session_id)
        elif result.factor_id == "official.task-completion":
            verdict = str(result.statistics.get("verdict") or _tag_value(result.tags, "task_completion"))
            if verdict in {"blocked", "not_completed"}:
                session_ids.add(session_id)
    return session_ids


def _representative_sessions(
    statuses: list[SessionAnalysisStatus],
    high_quality_session_ids: set[str],
) -> list[dict[str, Any]]:
    rows = []
    ordered_statuses = sorted(statuses, key=lambda status: status.session_id not in high_quality_session_ids)
    for status in ordered_statuses[:30]:
        rows.append(
            {
                "session_id": status.session_id,
                "title": status.session_title or status.session_id,
                "project": status.project_label or status.project_key,
                "label": "高质量候选" if status.session_id in high_quality_session_ids else "低质量 / 待复核",
                "first_user_preview": status.first_user_preview,
                "last_assistant_preview": status.last_assistant_preview,
                "source_ref": status.source_ref,
            }
        )
    return rows


def _sentiment_summary(factor_results: list[Any]) -> dict[str, Any]:
    counter: Counter[str] = Counter()
    for result in factor_results:
        if result.factor_id != "official.user-input-sentiment":
            continue
        value = str(result.statistics.get("dominant_sentiment_kind") or _tag_value(result.tags, "user_sentiment") or result.status)
        counter[value] += 1
    return {"dominant": counter.most_common(1)[0][0], "counts": dict(counter)} if counter else {"dominant": "unknown", "counts": {}}


def _resource_summary(factor_results: list[Any]) -> dict[str, Any]:
    records = _dataset_records(factor_results, "session_resource_usage")
    counter: Counter[str] = Counter(str(record.get("resource_type") or "unknown") for record in records)
    return {"total": len(records), "by_type": dict(counter)}


def _tool_failure_summary(factor_results: list[Any]) -> dict[str, Any]:
    records = _dataset_records(factor_results, "frequency_distribution")
    failure_records = [record for record in records if record.get("factor_id") == "official.tool-failure-frequency"]
    total = sum(int(record.get("count") or 0) for record in failure_records)
    return {"total": total, "records": failure_records[:20]}


def _render_markdown_summary(payload: dict[str, Any]) -> str:
    profile = payload["profile"]
    review = payload["session_review"]
    return "\n".join(
        [
            "# EvoZeus AI Usage Profile",
            "",
            f"- MBTI 倾向：{profile['display_name']}",
            f"- 画像置信度：{profile['confidence']}",
            f"- 分析 sessions：{review['analyzed_sessions_total']}",
            f"- Factor results：{review['factor_results']}",
            "",
        ]
    )


def _result_dataset_records(result: Any, semantic_type: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for dataset in result.datasets:
        if str(dataset.get("semantic_type") or "") != semantic_type:
            continue
        dataset_records = dataset.get("records")
        if isinstance(dataset_records, list):
            records.extend(record for record in dataset_records if isinstance(record, dict))
    return records


def _tag_value(tags: list[dict[str, str]], tag_type: str) -> str:
    for tag in tags:
        if tag.get("type") == tag_type:
            return str(tag.get("value") or "")
    return ""


def _mbti_profile_details(factor_results: list[Any], selected_code: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    selected_results = [result for result in factor_results if _result_mbti_code(result) == selected_code] or factor_results
    dimensions = _aggregate_mbti_dimensions(selected_results, selected_code)
    evidence = _mbti_evidence_records(selected_results)
    reason_summary = _mbti_reason_summary(dimensions, selected_code)
    return dimensions, evidence, reason_summary


def _result_mbti_code(result: Any) -> str:
    return str(result.statistics.get("inferred_type") or _tag_value(result.tags, "mbti_profile") or "UNKNOWN")


MBTI_AXIS_DEFINITIONS = {
    "E-I": ("E", "I", "对话共创", "独立建模"),
    "S-N": ("S", "N", "事实落地", "抽象推演"),
    "T-F": ("T", "F", "逻辑决策", "价值体验"),
    "J-P": ("J", "P", "计划收敛", "开放探索"),
}
MBTI_AXIS_ORDER = ("E-I", "S-N", "T-F", "J-P")
MBTI_SYNTHESIS_MARKERS = {
    "E-I": {
        "E": (("和我讨论", 1.4), ("一起讨论", 1.4), ("来回讨论", 1.2), ("共创", 1.3), ("头脑风暴", 1.2), ("你问我", 1.0), ("聊聊", 1.0)),
        "I": (("先分析", 1.2), ("仔细研究", 1.4), ("深入思考", 1.4), ("先理解", 1.2), ("本质", 1.0), ("独立完成", 1.4), ("直接完成", 1.0), ("推导", 1.0), ("模型", 0.8)),
    },
    "S-N": {
        "S": (("给我具体", 1.3), ("具体步骤", 1.3), ("按现有", 1.0), ("逐项", 1.0), ("实际结果", 1.2), ("直接告诉我怎么做", 1.4), ("不要抽象", 1.5), ("照着", 1.0), ("原样", 1.0), ("一步一步", 1.1)),
        "N": (("第一性", 1.5), ("本质", 1.3), ("全局", 1.3), ("为什么", 1.1), ("长期", 1.0), ("定位", 1.0), ("框架", 1.0), ("原则", 1.1), ("机制", 1.0), ("哲学", 1.2), ("抽象", 1.0), ("演进", 1.0), ("战略", 1.0), ("整体", 0.7), ("系统", 0.6), ("方向", 0.5), ("模式", 0.5)),
    },
    "T-F": {
        "T": (("判断依据", 1.5), ("成功标准", 1.4), ("验收标准", 1.5), ("因果", 1.2), ("验证", 1.2), ("逻辑", 1.0), ("准确", 1.0), ("权衡", 1.0), ("证据", 1.0), ("约束", 0.8), ("算法", 0.8), ("标准", 0.8), ("测试", 0.5), ("数据", 0.4)),
        "F": (("体验优先", 1.4), ("用户视角", 1.0), ("我不喜欢", 1.0), ("我喜欢", 1.0), ("说人话", 1.0), ("感受", 1.0), ("看不懂", 0.8), ("更自然", 0.8), ("设计感", 0.7), ("价值", 0.6), ("太丑", 0.5), ("好看", 0.5)),
    },
    "J-P": {
        "J": (("按计划", 1.2), ("按顺序", 1.2), ("先完成", 1.0), ("再收敛", 1.1), ("验收", 1.0), ("完成", 0.7), ("必须", 0.8), ("明确", 0.8), ("固定", 0.8), ("收敛", 1.0), ("交付", 0.8), ("计划", 0.8), ("然后", 0.5)),
        "P": (("多几个方向", 1.4), ("头脑风暴", 1.3), ("开放探索", 1.3), ("发散", 1.2), ("探索", 1.0), ("备选", 1.0), ("试试", 0.8), ("灵活", 0.8), ("创意", 0.8), ("可能", 0.5)),
    },
}
MBTI_SELECTED_SHORT = {
    "E": "对话共创",
    "I": "独立建模",
    "S": "事实落地",
    "N": "抽象推演",
    "T": "逻辑决策",
    "F": "价值体验",
    "J": "计划收敛",
    "P": "开放探索",
    "X": "证据不足",
}


def _aggregate_mbti_dimensions(factor_results: list[Any], selected_code: str) -> list[dict[str, Any]]:
    totals: dict[str, dict[str, Any]] = {
        axis: {
            "axis": axis,
            "left_pole": left,
            "right_pole": right,
            "left_score": 0.0,
            "right_score": 0.0,
            "evidence_count": 0.0,
        }
        for axis, (left, right, _left_label, _right_label) in MBTI_AXIS_DEFINITIONS.items()
    }
    for result in factor_results:
        for record in _result_dataset_records(result, "mbti_personality_profile"):
            axis = str(record.get("axis") or "")
            if axis not in totals:
                continue
            row = totals[axis]
            left_pole = str(record.get("left_pole") or row["left_pole"])
            right_pole = str(record.get("right_pole") or row["right_pole"])
            row["left_pole"] = left_pole
            row["right_pole"] = right_pole
            left_score = float(record.get("left_score") or 0.0)
            right_score = float(record.get("right_score") or 0.0)
            if left_score == 0.0 and right_score == 0.0:
                selected_pole = str(record.get("selected_pole") or "X")
                evidence_count = float(record.get("evidence_count") or 0.0)
                if selected_pole == left_pole:
                    left_score = evidence_count
                elif selected_pole == right_pole:
                    right_score = evidence_count
            row["left_score"] += left_score
            row["right_score"] += right_score
            row["evidence_count"] += float(record.get("evidence_count") or left_score + right_score)

    if not any(row["evidence_count"] for row in totals.values()):
        return _fallback_mbti_dimensions(selected_code)

    rows = []
    for axis in MBTI_AXIS_ORDER:
        row = totals[axis]
        left_score = float(row["left_score"])
        right_score = float(row["right_score"])
        total = max(left_score + right_score, float(row["evidence_count"]))
        if total <= 0 or left_score == right_score:
            selected_pole = "X"
            selected_score = 0.0
            confidence = 0.0
        elif left_score > right_score:
            selected_pole = str(row["left_pole"])
            selected_score = left_score
            confidence = _axis_confidence(left_score, right_score)
        else:
            selected_pole = str(row["right_pole"])
            selected_score = right_score
            confidence = _axis_confidence(right_score, left_score)
        rows.append(
            {
                "axis": axis,
                "left_pole": row["left_pole"],
                "right_pole": row["right_pole"],
                "selected_pole": selected_pole,
                "selected_label": MBTI_SELECTED_SHORT.get(selected_pole, selected_pole),
                "left_score": round(left_score, 4),
                "right_score": round(right_score, 4),
                "evidence_count": round(total, 4),
                "confidence": confidence,
                "score": round(selected_score / total, 4) if total else 0.0,
            }
        )
    return rows


def _fallback_mbti_dimensions(code: str) -> list[dict[str, Any]]:
    letters_by_axis = dict(zip(MBTI_AXIS_ORDER, code))
    rows = []
    for axis in MBTI_AXIS_ORDER:
        left, right, _left_label, _right_label = MBTI_AXIS_DEFINITIONS[axis]
        selected = letters_by_axis.get(axis, "X")
        rows.append(
            {
                "axis": axis,
                "left_pole": left,
                "right_pole": right,
                "selected_pole": selected,
                "selected_label": MBTI_SELECTED_SHORT.get(selected, selected),
                "left_score": 1.0 if selected == left else 0.0,
                "right_score": 1.0 if selected == right else 0.0,
                "evidence_count": 1.0 if selected in {left, right} else 0.0,
                "confidence": 0.0,
                "score": 1.0 if selected in {left, right} else 0.0,
            }
        )
    return rows


def _axis_confidence(selected_score: float, other_score: float) -> float:
    total = selected_score + other_score
    if total <= 0:
        return 0.0
    return round(min(0.92, 0.5 + ((selected_score - other_score) / total) * 0.42), 4)


def _mbti_evidence_records(factor_results: list[Any]) -> list[dict[str, Any]]:
    rows = []
    for result in factor_results:
        for record in _result_dataset_records(result, "mbti_dimension_evidence"):
            rows.append(
                {
                    "event_id": str(record.get("event_id") or ""),
                    "axis": str(record.get("axis") or ""),
                    "pole": str(record.get("pole") or ""),
                    "marker": str(record.get("marker") or ""),
                    "matched_excerpt": str(record.get("matched_excerpt") or ""),
                    "weight": float(record.get("weight") or 0.0),
                    "session_id": result.session_id or result.target_id,
                    "factor_id": result.factor_id,
                }
            )
    rows.sort(key=lambda row: (-float(row["weight"]), str(row["axis"]), str(row["event_id"])))
    return rows[:80]


def _mbti_reason_summary(dimensions: list[dict[str, Any]], selected_code: str) -> list[str]:
    rows = []
    for row in dimensions:
        axis = str(row["axis"])
        selected = str(row["selected_pole"])
        left = str(row["left_pole"])
        right = str(row["right_pole"])
        rows.append(
            f"{axis} 选择 {selected}：{left} {row['left_score']} vs {right} {row['right_score']}，"
            f"证据 {row['evidence_count']}，置信 {row['confidence']}"
        )
    if selected_code and selected_code != "UNKNOWN":
        rows.insert(0, f"{selected_code} 来自四个维度的加权聚合，不是单条 session 的最高分。")
    return rows[:8]


REPORT_SENTENCE_NOISE_EXACT = {
    "summary",
    "assumptions",
    "typescript",
    "users",
    "fd=6",
}
REPORT_SENTENCE_NOISE_SUBSTRINGS = (
    "please implement this plan",
    "you are given a task",
    "tailwind",
    "shadcn",
    "the codebase should support",
    "determine the default path",
    "install tailwind",
    "waiting for application startup",
    "alembic.runtime",
    "postgresqlimpl",
    "rollback nginx",
    "if it doesn't",
    "root@",
    "====",
    "exit code",
    "traceback",
    "npm err",
)
WORD_RE = re.compile(r"[A-Za-z]+")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def _is_report_sentence(value: str) -> bool:
    text = " ".join(str(value or "").split()).strip("` ")
    if not text:
        return False
    if "@" in text:
        return False
    if "[" in text and "]" in text:
        return False
    if text.startswith(("INFO ", "ERROR ", "WARN ", "DEBUG ")):
        return False
    lowered = text.lower()
    if lowered in REPORT_SENTENCE_NOISE_EXACT:
        return False
    if any(token in lowered for token in REPORT_SENTENCE_NOISE_SUBSTRINGS):
        return False
    compact = "".join(text.split())
    if len(compact) < 8 or len(compact) > 96:
        return False
    cjk_count = _cjk_count(text)
    if cjk_count:
        return cjk_count >= 6
    return len(WORD_RE.findall(text)) >= 4


def _cjk_count(value: str) -> int:
    return len(CJK_RE.findall(value))


def _mbti_archetype(code: str) -> str:
    return {
        "INTJ": "战略型拆解者",
        "INTP": "模型型探索者",
        "ENTJ": "目标型指挥者",
        "ENTP": "假设型辩手",
    }.get(code, "待观察使用画像")


def _mbti_one_sentence(code: str) -> str:
    if code == "INTJ":
        return "画像结论更接近 INTJ：先定义问题、标准和边界，再推动 AI 执行。"
    if code == "UNKNOWN":
        return "当前 session 证据不足，暂不推断 MBTI 倾向。"
    return f"画像结论更接近 {code}：该结论来自 session 行为证据，不是正式测评。"


def _known_dimension_count(code: str) -> int:
    return sum(1 for letter in code if letter and letter != "X")
