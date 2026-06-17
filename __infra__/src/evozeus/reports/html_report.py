from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from html import escape
import json
from typing import Any

from evozeus.factors.packs import FactorPack
from evozeus.factors.protocol import FactorResult
from evozeus.reports.visualizations import ResultVisualization, build_result_visualizations


def render_factor_results_html(
    session_id: str,
    results: list[FactorResult],
    factor_packs: list[FactorPack],
    selected_factor_ids: Iterable[str] | None = None,
    session_statuses: Iterable[Any] | None = None,
) -> str:
    selected_ids = set(selected_factor_ids) if selected_factor_ids is not None else None
    pack_by_id = {pack.manifest.id: pack for pack in factor_packs}
    selected_results = [
        result
        for result in results
        if selected_ids is None or result.factor_id in selected_ids
    ]
    visualizations = build_result_visualizations(selected_results)
    payload = _report_payload(session_id, selected_results, visualizations, pack_by_id, session_statuses)
    return "\n".join(
        [
            "<!doctype html>",
            '<html lang="zh-CN">',
            "<head>",
            '  <meta charset="utf-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1">',
            f"  <title>EvoZeus Factor Results - {escape(session_id)}</title>",
            '  <link rel="icon" href="data:,">',
            '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/antd@5/dist/reset.css">',
            "  <style>",
            _style(),
            "  </style>",
            "</head>",
            "<body>",
            '  <div id="evozeus-dashboard-root"></div>',
            _fallback_html(payload),
            "  <script>",
            f"    window.__EVOZEUS_REPORT__ = {_safe_json(payload)};",
            "  </script>",
            '  <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>',
            '  <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>',
            '  <script crossorigin src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js"></script>',
            '  <script crossorigin src="https://cdn.jsdelivr.net/npm/antd@5/dist/antd.min.js"></script>',
            "  <script>",
            _dashboard_script(),
            "  </script>",
            "</body>",
            "</html>",
            "",
        ]
    )


def _report_payload(
    session_id: str,
    results: list[FactorResult],
    visualizations: list[ResultVisualization],
    pack_by_id: dict[str, FactorPack],
    session_statuses: Iterable[Any] | None,
) -> dict[str, Any]:
    result_items = [_result_payload(result, pack_by_id.get(result.factor_id)) for result in results]
    summary = _summary_payload(results)
    return {
        "renderer": "Ant Design dashboard",
        "session": {
            "id": session_id,
            "result_count": len(results),
        },
        "sessions": _session_payloads(session_id, summary, session_statuses),
        "summary": summary,
        "visualizations": [_visualization_payload(visualization) for visualization in visualizations],
        "results": result_items,
        "factor_packs": [_factor_pack_payload(pack) for pack in pack_by_id.values()],
    }


def _session_payloads(
    current_session_id: str,
    current_summary: dict[str, Any],
    session_statuses: Iterable[Any] | None,
) -> list[dict[str, Any]]:
    if session_statuses is None:
        return [
            {
                "key": current_session_id,
                "session_id": current_session_id,
                "provider": "codex",
                "result_count": current_summary["total"],
                "matched": current_summary["matched"],
                "skipped": current_summary["skipped"],
                "top_verdict": current_summary["top_verdict"],
                "analyzed_factor_count": current_summary["total"],
                "pending_factor_count": 0,
                "last_analyzed_at": "",
            }
        ]
    rows = []
    for status in session_statuses:
        session_id = str(getattr(status, "session_id", ""))
        is_current = session_id == current_session_id
        rows.append(
            {
                "key": session_id,
                "session_id": session_id,
                "provider": str(getattr(status, "provider", "")),
                "source_ref": str(getattr(status, "source_ref", "")),
                "event_count": int(getattr(status, "event_count", 0)),
                "result_count": current_summary["total"] if is_current else int(getattr(status, "analyzed_factor_count", 0)),
                "matched": current_summary["matched"] if is_current else 0,
                "skipped": current_summary["skipped"] if is_current else 0,
                "top_verdict": current_summary["top_verdict"] if is_current else "Pending",
                "analyzed_factor_count": int(getattr(status, "analyzed_factor_count", 0)),
                "pending_factor_count": int(getattr(status, "pending_factor_count", 0)),
                "last_analyzed_at": str(getattr(status, "last_analyzed_at", "")),
                "stale_reason": str(getattr(status, "stale_reason", "")),
            }
        )
    return rows


