from __future__ import annotations

from dataclasses import dataclass
import json
from importlib.resources import as_file, files
from pathlib import Path
from shutil import copy2
from typing import Any

from jinja2 import Environment


_REFERENCE_PACKAGE = "evozeus_runtime.reports.reference.ai_usage_profile"


@dataclass(frozen=True)
class AiUsageProfileSnapshot:
    payload: dict[str, Any]
    ledger_path: Path
    markdown_href: str


def render_ai_usage_profile_html(snapshot: AiUsageProfileSnapshot) -> str:
    validate_ai_usage_profile_payload(snapshot.payload)
    env = Environment(autoescape=True, trim_blocks=True, lstrip_blocks=True)
    template = env.from_string(_read_reference_text("template.html"))
    payload = dict(snapshot.payload)
    payload.setdefault("meta", {})
    payload["meta"] = {**payload["meta"], "ledger_path": str(snapshot.ledger_path)}
    report_data_json = json.dumps(_build_ai_usage_profile_view_model(payload), ensure_ascii=False).replace("</", "<\\/")
    return template.render(
        report_data_json=report_data_json,
        style_css=_read_reference_text("style.css"),
        markdown_href=snapshot.markdown_href,
    )


def load_ai_usage_profile_contract() -> dict[str, Any]:
    parsed = json.loads(_read_reference_text("report_data_contract.json"))
    return parsed if isinstance(parsed, dict) else {}


def copy_ai_usage_profile_assets(output_dir: Path) -> None:
    target_dir = output_dir / "assets"
    target_dir.mkdir(parents=True, exist_ok=True)
    assets_dir = files(_REFERENCE_PACKAGE).joinpath("assets")
    for resource in assets_dir.iterdir():
        if resource.is_file():
            with as_file(resource) as source_path:
                copy2(source_path, target_dir / resource.name)


def validate_ai_usage_profile_payload(payload: dict[str, Any]) -> None:
    contract = load_ai_usage_profile_contract()
    for field in contract.get("required_top_level_fields", []):
        if field not in payload:
            raise ValueError(f"ai usage profile payload missing {field}")
    profile = payload.get("profile")
    if not isinstance(profile, dict):
        raise ValueError("ai usage profile payload missing profile object")
    for field in contract.get("required_profile_fields", []):
        if field not in profile:
            raise ValueError(f"ai usage profile payload missing profile.{field}")
    session_review = payload.get("session_review")
    if not isinstance(session_review, dict):
        raise ValueError("ai usage profile payload missing session_review object")
    for field in contract.get("required_session_review_fields", []):
        if field not in session_review:
            raise ValueError(f"ai usage profile payload missing session_review.{field}")


