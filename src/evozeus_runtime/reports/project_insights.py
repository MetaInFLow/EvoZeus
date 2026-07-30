from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from html import escape
from importlib.resources import as_file, files
from pathlib import Path
from shutil import copy2
from typing import Any

from jinja2 import Environment


_REFERENCE_PACKAGE = "evozeus_runtime.reports.reference.project_insights"


@dataclass(frozen=True)
class ProjectInsightsSiteSnapshot:
    title: str
    reports: list[dict[str, Any]]
    total_sessions: int
    total_projects: int
    project_counts: list[tuple[str, int]]
    scope_counts: dict[str, int]
    markdown_href: str
    analysis_contract: dict[str, Any] | None = None


def render_project_insights_site_html(snapshot: ProjectInsightsSiteSnapshot) -> str:
    env = Environment(autoescape=True, trim_blocks=True, lstrip_blocks=True)
    env.filters["clip"] = _clip_filter
    env.filters["dashsafe"] = _dash_safe
    env.globals["phrase_items"] = _render_phrase_items
    env.globals["plain_items"] = _render_plain_items
    template = env.from_string(_read_reference_text("template.html"))
    return template.render(_view_model(snapshot, style_css=_read_reference_text("style.css")))


def load_project_insights_skill_contract() -> dict[str, Any]:
    parsed = json.loads(_read_reference_text("analysis_contract.json"))
    return parsed if isinstance(parsed, dict) else {}


def copy_project_insights_assets(output_dir: Path) -> None:
    target_dir = output_dir / "assets"
    target_dir.mkdir(parents=True, exist_ok=True)
    assets_dir = files(_REFERENCE_PACKAGE).joinpath("assets")
    for resource in assets_dir.iterdir():
        if not resource.is_file():
            continue
        with as_file(resource) as source_path:
            copy2(source_path, target_dir / resource.name)


def _read_reference_text(name: str) -> str:
    return files(_REFERENCE_PACKAGE).joinpath(name).read_text(encoding="utf-8")


def _view_model(snapshot: ProjectInsightsSiteSnapshot, *, style_css: str) -> dict[str, Any]:
    reports = [_prepare_report(report, index=index) for index, report in enumerate(snapshot.reports)]
    analysis_contract = snapshot.analysis_contract or load_project_insights_skill_contract()
    project_counts = snapshot.project_counts or [
        (str(report.get("project") or "unknown"), _int(report.get("session_count"))) for report in reports
    ]
    max_project_count = max((count for _, count in project_counts), default=1)
    protocol_labels = _protocol_labels(reports)

    return {
        "title": snapshot.title,
        "style_css": style_css,
        "markdown_href": snapshot.markdown_href,
        "analysis_contract": analysis_contract,
        "metrics": [
            {"value": snapshot.total_projects, "label": "项目数"},
            {"value": snapshot.total_sessions, "label": "总 sessions"},
            {"value": sum(_int(report.get("direct_session_count")) for report in reports), "label": "主用户 sessions"},
            {"value": sum(len(_list(report.get("exact_phrases"))) for report in reports), "label": "跨 session 原话"},
            {"value": sum(len(_list(report.get("session_local_repeats"))) for report in reports), "label": "单 session 重复"},
            {"value": sum(len(_list(report.get("delegated_task_phrases"))) for report in reports), "label": "委派模板"},
        ],
        "scope_cards": _scope_cards(snapshot.scope_counts),
        "project_bars": [
            {
                "project": project,
                "count": count,
                "width": max(5, round(count / max_project_count * 100, 2)) if max_project_count else 5,
            }
            for project, count in project_counts[:20]
        ],
        "protocol_labels": protocol_labels,
        "matrix_rows": _matrix_rows(reports, protocol_labels),
        "reports": reports,
    }


def _prepare_report(report: dict[str, Any], *, index: int) -> dict[str, Any]:
    prepared = dict(report)
    project = str(prepared.get("project") or f"project-{index + 1}")
    prepared["project"] = project
    prepared["anchor"] = f"project-{index + 1}-{_anchor(project)}"
    prepared["protocol_top"] = _list(prepared.get("protocol_templates"))[:5]
    prepared["delegated_task_count"] = len(_list(prepared.get("delegated_task_phrases")))
    for key in (
        "exact_phrases",
        "session_local_repeats",
        "quoted_material_phrases",
        "protocol_templates",
        "delegated_task_phrases",
        "key_sentence_labels",
        "repeated_requests",
    ):
        prepared[key] = _list(prepared.get(key))
    prepared["session_count"] = _int(prepared.get("session_count"))
    prepared["direct_session_count"] = _int(prepared.get("direct_session_count"))
    return prepared


def _scope_cards(scope_counts: dict[str, int]) -> list[dict[str, Any]]:
    labels = [
        ("direct_user", "主用户直接输入"),
        ("context_wrapper", "上下文包装"),
        ("delegated_task", "委派任务"),
        ("automation", "自动化消息"),
        ("subagent_event", "Subagent 事件"),
    ]
    return [{"label": label, "value": _int(scope_counts.get(key))} for key, label in labels]


def _protocol_labels(reports: list[dict[str, Any]]) -> list[str]:
    counter: Counter[str] = Counter()
    for report in reports:
        for item in _list(report.get("protocol_templates")):
            text = str(item.get("text") or "").strip()
            if text:
                counter[text] += _int(item.get("occurrence_count"), default=1)
    labels = [text for text, _ in counter.most_common(10)]
    return labels or ["暂无工作协议信号"]