def _summary_payload(results: list[FactorResult]) -> dict[str, Any]:
    status_counts = Counter(result.status for result in results)
    verdict_counts = Counter(verdict for result in results for verdict in result.verdict_signals)
    evidence_ref_count = sum(len(result.evidence_refs) for result in results)
    confidence_values = [result.confidence for result in results if result.status == "matched"]
    average_confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0
    return {
        "total": len(results),
        "matched": status_counts.get("matched", 0),
        "skipped": status_counts.get("skipped", 0),
        "evidence_refs": evidence_ref_count,
        "top_verdict": verdict_counts.most_common(1)[0][0] if verdict_counts else "None",
        "average_confidence": _round_float(average_confidence),
        "status_counts": dict(status_counts),
        "verdict_counts": dict(verdict_counts),
    }


def _result_payload(result: FactorResult, pack: FactorPack | None) -> dict[str, Any]:
    intro = pack.introduction if pack is not None else None
    return {
        "key": result.factor_id,
        "factor_id": result.factor_id,
        "factor_name": intro.name if intro is not None else result.factor_id,
        "summary": intro.summary if intro is not None else "",
        "version": result.factor_version or "unknown",
        "stage": result.stage.value,
        "status": result.status,
        "confidence": _round_float(result.confidence),
        "verdict_signals": result.verdict_signals,
        "tags": [
            {"type": str(tag.get("type") or ""), "value": str(tag.get("value") or "")}
            for tag in result.tags
        ],
        "scores": [
            {"key": key, "value": _round_float(value)}
            for key, value in result.scores.items()
        ],
        "evidence_refs": [
            {
                "id": str(ref.get("event_id") or ref.get("ref_id") or ""),
                "kind": str(ref.get("kind") or ref.get("source") or "event"),
            }
            for ref in result.evidence_refs
        ],
    }


def _visualization_payload(visualization: ResultVisualization) -> dict[str, Any]:
    return {
        "component": visualization.component,
        "title": visualization.title,
        "description": visualization.description,
        "input_fields": visualization.input_fields,
        "output_fields": visualization.output_fields,
        "terms": [
            {
                "text": term.text,
                "weight": term.weight,
                "source_factor_ids": term.source_factor_ids,
            }
            for term in visualization.terms
        ],
    }


def _factor_pack_payload(pack: FactorPack) -> dict[str, Any]:
    intro = pack.introduction
    return {
        "key": pack.manifest.id,
        "factor_id": pack.manifest.id,
        "name": intro.name,
        "version": pack.manifest.version,
        "stage": pack.manifest.stage.value,
        "runtime": pack.manifest.runtime.mode.value,
        "summary": intro.summary,
        "category": intro.category,
        "privacy": intro.privacy,
    }