def _build_ai_usage_profile_view_model(payload: dict[str, Any]) -> dict[str, Any]:
    profile = payload.get("profile", {})
    review = payload.get("session_review", {})
    usage = payload.get("usage_patterns", {})
    factors = payload.get("factor_summary", {})
    meta = payload.get("meta", {})
    evidence_policy = payload.get("evidence_policy", {})
    dimensions = _view_dimensions(profile)
    evidence = _view_evidence(profile)
    frequent_sentences = usage.get("frequent_sentences") or usage.get("cross_session_phrases") or []
    representative_sessions = review.get("representative_sessions") or []

    return {
        "meta": {
            "subject": meta.get("subject", "用户"),
            "scanLabel": "本地 Codex session 扫描",
            "sessionId": "evozeus.ai_usage_profile_report.v1",
            "scanScope": meta.get("scan_scope", "local_codex_sessions"),
            "generatedAt": meta.get("generated_at", ""),
            "ledgerPath": meta.get("ledger_path", ""),
        },
        "profile": {
            "displayName": profile.get("display_name", "证据不足"),
            "archetype": profile.get("archetype", "待观察使用画像"),
            "code": profile.get("code", "UNKNOWN"),
            "confidence": profile.get("confidence", 0),
            "oneSentence": profile.get("one_sentence", ""),
            "evidenceCount": profile.get("evidence_count", 0),
            "knownDimensions": profile.get("known_dimensions", "0/4"),
            "reasonSummary": profile.get("reason_summary", []),
        },
        "metrics": [
            {"label": "MBTI 倾向", "value": profile.get("code", "UNKNOWN"), "note": "session-derived tendency，不是正式测评"},
            {"label": "画像置信度", "value": profile.get("confidence", 0), "note": "综合不同 Session 的一致性与证据强度"},
            {"label": "画像证据", "value": profile.get("evidence_count", 0), "note": "只使用直接用户表达，不含系统提示和子任务"},
            {"label": "高质量候选", "value": review.get("high_quality_sessions", 0), "note": "来自旧 session 复核口径"},
            {"label": "待复核/低价值", "value": review.get("low_quality_sessions", 0), "note": "需要人工复核或低价值判断"},
            {"label": "Factor 结果", "value": review.get("factor_results", 0), "note": "真实 factor runner 输出"},
        ],
        "sessionReview": {
            "stats": {
                "scanned_sessions_total": review.get("scanned_sessions_total", 0),
                "workspace_sessions_analyzed": review.get("analyzed_sessions_total", 0),
                "high_quality_sessions": review.get("high_quality_sessions", 0),
                "low_quality_sessions": review.get("low_quality_sessions", 0),
                "factor_results": review.get("factor_results", 0),
            },
            "officialFactorIds": _official_factor_ids(factors),
            "sessions": [_view_session(row) for row in representative_sessions],
        },
        "factorSummary": _view_factor_summary(profile, usage, factors),
        "frequencyPhrases": [_view_phrase(row) for row in frequent_sentences[:30]],
        "keySentences": [_view_key_sentence(row) for row in (factors.get("key_sentences") or [])[:20]],
        "signalGroups": _view_signal_groups(factors, evidence_policy),
        "dimensions": dimensions,
        "habits": _view_habits(profile, dimensions),
        "traits": _view_traits(profile),
        "recommendations": _view_recommendations(),
        "sourcePlan": _view_source_plan(),
        "evidence": evidence,
    }


def _view_dimensions(profile: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for row in profile.get("dimensions") or []:
        selected = str(row.get("selected_pole") or "X")
        left = str(row.get("left_pole") or "")
        right = str(row.get("right_pole") or "")
        score = float(row.get("score") or row.get("confidence") or 0)
        rows.append(
            {
                "key": str(row.get("axis") or ""),
                "axis": row.get("axis", ""),
                "name": row.get("selected_label") or _selected_dimension_label(selected),
                "short": row.get("selected_label") or _selected_dimension_label(selected),
                "score": min(1.0, max(0.0, score)),
                "selected": selected,
                "opposite": _opposite_dimension_label(selected),
                "explanation": _ai_conversation_dimension_explanation(selected),
                "left": f"{left} {row.get('left_score', 0)}",
                "right": f"{right} {row.get('right_score', 0)}",
                "evidence": row.get("evidence_count", 0),
            }
        )
    if rows:
        return rows
    return [
        {"key": "unknown", "axis": "E-I", "name": "证据不足", "short": "证据不足", "score": 0, "selected": "X", "opposite": "", "left": "E 0", "right": "I 0", "evidence": 0},
        {"key": "unknown", "axis": "S-N", "name": "证据不足", "short": "证据不足", "score": 0, "selected": "X", "opposite": "", "left": "S 0", "right": "N 0", "evidence": 0},
        {"key": "unknown", "axis": "T-F", "name": "证据不足", "short": "证据不足", "score": 0, "selected": "X", "opposite": "", "left": "T 0", "right": "F 0", "evidence": 0},
        {"key": "unknown", "axis": "J-P", "name": "证据不足", "short": "证据不足", "score": 0, "selected": "X", "opposite": "", "left": "J 0", "right": "P 0", "evidence": 0},
    ]


def _view_evidence(profile: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "eventId": row.get("event_id", ""),
            "axis": row.get("axis", ""),
            "pole": row.get("pole", ""),
            "marker": row.get("marker", ""),
            "excerpt": row.get("matched_excerpt", ""),
            "weight": row.get("weight", 0),
        }
        for row in (profile.get("evidence") or [])[:80]
    ]


