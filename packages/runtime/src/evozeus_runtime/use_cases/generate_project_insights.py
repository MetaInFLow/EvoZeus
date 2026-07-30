from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from evozeus_runtime.factors.protocol import FactorResult
from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository, SessionAnalysisStatus, SessionEventRecord
from evozeus_runtime.reports.project_insights import (
    ProjectInsightsSiteSnapshot,
    copy_project_insights_assets,
    load_project_insights_skill_contract,
    render_project_insights_site_html,
)


MatchMode = Literal["exact", "contains"]
MessageScope = Literal["direct_user", "context_wrapper", "delegated_task", "automation", "subagent_event"]
PhraseScope = Literal["user_phrase", "quoted_material"]


@dataclass(frozen=True)
class InsightItem:
    text: str
    occurrence_count: int
    session_count: int
    sample_session_ids: list[str]
    evidence: list[dict[str, Any]]


@dataclass(frozen=True)
class ProjectInsightReport:
    project: str
    project_key: str
    project_label: str
    match_mode: MatchMode
    session_count: int
    direct_session_count: int
    project_evidence: list[dict[str, Any]]
    message_scope_counts: dict[str, int]
    exact_phrases: list[InsightItem]
    session_local_repeats: list[InsightItem]
    quoted_material_phrases: list[InsightItem]
    protocol_templates: list[InsightItem]
    delegated_task_phrases: list[InsightItem]
    key_sentence_labels: list[InsightItem]
    repeated_requests: list[InsightItem]
    completion_verdicts: dict[str, int]
    representative_sessions: list[dict[str, Any]]


@dataclass(frozen=True)
class GenerateProjectInsightsResult:
    markdown_path: Path
    json_path: Path
    html_path: Path
    ledger_path: Path
    project: str
    session_count: int
    exact_phrase_count: int
    session_local_repeat_count: int
    quoted_material_phrase_count: int
    protocol_template_count: int
    delegated_task_phrase_count: int
    key_sentence_label_count: int
    repeated_request_count: int


@dataclass(frozen=True)
class GenerateProjectInsightsSiteResult:
    html_path: Path
    markdown_path: Path
    json_path: Path
    ledger_path: Path
    project_count: int
    session_count: int
    total_project_count: int


_NOISE_PATTERN = re.compile(
    r"(subagent_notification|function_call|BEGIN|END|root@|fd=|OK\]|Current URL:|"
    r"In app browser|http://|https://|/Users/|```|</?|^[{}\[\],\":0-9_\- .]+$)"
)

_PROTOCOL_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("看下 / 帮我看下", re.compile(r"帮我看下|看下", re.I)),
    ("检查下 / 再检查", re.compile(r"检查下|检查一下|再检查", re.I)),
    ("review 一下", re.compile(r"review一下|review 这个|review这个|review", re.I)),
    ("拉起来 / 重新拉起来", re.compile(r"拉起来|重新拉起来|跑起来", re.I)),
    ("能跑通 / 跑通吗", re.compile(r"能跑通|跑通吗|跑通", re.I)),
    ("先别写代码", re.compile(r"先别写代码|先不要写代码", re.I)),
    ("先写 design doc", re.compile(r"先写\s*design\s*doc|写好.*implementation doc|开发文档", re.I)),
    ("先整体 / 全局 / 链路", re.compile(r"整体|全局|链路|完整流程|完整.*流程", re.I)),
    ("不要改 / 不要修改 / 不要动", re.compile(r"不要改|不要修改|不要动|别改|不改动", re.I)),
    ("只读审查", re.compile(r"只读审查|只读", re.I)),
    ("不要 push / 不要提交", re.compile(r"不要\s*push|不要提交|不要.*commit", re.I)),
    ("不要 mock / 真实数据", re.compile(r"不要.?mock|真实数据|真实测试", re.I)),
    ("输出格式", re.compile(r"输出格式|按照.*格式|格式", re.I)),
    ("输出路径 / 文件路径", re.compile(r"输出.*路径|文件路径|绝对路径", re.I)),
    ("合理利用 subagent", re.compile(r"合理利用\s*subagent|用.*subagent|多agent|子代理|并行", re.I)),
    ("参考 reference repo/code", re.compile(r"reference repo|reference code|参考.*repo|参考这个", re.I)),
    ("沉淀方法论 / skill / 规范", re.compile(r"沉淀|方法论|skill|规范|工作流|协议", re.I)),
    ("问题定位 / 原因", re.compile(r"定位|原因|为什么|问题.*在哪|算法问题|解析问题", re.I)),
    ("关闭 issue / PR / GitHub", re.compile(r"issue|PR|github|分支|dev", re.I)),
)