def _fallback_html(payload: dict[str, Any]) -> str:
    results = payload["results"]
    cards = "\n".join(
        [
            (
                f'      <section data-result-card="factor_result" data-status="{escape(result["status"], quote=True)}">'
                f'<strong>{escape(result["factor_name"])}</strong>'
                f'<span>{escape(result["status"].title())}</span>'
                f'<p>{escape(result["factor_id"])}</p>'
                f'<p>{" ".join(escape(str(score["value"])) for score in result["scores"])}</p>'
                "</section>"
            )
            for result in results
        ]
    )
    return "\n".join(
        [
            "  <noscript>",
            '    <main class="dashboard-shell fallback">',
            '      <section data-workspace-tab="sessions"><h2>Sessions</h2></section>',
            '      <section data-workspace-tab="dashboards"><h2>Dashboards</h2></section>',
            '      <section data-workspace-tab="factor_packs"><h2>Factor Packs</h2></section>',
            '      <section data-component="result_summary">',
            f'        <strong>Matched</strong><span>{payload["summary"]["matched"]}</span>',
            f'        <strong>Skipped</strong><span>{payload["summary"]["skipped"]}</span>',
            "      </section>",
            '      <section data-component="word_cloud"></section>',
            cards,
            "    </main>",
            "  </noscript>",
        ]
    )


def _safe_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def _round_float(value: float) -> float:
    return round(float(value), 3)