def _official_factor_ids(factors: dict[str, Any]) -> list[str]:
    ids = set()
    for value in factors.values():
        if isinstance(value, list):
            ids.update(str(item.get("factor_id")) for item in value if isinstance(item, dict) and item.get("factor_id"))
    ids.update(
        [
            "official.key-sentence-trends",
            "official.repeated-request",
            "official.semantic-phrase-clusters",
            "official.session-resource-usage",
            "official.task-completion",
            "official.tool-failure-frequency",
            "official.user-input-sentiment",
        ]
    )
    return sorted(ids)


def _view_session(row: dict[str, Any]) -> dict[str, Any]:
    label = str(row.get("label") or "低质量 / 待复核")
    title = str(row.get("title") or row.get("session_id") or "")
    return {
        "id": row.get("session_id", ""),
        "title": title,
        "project": row.get("project", ""),
        "label": label,
        "candidate": label,
        "score": 0.6 if "高质量" in label else 0.0,
        "impact": "中" if "高质量" in label else "低",
        "events": row.get("event_count", 0),
        "opening": row.get("reason") or row.get("first_user_preview") or "",
        "signals": [
            {
                "label": label,
                "weight": 0.6 if "高质量" in label else 0.0,
                "reason": row.get("reason") or row.get("first_user_preview") or "代表 session",
            }
        ],
    }


def _view_factor_summary(profile: dict[str, Any], usage: dict[str, Any], factors: dict[str, Any]) -> list[dict[str, Any]]:
    frequent = usage.get("frequent_sentences") or []
    repeated = factors.get("repeated_requests") or []
    mbti_reason = "；".join(str(item) for item in (profile.get("reason_summary") or [])[:2])
    return [
        {
            "title": "Skill 综合画像",
            "value": profile.get("code", "UNKNOWN"),
            "body": (
                f"{profile.get('confidence', 0)} 置信度，{profile.get('evidence_count', 0)} 个 direct-user 证据 marker，"
                f"{profile.get('known_dimensions', '0/4')} 维度已确认。{mbti_reason}"
            ),
        },
        {
            "title": "语义短句 / 重复请求",
            "value": len(frequent),
            "body": " / ".join(str(item.get("text", "")) for item in frequent[:2]) or "暂无稳定短句",
        },
        {"title": "关键句趋势", "value": len(factors.get("key_sentences") or []), "body": _summarize_records(factors.get("key_sentences"))},
        {"title": "用户反馈", "value": factors.get("sentiment", {}).get("dominant", "unknown"), "body": _summarize_mapping(factors.get("sentiment", {}).get("counts", {}))},
        {"title": "重复请求", "value": len(repeated), "body": _summarize_records(repeated)},
        {"title": "资源使用", "value": factors.get("resource_usage", {}).get("total", 0), "body": _summarize_mapping(factors.get("resource_usage", {}).get("by_type", {}))},
        {"title": "工具失败", "value": factors.get("tool_failures", {}).get("total", 0), "body": "来自 official.tool-failure-frequency"},
        {"title": "任务完成", "value": _task_completion_value(factors.get("task_completion", {})), "body": _summarize_mapping(factors.get("task_completion", {}))},
    ]


def _view_phrase(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "text": row.get("text", ""),
        "count": row.get("occurrence_count") or row.get("count") or 0,
        "countLabel": row.get("count_label") or f"{row.get('occurrence_count') or row.get('count') or 0} 次",
        "weight": row.get("weight", 0),
        "category": row.get("category", "高频短句"),
    }


def _view_key_sentence(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "date": row.get("event_id") or row.get("session_id") or "",
        "role": row.get("role", "user"),
        "text": row.get("text") or row.get("cluster_label") or row.get("label") or row.get("summary") or "",
        "count": row.get("count", 1),
        "relation": row.get("relation") or row.get("relation_type") or row.get("signal") or "key_sentence",
    }


def _view_signal_groups(factors: dict[str, Any], evidence_policy: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"title": "用户反馈分布", "rows": list(_mapping_rows(factors.get("sentiment", {}).get("counts", {})))},
        {"title": "重复请求", "rows": [["记录数", str(len(factors.get("repeated_requests") or []))], ["信号", "未解决请求被重复提出"]]},
        {"title": "任务完成", "rows": list(_mapping_rows(factors.get("task_completion", {})))},
        {"title": "工具失败", "rows": [["失败次数", str(factors.get("tool_failures", {}).get("total", 0))]]},
        {"title": "资源类型", "rows": list(_mapping_rows(factors.get("resource_usage", {}).get("by_type", {})))},
        {"title": "证据口径", "rows": [["direct_user_only", str(evidence_policy.get("direct_user_only") is True)], ["excluded_scopes", ", ".join(evidence_policy.get("excluded_scopes") or [])]]},
    ]


def _view_habits(profile: dict[str, Any], dimensions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"title": "先定义判断口径", "score": "强", "body": "高频 evidence 指向标准、依据、边界和验收，说明你更看重可验证交付。"},
        {"title": "偏好结构化推进", "score": "强", "body": "报告把计划、执行、任务完成和复盘分开看，适合复杂工程与产品判断。"},
        {"title": f"{profile.get('code', 'UNKNOWN')} 不是人格标签", "score": "校准", "body": "这里展示的是 session-derived tendency，只用于解释当前 AI 使用习惯。"},
        {"title": "维度证据可回看", "score": str(len(dimensions)), "body": "每个轴线都展示左右得分、证据数和 marker 来源，避免只给结论。"},
    ]


def _view_traits(profile: dict[str, Any]) -> list[dict[str, Any]]:
    code = str(profile.get("code") or "UNKNOWN")
    return [
        {"kind": "优势", "title": "质量控制能力强", "body": "你会反复要求判断依据、成功标准、验收标准和可验证交付。"},
        {"kind": "优势", "title": "适合复杂任务拆解", "body": "偏好先定目标、边界和证据，再进入执行。"},
        {"kind": "摩擦", "title": "提示词容易变重", "body": "当固定协议、上下文和目标一次性过多时，模型容易先处理格式而不是推进核心结果。"},
        {"kind": "摩擦", "title": f"{code} 结论需要看依据", "body": "不要只看四字母结果，重点看每个维度的 marker 和短句证据是否符合直觉。"},
    ]


def _view_recommendations() -> list[dict[str, Any]]:
    return [
        {"title": "要求先给判断依据", "trigger": "看到人格或习惯结论时", "action": "让报告同时展示维度分数、marker、短句和来源字段。", "example": "不要只给 ENTJ，要展示 E/I、S/N、T/F、J/P 的得分差。"},
        {"title": "区分短句和词项", "trigger": "看高频表达时", "action": "把完整短句放主区，单词、标题、日志和模板碎片降级为噪声或附录。", "example": "高频短句应类似“不要只给结果，要给判断依据”。"},
        {"title": "保留旧 session review", "trigger": "复盘历史记录时", "action": "同时看高质量候选、待复核、重复请求、工具失败和任务完成。", "example": "先点高质量候选，再看对应 signals。"},
        {"title": "把纠偏沉淀成规则", "trigger": "你指出报告错位时", "action": "把这次问题加入测试，防止模板、依据、短句三类回退。", "example": "renderer test 必须命中旧模板标题和 evidence notes。"},
    ]