def _matrix_rows(reports: list[dict[str, Any]], labels: list[str]) -> list[dict[str, Any]]:
    max_value = 1
    counts_by_project: list[dict[str, int]] = []
    for report in reports:
        counts: dict[str, int] = {}
        for item in _list(report.get("protocol_templates")):
            text = str(item.get("text") or "").strip()
            if text:
                counts[text] = _int(item.get("occurrence_count"), default=1)
        counts_by_project.append(counts)
        max_value = max(max_value, *(counts.values() or [0]))

    rows: list[dict[str, Any]] = []
    for report, counts in zip(reports, counts_by_project, strict=True):
        cells = []
        for label in labels:
            value = counts.get(label, 0)
            alpha = 0 if value <= 0 else min(0.42, 0.08 + value / max_value * 0.34)
            cells.append(
                {
                    "value": value,
                    "background": f"background: rgba(198, 161, 74, {alpha:.2f});" if value else "",
                }
            )
        rows.append(
            {
                "project": report["project"],
                "session_count": report["session_count"],
                "direct_session_count": report["direct_session_count"],
                "cells": cells,
            }
        )
    return rows


def _render_phrase_items(items: list[dict[str, Any]], kind: str, limit: int) -> str:
    visible_items = _list(items)[:limit]
    if not visible_items:
        return '<div class="empty-state">暂无足够信号</div>'

    rows = ['<div class="phrase-list">']
    for item_index, item in enumerate(visible_items, start=1):
        text = _html(_dash_safe(str(item.get("text") or "")))
        session_count = _int(item.get("session_count"))
        occurrence_count = _int(item.get("occurrence_count"))
        evidence = _list(item.get("evidence"))
        rows.append('<details class="phrase-item">')
        rows.append(
            "<summary>"
            f'<span class="phrase-text">{text}</span>'
            f'<span class="phrase-meta">{session_count} sessions / {occurrence_count} user turns / {kind} #{item_index}</span>'
            "</summary>"
        )
        rows.append('<div class="evidence-stack">')
        if not evidence:
            rows.append('<div class="empty-context">暂无上下文证据</div>')
        for evidence_index, evidence_item in enumerate(evidence, start=1):
            rows.append(_render_evidence(evidence_item, evidence_index=evidence_index))
        rows.append("</div>")
        rows.append("</details>")
    rows.append("</div>")
    return "".join(rows)


def _render_evidence(evidence_item: dict[str, Any], *, evidence_index: int) -> str:
    session_id = _html(str(evidence_item.get("session_id") or ""))
    event_index = _int(evidence_item.get("event_index"))
    source_ref = _html(_clip(str(evidence_item.get("source_ref") or ""), limit=72))
    source_line = _int(evidence_item.get("source_line"))
    context_ref = _context_anchor(str(evidence_item.get("context_ref") or ""))
    article_attrs = f' id="{_html(context_ref)}"' if context_ref else ""
    rows = [f'<article class="occurrence"{article_attrs}>']
    rows.append(
        '<div class="occurrence-head">'
        f"<span>第 {evidence_index} 次</span>"
        f"<code>{session_id}</code>"
        f"<span>event {event_index}</span>"
        f"<span>{source_ref}:{source_line}</span>"
        "</div>"
    )
    context = _list(evidence_item.get("context"))
    if not context:
        source_text = _html(_clip(str(evidence_item.get("source_text") or ""), limit=900))
        rows.append(f'<div class="turn is-match"><pre>{source_text}</pre></div>')
    for turn in context:
        role = _html(str(turn.get("role") or ""))
        turn_event_index = _int(turn.get("event_index"))
        content = _html(_clip(str(turn.get("content") or ""), limit=900))
        match_class = " is-match" if bool(turn.get("is_match")) else ""
        rows.append(f'<div class="turn{match_class}">')
        rows.append(f'<div class="turn-meta">{role} / event {turn_event_index}</div>')
        rows.append(f"<pre>{content}</pre>")
        rows.append("</div>")
    rows.append("</article>")
    return "".join(rows)


def _render_plain_items(items: list[dict[str, Any]], limit: int) -> str:
    visible_items = _list(items)[:limit]
    if not visible_items:
        return '<div class="empty-state compact">暂无足够信号</div>'
    rows = ['<div class="plain-list">']
    for item in visible_items:
        text = _html(_dash_safe(str(item.get("text") or "")))
        session_count = _int(item.get("session_count"))
        occurrence_count = _int(item.get("occurrence_count"))
        rows.append(
            '<div class="plain-row">'
            f"<span>{text}</span>"
            f"<em>{session_count} sessions / {occurrence_count} turns</em>"
            "</div>"
        )
    rows.append("</div>")
    return "".join(rows)


def _anchor(value: str) -> str:
    normalized = "".join(ch.lower() if ch.isalnum() else "-" for ch in value)
    normalized = "-".join(part for part in normalized.split("-") if part)
    return normalized or "project"


def _clip_filter(value: Any, limit: int) -> str:
    return _clip(str(value), limit=limit)


def _clip(value: str, *, limit: int) -> str:
    normalized = value.strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: max(0, limit - 3)] + "..."


def _context_anchor(value: str) -> str:
    normalized = value.replace("report://", "")
    anchor = "".join(ch.lower() if ch.isalnum() else "-" for ch in normalized)
    return "-".join(part for part in anchor.split("-") if part)


def _dash_safe(value: Any) -> str:
    return str(value).replace("—", "-").replace("–", "-")


def _html(value: str) -> str:
    return escape(value, quote=True)


def _list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _int(value: Any, *, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