def _dashboard_script() -> str:
    return r"""
    (() => {
      const h = React.createElement;
      const { App, Badge, Card, Col, Drawer, Progress, Row, Space, Statistic, Table, Tabs, Tag, Typography } = antd;
      const { Text, Title } = Typography;
      const data = window.__EVOZEUS_REPORT__;

      function statusColor(status) {
        if (status === "matched") return "success";
        if (status === "skipped") return "default";
        return "warning";
      }

      function verdictColor(verdict) {
        if (verdict === "Fix Environment") return "red";
        if (verdict === "Open Case") return "gold";
        if (verdict === "Promote to Skill") return "blue";
        return "default";
      }

      function Summary() {
        const summary = data.summary;
        return h("section", {"data-component": "result_summary", className: "summary-panel"},
          h(Row, { gutter: [12, 12] },
            h(Col, { xs: 12, md: 6 }, h(Card, { size: "small" }, h(Statistic, { title: "Results", value: summary.total }))),
            h(Col, { xs: 12, md: 6 }, h(Card, { size: "small" }, h(Statistic, { title: "Matched", value: summary.matched, valueStyle: { color: "#1677ff" } }))),
            h(Col, { xs: 12, md: 6 }, h(Card, { size: "small" }, h(Statistic, { title: "Skipped", value: summary.skipped }))),
            h(Col, { xs: 12, md: 6 }, h(Card, { size: "small" }, h(Statistic, { title: "Avg Confidence", value: summary.average_confidence, precision: 3 })))
          ),
          h(Card, { size: "small", className: "verdict-strip" },
            h(Space, { wrap: true, size: [8, 8] },
              h(Text, { type: "secondary" }, "Top verdict"),
              h(Tag, { color: verdictColor(summary.top_verdict) }, summary.top_verdict),
              h(Text, { type: "secondary" }, "Evidence refs"),
              h(Tag, null, summary.evidence_refs)
            )
          )
        );
      }

      function WordCloud() {
        const cloud = data.visualizations.find((item) => item.component === "word_cloud");
        const terms = (cloud && cloud.terms || []).slice(0, 32);
        return h(Card, { title: cloud ? cloud.title : "高频信号词云", "data-component": "word_cloud", className: "dashboard-card" },
          h("p", { className: "card-note" }, cloud ? cloud.description : ""),
          h("div", { className: "word-cloud" },
            terms.length ? terms.map((term) =>
              h(Tag, {
                key: term.text,
                color: term.weight > 1 ? "blue" : "default",
                style: { fontSize: `${Math.min(26, 12 + term.weight * 3)}px` },
                title: term.source_factor_ids.join(", ")
              }, term.text)
            ) : h(Text, { type: "secondary" }, "No terms")
          )
        );
      }

      function ResultTable({ onOpen }) {
        const columns = [
          {
            title: "Factor",
            dataIndex: "factor_name",
            render: (_, row) => h("div", null,
              h(Text, { strong: true }, row.factor_name),
              h("br"),
              h(Text, { type: "secondary" }, row.factor_id)
            )
          },
          {
            title: "Status",
            dataIndex: "status",
            width: 110,
            render: (status) => h(Badge, { status: statusColor(status), text: status })
          },
          {
            title: "Verdict",
            dataIndex: "verdict_signals",
            render: (items) => h(Space, { wrap: true, size: [4, 4] },
              (items.length ? items : ["None"]).map((item) => h(Tag, { key: item, color: verdictColor(item) }, item))
            )
          },
          {
            title: "Confidence",
            dataIndex: "confidence",
            width: 140,
            render: (value) => h(Progress, { percent: Math.round(value * 100), size: "small" })
          },
          {
            title: "",
            dataIndex: "action",
            width: 96,
            render: (_, row) => h("a", { onClick: () => onOpen(row) }, "Details")
          }
        ];
        return h(Card, { title: "Factor Result Matrix", className: "dashboard-card", "data-component": "factor_result_matrix" },
          h(Table, { columns, dataSource: data.results, pagination: false, size: "small" })
        );
      }

      function Tags({ items }) {
        if (!items.length) return h(Text, { type: "secondary" }, "None");
        return h(Space, { wrap: true, size: [4, 6] },
          items.map((item) => h(Tag, { key: item }, item))
        );
      }

      function ResultDetail({ result }) {
        if (!result) return null;
        return h("section", { "data-result-card": "factor_result", "data-status": result.status, className: `result-detail status-${result.status}` },
          h("p", { className: "card-note" }, result.summary),
          h("div", { className: "result-section" }, h(Text, { strong: true }, "Verdict"), h(Tags, { items: result.verdict_signals })),
          h("div", { className: "result-section" }, h(Text, { strong: true }, "Tags"), h(Tags, { items: result.tags.map((tag) => `${tag.type}=${tag.value}`) })),
          h("div", { className: "result-section" }, h(Text, { strong: true }, "Scores"), h(Tags, { items: result.scores.map((score) => `${score.key}=${score.value}`) })),
          h("div", { className: "result-section" }, h(Text, { strong: true }, "Evidence"), h(Tags, { items: result.evidence_refs.map((ref) => `${ref.id} (${ref.kind})`) }))
        );
      }

      function SessionsTab({ onOpen }) {
        const columns = [
          {
            title: "Session",
            dataIndex: "session_id",
            render: (value, row) => h("div", null,
              h(Text, { strong: true }, value),
              h("br"),
              h(Text, { type: "secondary" }, row.provider)
            )
          },
          { title: "Results", dataIndex: "result_count", width: 100 },
          { title: "Matched", dataIndex: "matched", width: 100 },
          { title: "Analyzed", dataIndex: "analyzed_factor_count", width: 110 },
          {
            title: "Pending",
            dataIndex: "pending_factor_count",
            width: 100,
            render: (value) => h(Tag, { color: value ? "gold" : "green" }, value)
          },
          {
            title: "Top Verdict",
            dataIndex: "top_verdict",
            render: (value) => h(Tag, { color: verdictColor(value) }, value)
          }
        ];
        return h("section", { "data-workspace-tab": "sessions", className: "workspace-tab" },
          h(Table, {
            columns,
            dataSource: data.sessions,
            pagination: false,
            size: "small",
            expandable: {
              expandedRowRender: () => h(ResultTable, { onOpen }),
              rowExpandable: () => true
            }
          })
        );
      }

      function DashboardsTab({ onOpen }) {
        return h("section", { "data-workspace-tab": "dashboards", className: "workspace-tab" },
          h(Summary),
          h(Row, { gutter: [16, 16], className: "dashboard-row" },
            h(Col, { xs: 24, lg: 10 }, h(WordCloud)),
            h(Col, { xs: 24, lg: 14 }, h(ResultTable, { onOpen }))
          )
        );
      }

      function FactorPacksTab() {
        const columns = [
          {
            title: "Factor",
            dataIndex: "name",
            render: (_, row) => h("div", null,
              h(Text, { strong: true }, row.name),
              h("br"),
              h(Text, { type: "secondary" }, row.factor_id)
            )
          },
          { title: "Stage", dataIndex: "stage", width: 180 },
          { title: "Runtime", dataIndex: "runtime", width: 140 },
          { title: "Version", dataIndex: "version", width: 110 }
        ];
        return h("section", { "data-workspace-tab": "factor_packs", className: "workspace-tab" },
          h(Table, {
            columns,
            dataSource: data.factor_packs,
            pagination: false,
            size: "small",
            expandable: {
              expandedRowRender: (row) => h("div", { className: "pack-detail" },
                h("p", null, row.summary),
                h(Text, { type: "secondary" }, row.privacy)
              )
            }
          })
        );
      }

      function Dashboard() {
        const [drawerResult, setDrawerResult] = React.useState(null);
        return h(App, null,
          h("main", { className: "dashboard-shell" },
            h("header", { className: "dashboard-header" },
              h("div", null,
                h(Text, { type: "secondary" }, "EvoZeus Workspace · Ant Design"),
                h(Title, { level: 1 }, data.session.id)
              ),
              h(Tag, { color: "blue" }, `${data.session.result_count} results`)
            ),
            h(Tabs, {
              items: [
                { key: "sessions", label: "Sessions", children: h(SessionsTab, { onOpen: setDrawerResult }) },
                { key: "dashboards", label: "Dashboards", children: h(DashboardsTab, { onOpen: setDrawerResult }) },
                { key: "factor_packs", label: "Factor Packs", children: h(FactorPacksTab) }
              ]
            }),
            h(Drawer, {
              title: drawerResult ? drawerResult.factor_name : "Factor Result",
              width: 520,
              open: Boolean(drawerResult),
              onClose: () => setDrawerResult(null)
            },
              h(ResultDetail, { result: drawerResult })
            )
          )
        );
      }

      ReactDOM.createRoot(document.getElementById("evozeus-dashboard-root")).render(h(Dashboard));
    })();
    """.strip()