def _view_source_plan() -> list[dict[str, Any]]:
    return [
        {"title": "扫描范围", "source": "scan-summary", "method": "扫描任务自动记录 sessions、factor results 和 ledger 路径。"},
        {"title": "使用画像", "source": "skill.synthesis.mbti-profile", "method": "Skill 综合七个 Factor 的直接用户表达，形成四维倾向、证据和跨 Session 加权结果。"},
        {"title": "语义短句", "source": "official.semantic-phrase-clusters", "method": "展示语义意图、代表短句和表达变体；过滤单词、日志、代码、模板标题和 prompt boilerplate。"},
        {"title": "关键句", "source": "official.key-sentence-trends", "method": "展示任务推进里的关键步骤、对象和否定句。"},
        {"title": "旧报告复盘", "source": "session_review", "method": "保留高质量候选、待复核、代表 session 和判断依据。"},
        {"title": "证据口径", "source": "evidence_policy", "method": "说明 direct user、delegated task、synthetic context 的纳入/排除规则。"},
        {"title": "优化建议", "source": "recommendation-rules", "method": "每条建议绑定触发条件和下一次可直接使用的写法。"},
        {"title": "画像证据明细", "source": "skill_synthesis_evidence", "method": "保留 event ref、轴线、倾向、命中 marker、短句 preview 和权重。"},
    ]


def _selected_dimension_label(value: str) -> str:
    return {
        "E": "对话共创",
        "I": "独立建模",
        "S": "事实落地",
        "N": "抽象推演",
        "T": "逻辑决策",
        "F": "价值体验",
        "J": "计划收敛",
        "P": "开放探索",
    }.get(value, "证据不足")


def _opposite_dimension_label(value: str) -> str:
    return {
        "E": "独立建模",
        "I": "对话共创",
        "S": "抽象推演",
        "N": "事实落地",
        "T": "价值体验",
        "F": "逻辑决策",
        "J": "开放探索",
        "P": "计划收敛",
    }.get(value, "")


def _ai_conversation_dimension_explanation(value: str) -> str:
    return {
        "E": "通过来回讨论、共创和外部反馈逐步形成答案。",
        "I": "先让 AI 独立建模和深入分析，再进入判断与反馈。",
        "S": "偏好依据现成事实、样例和明确步骤直接落地。",
        "N": "先追问本质、机制、系统关系和长期方向，再决定怎么做。",
        "T": "用逻辑、因果、标准和验证结果作为最终判断依据。",
        "F": "优先考虑价值感受、可理解性和用户体验是否成立。",
        "J": "先确定目标、顺序、边界和验收，再推动方案收敛交付。",
        "P": "通过发散、备选方案和试验逐步发现更好的方向。",
    }.get(value, "当前证据不足，暂不解释这一维度。")


def _task_completion_value(value: dict[str, Any]) -> str:
    if not value:
        return "unknown"
    return max(value, key=lambda key: int(value.get(key) or 0))


def _summarize_records(value: Any) -> str:
    if not isinstance(value, list) or not value:
        return "暂无足够信号"
    return " / ".join(str(item.get("summary") or item.get("label") or item.get("text") or item.get("session_id") or "") for item in value[:2])


def _summarize_mapping(value: Any) -> str:
    if not isinstance(value, dict) or not value:
        return "暂无足够信号"
    return " / ".join(f"{key}: {item}" for key, item in list(value.items())[:4])


def _mapping_rows(value: Any):
    if not isinstance(value, dict) or not value:
        return [["暂无", "0"]]
    for key, item in list(value.items())[:6]:
        yield [str(key), str(item)]


def _read_reference_text(name: str) -> str:
    return files(_REFERENCE_PACKAGE).joinpath(name).read_text(encoding="utf-8")