_DELEGATED_TASK_PATTERN = re.compile(
    r"(^|\n)\s*你是[^。\n]{0,80}(agent|worker|研究员|审查|实施计划|任务)"
    r"|你不孤立在代码库里"
    r"|请只读检查仓库"
    r"|只读检查\s*/Users/"
    r"|本轮\s*SKILL\s*架构调研的子任务研究员",
    re.I,
)
_AUTOMATION_PATTERN = re.compile(r"^\s*Automation:|Automation ID:", re.I)
_SUBAGENT_EVENT_PATTERN = re.compile(r"<subagent_notification>|subagent_notification", re.I)
_CONTEXT_WRAPPER_PATTERN = re.compile(r"# Files mentioned by the user|## My request for Codex", re.I)
_QUOTED_MATERIAL_PATTERN = re.compile(
    r"^\"[^\"]+\"\s*:"
    r"|^[A-Za-z0-9_]+\s*:"
    r"|^(description|schema|version):"
    r"|^(状态|范围):"
    r"|^Design Doc:"
    r"|^\|"
    r"|^\d+(\.\s|\s|[）、，]|分|就)"
    r"|source_sheet|target_table|funding_amount"
    r"|^[A-Za-z0-9_./-]{12,}"
    r"|^W\d"
    r"|^Agent\s"
    r"|^CLI\s"
    r"|^AF-wiki"
    r"|^S\d+[A-Za-z_-]",
    re.I,
)
_USER_PHRASE_PATTERN = re.compile(
    r"帮我|看下|检查|review|拉起来|跑起来|重新|有问题|不对|为什么|怎么回事"
    r"|看看|不是|我觉得"
    r"|先|然后|不要|别|只读|只做|提交|上传|合并|参考|输出|总结|给我"
    r"|我想|我需要|我是|我这|注意|合理|查一下|改|修|设计一下|分析一下|开始|继续|用"
    r"|必须|应该|需要|希望|可以|不能|不会|有没有|是否|怎么|哪里|什么"
    r"|补充|调整|授权好了|发布一下|测试一下|部署|安装|写|做|处理|管理一下|项目管理"
    r"|调用|列出来|集成|借鉴|分类|单独|保留|还没|停掉|关心",
    re.I,
)