def _style() -> str:
    return """
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f5f7fb; color: #141414; }
    .dashboard-shell { max-width: 1180px; margin: 0 auto; padding: 32px 20px 48px; }
    .dashboard-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 1px solid #d9d9d9; margin-bottom: 18px; padding-bottom: 16px; }
    .dashboard-header h1 { margin: 4px 0 0; font-size: 30px; line-height: 1.18; }
    .summary-panel { display: grid; gap: 12px; margin-bottom: 16px; }
    .workspace-tab { padding-top: 4px; }
    .verdict-strip { border-color: #d6e4ff; background: #f8fbff; }
    .dashboard-row { margin-bottom: 16px; }
    .dashboard-card { height: 100%; border-radius: 8px; }
    .card-note { color: #5f6b7a; line-height: 1.55; margin: 0 0 12px; }
    .word-cloud { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; padding-top: 2px; }
    .word-cloud .ant-tag { margin-inline-end: 0; line-height: 1.7; }
    .result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .result-card { border-radius: 8px; }
    .result-card.status-matched { border-left: 4px solid #1677ff; }
    .result-card.status-skipped { border-left: 4px solid #d9d9d9; }
    .result-detail { display: grid; gap: 10px; }
    .pack-detail { color: #5f6b7a; line-height: 1.55; max-width: 820px; }
    .result-section { border-top: 1px solid #f0f0f0; padding-top: 10px; margin-top: 10px; display: grid; gap: 7px; }
    .fallback { display: block; }
    @media (max-width: 760px) {
      .dashboard-shell { padding: 22px 14px 36px; }
      .dashboard-header { align-items: flex-start; flex-direction: column; }
      .dashboard-header h1 { font-size: 24px; overflow-wrap: anywhere; }
      .result-grid { grid-template-columns: 1fr; }
    }
    """.strip()
