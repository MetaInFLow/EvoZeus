from __future__ import annotations

from collections.abc import Iterable
from html import escape

from evozeus.factors.packs import FactorPack
from evozeus.factors.protocol import FactorResult


def render_factor_results_html(
    session_id: str,
    results: list[FactorResult],
    factor_packs: list[FactorPack],
    selected_factor_ids: Iterable[str] | None = None,
) -> str:
    selected_ids = set(selected_factor_ids) if selected_factor_ids is not None else None
    pack_by_id = {pack.manifest.id: pack for pack in factor_packs}
    selected_results = [
        result
        for result in results
        if selected_ids is None or result.factor_id in selected_ids
    ]
    cards = [_render_result_card(result, pack_by_id.get(result.factor_id)) for result in selected_results]
    body = "\n".join(cards) if cards else '<section class="empty">No selected factor results.</section>'
    return "\n".join(
        [
            "<!doctype html>",
            '<html lang="zh-CN">',
            "<head>",
            '  <meta charset="utf-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1">',
            f"  <title>EvoZeus Factor Results - {escape(session_id)}</title>",
            "  <style>",
            _style(),
            "  </style>",
            "</head>",
            "<body>",
            "  <main>",
            "    <header>",
            "      <p>EvoZeus Factor Results</p>",
            f"      <h1>{escape(session_id)}</h1>",
            f"      <span>{len(selected_results)} results</span>",
            "    </header>",
            body,
            "  </main>",
            "</body>",
            "</html>",
            "",
        ]
    )


def _render_result_card(result: FactorResult, pack: FactorPack | None) -> str:
    visualization = pack.introduction.visualization if pack is not None else None
    component = visualization.component if visualization is not None else "factor_result_card"
    title = visualization.title if visualization is not None else result.factor_id
    description = visualization.description if visualization is not None else ""
    summary = pack.introduction.summary if pack is not None else ""
    return "\n".join(
        [
            f'    <section class="factor-card" data-factor-id="{escape(result.factor_id, quote=True)}" data-component="{escape(component, quote=True)}">',
            "      <div class=\"factor-card__head\">",
            f"        <div><p>{escape(component)}</p><h2>{escape(title)}</h2></div>",
            f"        <strong>{escape(result.status)}</strong>",
            "      </div>",
            f"      <p class=\"summary\">{escape(summary or description)}</p>",
            f"      <p class=\"factor-id\">{escape(result.factor_id)} · {escape(result.factor_version or 'unknown')} · {escape(result.stage.value)}</p>",
            _render_list("Verdict Signals", result.verdict_signals),
            _render_mapping_list("Tags", [f"{tag.get('type')}={tag.get('value')}" for tag in result.tags]),
            _render_mapping_list("Scores", [f"{key}={value}" for key, value in result.scores.items()]),
            _render_mapping_list(
                "Evidence Refs",
                [
                    f"{ref.get('event_id') or ref.get('ref_id')} ({ref.get('kind') or ref.get('source') or 'event'})"
                    for ref in result.evidence_refs
                ],
            ),
            f"      <p class=\"confidence\">confidence: {result.confidence}</p>",
            "    </section>",
        ]
    )


def _render_list(title: str, values: list[str]) -> str:
    return _render_mapping_list(title, values)


def _render_mapping_list(title: str, values: list[str]) -> str:
    visible = [value for value in values if value and value != "None=None"]
    if not visible:
        return f"      <div class=\"kv\"><h3>{escape(title)}</h3><p>None</p></div>"
    items = "".join(f"<li>{escape(value)}</li>" for value in visible)
    return f"      <div class=\"kv\"><h3>{escape(title)}</h3><ul>{items}</ul></div>"


def _style() -> str:
    return """
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #171717; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px; }
    header { border-bottom: 1px solid #d8dde6; margin-bottom: 20px; padding-bottom: 18px; }
    header p { margin: 0 0 6px; color: #546070; font-size: 13px; }
    header h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.2; }
    header span { color: #546070; font-size: 13px; }
    .factor-card { background: #ffffff; border: 1px solid #d8dde6; border-radius: 8px; margin: 14px 0; padding: 18px; }
    .factor-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .factor-card__head p { margin: 0 0 4px; color: #546070; font-size: 12px; }
    .factor-card__head h2 { margin: 0; font-size: 18px; line-height: 1.25; }
    .factor-card__head strong { border: 1px solid #cdd4df; border-radius: 999px; padding: 4px 9px; font-size: 12px; }
    .summary { color: #303846; line-height: 1.55; }
    .factor-id, .confidence { color: #546070; font-size: 13px; }
    .kv { border-top: 1px solid #edf0f4; margin-top: 12px; padding-top: 12px; }
    .kv h3 { margin: 0 0 8px; font-size: 13px; color: #303846; }
    .kv ul { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
    .kv li { background: #eef2f7; border-radius: 6px; padding: 5px 8px; font-size: 13px; }
    .kv p, .empty { color: #6b7280; }
    """.strip()