def generate_project_insights(
    *,
    workspace_root: Path,
    project: str,
    formats: list[str],
    match_mode: MatchMode = "exact",
    output_dir: Path | None = None,
    top_n: int = 30,
) -> GenerateProjectInsightsResult:
    paths = RuntimePaths.for_workspace(workspace_root).ensure()
    ledger = LedgerRepository(paths)
    statuses = _matching_statuses(ledger.list_session_statuses(), project=project, match_mode=match_mode)
    session_ids = {status.session_id for status in statuses}

    events = [event for event in ledger.list_session_events() if event.session_id in session_ids]
    results_by_session = {session_id: ledger.list_factor_results(session_id=session_id) for session_id in session_ids}

    report = _build_project_insight_report(
        project=project,
        match_mode=match_mode,
        statuses=statuses,
        events=events,
        results_by_session=results_by_session,
        top_n=top_n,
    )

    report_dir = output_dir or (paths.runtime_root / "reports" / "project-insights")
    report_dir.mkdir(parents=True, exist_ok=True)
    stem = _safe_filename(project)
    markdown_path = report_dir / f"{stem}.md"
    json_path = report_dir / f"{stem}.json"
    html_path = report_dir / f"{stem}.html"
    analysis_contract = load_project_insights_skill_contract()
    report_payload = _report_to_json(report)
    _validate_report_contract([report_payload], analysis_contract)

    if "markdown" in formats:
        markdown_path.write_text(_render_markdown(report), encoding="utf-8")
    if "json" in formats:
        json_path.write_text(
            json.dumps(
                {
                    "analysis_contract": analysis_contract,
                    "projects": [report_payload],
                    **report_payload,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    if "html" in formats:
        copy_project_insights_assets(report_dir)
        html_path.write_text(
            render_project_insights_site_html(
                ProjectInsightsSiteSnapshot(
                    title=f"EvoZeus Project Insight: {project}",
                    reports=[report_payload],
                    total_sessions=report.session_count,
                    total_projects=1,
                    project_counts=[(report.project, report.session_count)],
                    scope_counts=report.message_scope_counts,
                    markdown_href=markdown_path.name,
                    analysis_contract=analysis_contract,
                )
            ),
            encoding="utf-8",
        )

    return GenerateProjectInsightsResult(
        markdown_path=markdown_path,
        json_path=json_path,
        html_path=html_path,
        ledger_path=paths.result_index_db,
        project=project,
        session_count=report.session_count,
        exact_phrase_count=len(report.exact_phrases),
        session_local_repeat_count=len(report.session_local_repeats),
        quoted_material_phrase_count=len(report.quoted_material_phrases),
        protocol_template_count=len(report.protocol_templates),
        delegated_task_phrase_count=len(report.delegated_task_phrases),
        key_sentence_label_count=len(report.key_sentence_labels),
        repeated_request_count=len(report.repeated_requests),
    )


def generate_project_insights_site(
    *,
    workspace_root: Path,
    formats: list[str],
    output_dir: Path | None = None,
    min_sessions: int = 8,
    top_n: int = 20,
) -> GenerateProjectInsightsSiteResult:
    paths = RuntimePaths.for_workspace(workspace_root).ensure()
    ledger = LedgerRepository(paths)
    statuses = ledger.list_session_statuses()
    grouped_statuses: dict[str, list[SessionAnalysisStatus]] = {}
    for status in statuses:
        grouped_statuses.setdefault(_project_label(status), []).append(status)

    selected_groups = [
        (project, project_statuses)
        for project, project_statuses in grouped_statuses.items()
        if len(project_statuses) >= min_sessions
    ]
    selected_groups.sort(key=lambda item: (-len(item[1]), item[0]))

    all_events = ledger.list_session_events()
    reports: list[ProjectInsightReport] = []
    for project, project_statuses in selected_groups:
        session_ids = {status.session_id for status in project_statuses}
        project_events = [event for event in all_events if event.session_id in session_ids]
        results_by_session = {
            session_id: ledger.list_factor_results(session_id=session_id) for session_id in session_ids
        }
        reports.append(
            _build_project_insight_report(
                project=project,
                match_mode="exact",
                statuses=project_statuses,
                events=project_events,
                results_by_session=results_by_session,
                top_n=top_n,
            )
        )

    report_dir = output_dir or (paths.runtime_root / "reports" / "project-insights")
    report_dir.mkdir(parents=True, exist_ok=True)
    html_path = report_dir / "project-analysis-zh.html"
    markdown_path = report_dir / "project-analysis-zh.md"
    json_path = report_dir / "project-analysis-summary.json"
    project_counts = [(report.project, report.session_count) for report in reports]
    scope_counts = _aggregate_scope_counts(reports)
    analysis_contract = load_project_insights_skill_contract()
    report_payloads = [_report_to_json(report) for report in reports]
    _validate_report_contract(report_payloads, analysis_contract)
    summary = {
        "analysis_contract": analysis_contract,
        "total_project_count": len(grouped_statuses),
        "project_count": len(reports),
        "total_sessions": sum(report.session_count for report in reports),
        "min_sessions": min_sessions,
        "project_counts": [{"project": project, "session_count": count} for project, count in project_counts],
        "message_scope_counts": scope_counts,
        "projects": report_payloads,
        "reports": report_payloads,
    }

    if "markdown" in formats:
        markdown_path.write_text(
            _render_site_markdown(
                reports=reports,
                total_project_count=len(grouped_statuses),
                min_sessions=min_sessions,
                scope_counts=scope_counts,
            ),
            encoding="utf-8",
        )
    if "json" in formats:
        json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if "html" in formats:
        copy_project_insights_assets(report_dir)
        html_path.write_text(
            render_project_insights_site_html(
                ProjectInsightsSiteSnapshot(
                    title="EvoZeus 项目级 Session Insight",
                    reports=summary["reports"],
                    total_sessions=int(summary["total_sessions"]),
                    total_projects=len(reports),
                    project_counts=project_counts,
                    scope_counts=scope_counts,
                    markdown_href=markdown_path.name,
                    analysis_contract=analysis_contract,
                )
            ),
            encoding="utf-8",
        )

    return GenerateProjectInsightsSiteResult(
        html_path=html_path,
        markdown_path=markdown_path,
        json_path=json_path,
        ledger_path=paths.result_index_db,
        project_count=len(reports),
        session_count=sum(report.session_count for report in reports),
        total_project_count=len(grouped_statuses),
    )


def _project_label(status: SessionAnalysisStatus) -> str:
    for value in (
        status.project_label,
        status.project_key,
        status.session_group_label,
        status.session_group_key,
    ):
        normalized = str(value or "").strip()
        if normalized:
            return normalized
    cwd_name = Path(status.session_cwd).name if status.session_cwd else ""
    return cwd_name or "unknown"


def _validate_report_contract(reports: list[dict[str, Any]], analysis_contract: dict[str, Any]) -> None:
    required_fields = analysis_contract.get("minimum_report_fields")
    if not isinstance(required_fields, list):
        raise ValueError("project insights analysis contract missing minimum_report_fields")
    missing_by_project: dict[str, list[str]] = {}
    for report in reports:
        missing = [str(field) for field in required_fields if str(field) not in report]
        if missing:
            missing_by_project[str(report.get("project") or "unknown")] = missing
    if missing_by_project:
        raise ValueError(f"project insights report does not satisfy analysis contract: {missing_by_project}")


def _aggregate_scope_counts(reports: list[ProjectInsightReport]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for report in reports:
        counter.update(report.message_scope_counts)
    return dict(sorted(counter.items()))


def _render_site_markdown(
    *,
    reports: list[ProjectInsightReport],
    total_project_count: int,
    min_sessions: int,
    scope_counts: dict[str, int],
) -> str:
    lines = [
        "# EvoZeus 项目级 Session Insight",
        "",
        f"- 总项目数：{total_project_count}",
        f"- 纳入项目数：{len(reports)}",
        f"- 最小 sessions 门槛：{min_sessions}",
        f"- 纳入 sessions：{sum(report.session_count for report in reports)}",
        f"- 消息来源：`{json.dumps(scope_counts, ensure_ascii=False)}`",
        "",
        "## 项目分布",
        "| Project | Sessions | Direct sessions | Cross-session phrases | Local repeats |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for report in reports:
        lines.append(
            f"| {_escape_cell(report.project)} | {report.session_count} | {report.direct_session_count} | "
            f"{len(report.exact_phrases)} | {len(report.session_local_repeats)} |"
        )

    for report in reports:
        lines.extend(
            [
                "",
                f"## {report.project}",
                "",
                "### 跨 Session 高频原话",
                _render_table(report.exact_phrases),
                "",
                "### 单 Session 内重复强调",
                _render_table(report.session_local_repeats),
                "",
                "### 工作协议模板",
                _render_table(report.protocol_templates),
                "",
                "### 委派任务模板",
                _render_table(report.delegated_task_phrases),
                "",
                "### Factor 关键句",
                _render_table(report.key_sentence_labels),
            ]
        )
    lines.append("")
    return "\n".join(lines)


def _matching_statuses(
    statuses: list[SessionAnalysisStatus],
    *,
    project: str,
    match_mode: MatchMode,
) -> list[SessionAnalysisStatus]:
    needle = project.casefold()
    matched: list[SessionAnalysisStatus] = []
    for status in statuses:
        values = [
            status.project_label,
            status.project_key,
            status.session_group_label,
            status.session_group_key,
            status.session_cwd,
        ]
        haystacks = [value.casefold() for value in values if value]
        if match_mode == "exact" and any(value == needle for value in haystacks):
            matched.append(status)
        if match_mode == "contains" and any(needle in value for value in haystacks):
            matched.append(status)
    return matched


def _build_project_insight_report(
    *,
    project: str,
    match_mode: MatchMode,
    statuses: list[SessionAnalysisStatus],
    events: list[SessionEventRecord],
    results_by_session: dict[str, list[FactorResult]],
    top_n: int,
) -> ProjectInsightReport:
    direct_session_ids = _direct_session_ids(statuses)
    direct_events = [event for event in events if _is_direct_user_scope(_event_message_scope(event))]
    delegated_events = [event for event in events if _event_message_scope(event) == "delegated_task"]
    direct_results_by_session = {
        session_id: results
        for session_id, results in results_by_session.items()
        if session_id in direct_session_ids
    }

    (
        exact_phrases,
        exact_phrase_sessions,
        exact_phrase_evidence,
        quoted_material,
        quoted_material_sessions,
        quoted_material_evidence,
    ) = _collect_exact_phrases(direct_events)
    cross_session_phrases = _phrases_with_min_sessions(exact_phrases, exact_phrase_sessions, min_sessions=2)
    session_local_repeats = _session_local_repeat_phrases(exact_phrases, exact_phrase_sessions)
    templates, template_sessions = _collect_protocol_templates(direct_events)
    delegated_phrases, delegated_phrase_sessions, delegated_phrase_evidence, _, _, _ = _collect_exact_phrases(delegated_events)
    key_labels, key_label_sessions = _collect_key_sentence_labels(direct_results_by_session)
    repeated_requests, repeated_request_sessions = _collect_repeated_requests(direct_results_by_session)
    completion_verdicts = _collect_completion_verdicts(direct_results_by_session)

    return ProjectInsightReport(
        project=project,
        project_key=_safe_filename(project),
        project_label=project,
        match_mode=match_mode,
        session_count=len(statuses),
        direct_session_count=len(direct_session_ids),
        project_evidence=_project_evidence(statuses, match_mode=match_mode),
        message_scope_counts=_message_scope_counts(events),
        exact_phrases=_counter_items(cross_session_phrases, exact_phrase_sessions, exact_phrase_evidence, top_n=top_n),
        session_local_repeats=_counter_items(
            session_local_repeats,
            exact_phrase_sessions,
            exact_phrase_evidence,
            top_n=top_n,
        ),
        quoted_material_phrases=_counter_items(
            quoted_material,
            quoted_material_sessions,
            quoted_material_evidence,
            top_n=top_n,
        ),
        protocol_templates=_counter_items(templates, template_sessions, top_n=top_n),
        delegated_task_phrases=_counter_items(
            delegated_phrases,
            delegated_phrase_sessions,
            delegated_phrase_evidence,
            top_n=top_n,
        ),
        key_sentence_labels=_counter_items(key_labels, key_label_sessions, top_n=top_n),
        repeated_requests=_counter_items(repeated_requests, repeated_request_sessions, top_n=top_n),
        completion_verdicts=dict(sorted(completion_verdicts.items())),
        representative_sessions=_representative_sessions(
            statuses=statuses,
            exact_phrase_sessions=exact_phrase_sessions,
            template_sessions=template_sessions,
            key_label_sessions=key_label_sessions,
            repeated_request_sessions=repeated_request_sessions,
            top_n=min(top_n, 20),
        ),
    )


def _direct_session_ids(statuses: list[SessionAnalysisStatus]) -> set[str]:
    return {
        status.session_id
        for status in statuses
        if status.first_user_preview and _is_direct_user_scope(_message_scope(status.first_user_preview))
    }


def _message_scope_counts(events: list[SessionEventRecord]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for event in events:
        if event.role == "user" and event.content:
            counter[_event_message_scope(event)] += 1
    return dict(sorted(counter.items()))


def _event_message_scope(event: SessionEventRecord) -> MessageScope:
    scope = str(event.metadata.get("message_scope") or "")
    if scope in {"direct_user", "context_wrapper", "delegated_task", "automation", "subagent_event"}:
        return scope  # type: ignore[return-value]
    return _message_scope(event.content)


def _message_scope(text: str) -> MessageScope:
    if _SUBAGENT_EVENT_PATTERN.search(text):
        return "subagent_event"
    if _AUTOMATION_PATTERN.search(text):
        return "automation"
    if _DELEGATED_TASK_PATTERN.search(text):
        return "delegated_task"
    if _CONTEXT_WRAPPER_PATTERN.search(text):
        return "context_wrapper"
    return "direct_user"


def _is_direct_user_scope(scope: MessageScope) -> bool:
    return scope in {"direct_user", "context_wrapper"}


def _collect_exact_phrases(
    events: list[SessionEventRecord],
) -> tuple[
    Counter[str],
    dict[str, set[str]],
    dict[str, list[dict[str, Any]]],
    Counter[str],
    dict[str, set[str]],
    dict[str, list[dict[str, Any]]],
]:
    counter: Counter[str] = Counter()
    sessions: dict[str, set[str]] = {}
    evidence: dict[str, list[dict[str, Any]]] = {}
    quoted_material: Counter[str] = Counter()
    quoted_material_sessions: dict[str, set[str]] = {}
    quoted_material_evidence: dict[str, list[dict[str, Any]]] = {}
    events_by_session = _events_by_session(events)
    position_by_event = _event_positions(events_by_session)
    for event in events:
        if event.role != "user" or not event.content:
            continue
        seen_user_phrases: set[str] = set()
        seen_material_phrases: set[str] = set()
        for phrase in _extract_user_lines(event.content):
            item_evidence = _event_evidence(
                event,
                matched_text=phrase,
                events_by_session=events_by_session,
                position_by_event=position_by_event,
            )
            if _phrase_scope(phrase) == "quoted_material":
                if phrase in seen_material_phrases:
                    continue
                seen_material_phrases.add(phrase)
                quoted_material[phrase] += 1
                quoted_material_sessions.setdefault(phrase, set()).add(event.session_id)
                quoted_material_evidence.setdefault(phrase, []).append(item_evidence)
                continue
            if phrase in seen_user_phrases:
                continue
            seen_user_phrases.add(phrase)
            counter[phrase] += 1
            sessions.setdefault(phrase, set()).add(event.session_id)
            evidence.setdefault(phrase, []).append(item_evidence)
    return counter, sessions, evidence, quoted_material, quoted_material_sessions, quoted_material_evidence


def _phrases_with_min_sessions(
    counter: Counter[str],
    sessions: dict[str, set[str]],
    *,
    min_sessions: int,
) -> Counter[str]:
    return Counter({text: count for text, count in counter.items() if len(sessions.get(text, set())) >= min_sessions})


def _session_local_repeat_phrases(counter: Counter[str], sessions: dict[str, set[str]]) -> Counter[str]:
    return Counter(
        {
            text: count
            for text, count in counter.items()
            if count > 1 and len(sessions.get(text, set())) == 1
        }
    )


def _events_by_session(events: list[SessionEventRecord]) -> dict[str, list[SessionEventRecord]]:
    grouped: dict[str, list[SessionEventRecord]] = {}
    for event in events:
        grouped.setdefault(event.session_id, []).append(event)
    for session_events in grouped.values():
        session_events.sort(key=lambda item: item.event_index)
    return grouped


def _event_positions(events_by_session: dict[str, list[SessionEventRecord]]) -> dict[tuple[str, str], int]:
    positions: dict[tuple[str, str], int] = {}
    for session_id, session_events in events_by_session.items():
        for index, event in enumerate(session_events):
            positions[(session_id, event.event_id)] = index
    return positions


def _event_evidence(
    event: SessionEventRecord,
    *,
    matched_text: str,
    events_by_session: dict[str, list[SessionEventRecord]],
    position_by_event: dict[tuple[str, str], int],
) -> dict[str, Any]:
    session_events = events_by_session.get(event.session_id, [])
    position = position_by_event.get((event.session_id, event.event_id), 0)
    context_events = session_events[max(0, position - 2) : min(len(session_events), position + 3)]
    return {
        "session_id": event.session_id,
        "event_id": event.event_id,
        "turn_id": event.event_id,
        "speaker": "user",
        "event_index": event.event_index,
        "source_ref": event.source_ref,
        "source_line": event.source_line,
        "context_ref": f"report://contexts/{_safe_filename(event.session_id)}/{_safe_filename(event.event_id)}",
        "matched_text": matched_text,
        "source_text": _clip(event.content, limit=1200),
        "context": [
            {
                "role": item.role,
                "event_index": item.event_index,
                "event_id": item.event_id,
                "content": _clip(_event_text(item), limit=900),
                "is_match": item.session_id == event.session_id and item.event_id == event.event_id,
            }
            for item in context_events
            if _event_text(item)
        ],
    }


def _phrase_scope(phrase: str) -> PhraseScope:
    if _QUOTED_MATERIAL_PATTERN.search(phrase):
        return "quoted_material"
    if re.search(r"`[^`]+`|\[[^\]]+\]|\{.*\}", phrase):
        return "quoted_material"
    if _USER_PHRASE_PATTERN.search(phrase):
        return "user_phrase"
    return "quoted_material"


def _extract_user_lines(text: str) -> list[str]:
    phrases: list[str] = []
    for line in text.replace("\r", "\n").split("\n"):
        for part in re.split(r"[。！？；;]|\s{2,}", line):
            phrase = part.strip(" -#*\t\n，,：:")
            phrase = re.sub(r"^[0-9一二三四五六七八九十]+[）.)、]\s*", "", phrase)
            if len(phrase) < 4 or len(phrase) > 90:
                continue
            if not re.search(r"[\u4e00-\u9fff]", phrase):
                continue
            if _NOISE_PATTERN.search(phrase):
                continue
            if re.search(r"[A-Za-z0-9_./-]{24,}", phrase):
                continue
            phrases.append(phrase)
    return phrases


def _collect_protocol_templates(
    events: list[SessionEventRecord],
) -> tuple[Counter[str], dict[str, set[str]]]:
    counter: Counter[str] = Counter()
    sessions: dict[str, set[str]] = {}
    for event in events:
        if event.role != "user" or not event.content:
            continue
        text = event.content.replace("\n", " ")
        for label, pattern in _PROTOCOL_PATTERNS:
            if pattern.search(text):
                counter[label] += 1
                sessions.setdefault(label, set()).add(event.session_id)
    return counter, sessions


def _collect_key_sentence_labels(
    results_by_session: dict[str, list[FactorResult]],
) -> tuple[Counter[str], dict[str, set[str]]]:
    counter: Counter[str] = Counter()
    sessions: dict[str, set[str]] = {}
    for session_id, results in results_by_session.items():
        for record in _dataset_records(results, "key_sentence_trends"):
            label = str(record.get("cluster_label") or "").strip()
            if not label:
                continue
            counter[label] += _int(record.get("count"), default=1)
            sessions.setdefault(label, set()).add(session_id)
    return counter, sessions


def _collect_repeated_requests(
    results_by_session: dict[str, list[FactorResult]],
) -> tuple[Counter[str], dict[str, set[str]]]:
    counter: Counter[str] = Counter()
    sessions: dict[str, set[str]] = {}
    for session_id, results in results_by_session.items():
        for record in _dataset_records(results, "repeated_request_events"):
            text = str(record.get("request_signature") or record.get("repeat_input_text") or "").strip()
            if not text:
                continue
            counter[text] += 1
            sessions.setdefault(text, set()).add(session_id)
    return counter, sessions


def _collect_completion_verdicts(results_by_session: dict[str, list[FactorResult]]) -> Counter[str]:
    verdicts: Counter[str] = Counter()
    for results in results_by_session.values():
        for record in _dataset_records(results, "task_completion_verdict"):
            verdict = str(record.get("verdict") or "unknown")
            verdicts[verdict] += 1
    return verdicts


def _dataset_records(results: list[FactorResult], dataset_id: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for result in results:
        for dataset in result.datasets:
            if str(dataset.get("id") or "") != dataset_id:
                continue
            dataset_records = dataset.get("records")
            if isinstance(dataset_records, list):
                records.extend(item for item in dataset_records if isinstance(item, dict))
    return records


def _representative_sessions(
    *,
    statuses: list[SessionAnalysisStatus],
    exact_phrase_sessions: dict[str, set[str]],
    template_sessions: dict[str, set[str]],
    key_label_sessions: dict[str, set[str]],
    repeated_request_sessions: dict[str, set[str]],
    top_n: int,
) -> list[dict[str, Any]]:
    score_by_session: Counter[str] = Counter()
    for sessions in exact_phrase_sessions.values():
        for session_id in sessions:
            score_by_session[session_id] += 1
    for sessions in template_sessions.values():
        for session_id in sessions:
            score_by_session[session_id] += 2
    for sessions in key_label_sessions.values():
        for session_id in sessions:
            score_by_session[session_id] += 2
    for sessions in repeated_request_sessions.values():
        for session_id in sessions:
            score_by_session[session_id] += 4

    statuses_by_id = {status.session_id: status for status in statuses}
    ranked_session_ids = [
        session_id
        for session_id, _ in sorted(score_by_session.items(), key=lambda item: (-item[1], item[0]))
        if session_id in statuses_by_id
    ][:top_n]
    return [
        {
            "session_id": session_id,
            "score": int(score_by_session[session_id]),
            "title": statuses_by_id[session_id].session_title,
            "first_user_preview": statuses_by_id[session_id].first_user_preview,
            "last_assistant_preview": statuses_by_id[session_id].last_assistant_preview,
        }
        for session_id in ranked_session_ids
    ]


def _project_evidence(statuses: list[SessionAnalysisStatus], *, match_mode: MatchMode) -> list[dict[str, Any]]:
    return [
        {
            "session_id": status.session_id,
            "project_key": status.project_key,
            "project_label": status.project_label,
            "session_group_key": status.session_group_key,
            "session_group_label": status.session_group_label,
            "session_cwd": status.session_cwd,
            "source_ref": status.source_ref,
            "match_mode": match_mode,
            "first_user_preview": _clip(status.first_user_preview or status.session_title, limit=240),
        }
        for status in sorted(statuses, key=lambda item: item.session_id)
    ]


def _counter_items(
    counter: Counter[str],
    sessions: dict[str, set[str]],
    evidence: dict[str, list[dict[str, Any]]] | None = None,
    *,
    top_n: int,
) -> list[InsightItem]:
    evidence = evidence or {}
    return [
        InsightItem(
            text=text,
            occurrence_count=int(count),
            session_count=len(sessions.get(text, set())),
            sample_session_ids=sorted(sessions.get(text, set()))[:5],
            evidence=evidence.get(text, [])[:50],
        )
        for text, count in sorted(counter.items(), key=lambda item: (-len(sessions.get(item[0], set())), -item[1], item[0]))[:top_n]
    ]


def _render_markdown(report: ProjectInsightReport) -> str:
    lines = [
        f"# Project Insight Report: {report.project}",
        "",
        f"- Match mode: `{report.match_mode}`",
        f"- Sessions: {report.session_count}",
        f"- Direct sessions: {report.direct_session_count}",
        f"- Message scopes: `{json.dumps(report.message_scope_counts, ensure_ascii=False)}`",
        "",
        "## 主用户跨 Session 高频原话",
        _render_table(report.exact_phrases),
        "",
        "## 单 Session 内重复强调",
        _render_table(report.session_local_repeats),
        "",
        "## 主用户工作协议模板",
        _render_table(report.protocol_templates),
        "",
        "## 粘贴材料片段（已从主用户高频原话排除）",
        _render_table(report.quoted_material_phrases),
        "",
        "## 委派任务模板（单独列出，不混入主用户偏好）",
        _render_table(report.delegated_task_phrases),
        "",
        "## Factor 关键句",
        _render_table(report.key_sentence_labels),
        "",
        "## 重复请求",
        _render_table(report.repeated_requests),
        "",
        "## 完成状态",
    ]
    if report.completion_verdicts:
        lines.extend(f"- {verdict}: {count}" for verdict, count in report.completion_verdicts.items())
    else:
        lines.append("- 暂无 task completion factor 数据")

    lines.extend(["", "## 值得精读的 Session"])
    if not report.representative_sessions:
        lines.append("- 暂无足够信号")
    else:
        lines.append("| Score | Session | First user preview |")
        lines.append("| ---: | --- | --- |")
        for item in report.representative_sessions:
            lines.append(
                f"| {item['score']} | `{_escape_cell(str(item['session_id']))}` | "
                f"{_escape_cell(str(item.get('first_user_preview') or item.get('title') or ''))} |"
            )
    lines.append("")
    return "\n".join(lines)


def _render_table(items: list[InsightItem]) -> str:
    if not items:
        return "暂无足够信号"
    lines = ["| Sessions | User turns | Text | Sample sessions |", "| ---: | ---: | --- | --- |"]
    for item in items:
        samples = ", ".join(f"`{session_id}`" for session_id in item.sample_session_ids)
        lines.append(
            f"| {item.session_count} | {item.occurrence_count} | {_escape_cell(item.text)} | {samples} |"
        )
    return "\n".join(lines)


def _report_to_json(report: ProjectInsightReport) -> dict[str, Any]:
    return {
        "project": report.project,
        "project_key": report.project_key,
        "project_label": report.project_label,
        "match_mode": report.match_mode,
        "session_count": report.session_count,
        "source_sessions": report.session_count,
        "direct_session_count": report.direct_session_count,
        "project_evidence": report.project_evidence,
        "message_scope_counts": report.message_scope_counts,
        "exact_phrases": [_item_to_json(item) for item in report.exact_phrases],
        "user_repeated_phrases": [_item_to_json(item) for item in report.exact_phrases],
        "session_local_repeats": [_item_to_json(item) for item in report.session_local_repeats],
        "single_session_repeated_phrases": [_item_to_json(item) for item in report.session_local_repeats],
        "quoted_material_phrases": [_item_to_json(item) for item in report.quoted_material_phrases],
        "protocol_templates": [_item_to_json(item) for item in report.protocol_templates],
        "delegated_task_phrases": [_item_to_json(item) for item in report.delegated_task_phrases],
        "key_sentence_labels": [_item_to_json(item) for item in report.key_sentence_labels],
        "repeated_requests": [_item_to_json(item) for item in report.repeated_requests],
        "completion_verdicts": report.completion_verdicts,
        "representative_sessions": report.representative_sessions,
    }


def _item_to_json(item: InsightItem) -> dict[str, Any]:
    return {
        "text": item.text,
        "count": item.occurrence_count,
        "occurrence_count": item.occurrence_count,
        "session_count": item.session_count,
        "sample_session_ids": item.sample_session_ids,
        "occurrences": _item_occurrences(item.evidence),
        "evidence": item.evidence,
    }


def _item_occurrences(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "session_id": str(item.get("session_id") or ""),
            "turn_id": str(item.get("turn_id") or item.get("event_id") or ""),
            "event_id": str(item.get("event_id") or ""),
            "event_index": _int(item.get("event_index"), default=0),
            "speaker": "user",
            "context_ref": str(item.get("context_ref") or ""),
            "context": _dict_list(item.get("context")),
        }
        for item in evidence
    ]


def _safe_filename(value: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in value).strip("-")
    return safe or "project"


def _escape_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def _event_text(event: SessionEventRecord) -> str:
    return event.content or event.tool_result_preview or ""


def _clip(value: str, *, limit: int) -> str:
    normalized = value.strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1] + "…"


def _int(value: Any, *, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _dict_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []
