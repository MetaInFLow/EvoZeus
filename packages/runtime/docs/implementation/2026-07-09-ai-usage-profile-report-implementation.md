# AI Usage Profile Report Implementation Plan

> **2026-07-11 implementation update:** 本文后半部分保留了最初实现草案。当前正式链路已删除 `official.mbti-personality-profile` 和 `official.usage-sentence-cloud`：MBTI/使用画像由 Skill 综合七个 Factor 生成，语义表达由 `official.semantic-phrase-clusters` / `semantic_phrase_cluster_set` 提供。代码示例中出现的旧 Factor 仅是历史记录，不是当前接口。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让别人从干净环境运行 EvoZeus session 分析链路后，可以稳定生成一份整合旧 session review、项目洞察、高频句、判断依据和 MBTI 倾向的本地 HTML 评测报告。

**Architecture:** `EvoZeus-infra` 继续负责扫描、运行 factor、落 SQLite ledger 和生成最终 HTML；`EvoZeus-session-signal-skill` 负责七个 official Factors、跨 Factor 的 MBTI/使用画像综合方法和可复用模板资源。新增 `ai_usage_profile` 报告层只读取 ledger 中的 session、event、factor result 和 project insights summary，不新增存储表，不把原始 session 全文写入新的结果文件。

**Tech Stack:** Python 3.11+, Typer, Pydantic v2, SQLite ledger, Jinja2, importlib.resources, pytest, local static HTML/CSS/JS.

---

## 真实问题

当前链路已经能在本机开发态跑出结果，但它还不是一个可以交给别人直接使用的报告产品。主要矛盾不是“能不能扫描 session”，而是：

- 运行入口生成的是 `ledger browser` 和 `project-insights`，不是用户期待的“评测报告”。
- MBTI factor 已经存在，但没有接入最终报告。
- 旧报告中的高频句、高质量候选、重复请求、工具失败、任务闭环等内容没有和 MBTI 整合成一份。
- 报告模板里还有静态样本数据，缺少稳定的数据装配层。
- clean clone / clean install 后 factors、templates 和命令入口的可发现性没有发布级保障。

## 成功标准

一次干净运行必须满足：

- 用户执行一个主命令后，最终输出路径里有 `ai-usage-profile/index.html`。
- HTML 第一屏明确显示 MBTI 结论，例如 `INTJ 倾向`，但标注为 session-derived tendency，不包装成正式心理测评。
- 同一份报告包含旧 session review 内容：高质量候选、低质量/待复核数量、代表 session、判断依据、重复请求、工具失败、任务完成、资源使用。
- 同一份报告包含项目级洞察内容：跨 session 高频原话、单 session 重复强调、委派任务模板、工作协议模板。
- 每个结论都能回到 factor result、session id、event id 或 source locator。
- 没有把 delegated task、subagent wrapper、synthetic context 当成真实用户偏好证据。
- 本地生成的大 HTML 允许超过 100MB；体量不是本阶段阻断，只要能本机打开。

## 非目标

- 不做在线上传、云端 dashboard 或账号体系。
- 不把 MBTI 作为稳定人格标签、正式测评或高质量 session 判定依据。
- 不新增图数据库或替换 SQLite ledger。
- 不强制压缩完整 ledger browser。
- 不把报告模板继续放在开发 repo 的 artifacts 目录里作为正式输出。

## File Structure

最终文件结构：

```text
10-repos/EvoZeus-infra/
  docs/implementation/2026-07-09-ai-usage-profile-report-implementation.md
  README.md
  src/evozeus_runtime/
    cli/main.py
    reports/
      ai_usage_profile.py
      reference/
        ai_usage_profile/
          __init__.py
          README.md
          report_data_contract.json
          template.html
          style.css
          assets/
            evozeus-gold-512.png
            evozeus-zeus-hero.png
    use_cases/
      generate_ai_usage_profile_report.py
      run_codex_official_visualization.py
  tests/
    unit/test_ai_usage_profile_report.py
    integration/test_ai_usage_profile_report.py
    integration/test_cli.py
    integration/test_codex_official_visualization.py

10-repos/EvoZeus-session-signal-skill/
  pyproject.toml
  README.md
  src/evozeus_session_signal_skill/
    resources.py
  factors/
    mbti-personality-profile/
      FACTOR.xml
      factor.py
      spec.json
      session.json
  templates/
    ai-usage-profile-report/
      README.md
      report-data-contract.md
      index.html
      assets/
        evozeus-gold-512.png
  tests/
    test_packaged_resources.py
```

## Report Data Contract

最终 HTML 只接受一个稳定 JSON payload，字段如下：

```json
{
  "schema_version": "evozeus.ai_usage_profile_report.v1",
  "meta": {
    "subject": "用户",
    "generated_at": "2026-07-09T00:00:00+08:00",
    "scan_scope": "local_codex_sessions",
    "ledger_path": "/absolute/path/.evozeus/runtime/index/results.sqlite3"
  },
  "profile": {
    "code": "INTJ",
    "display_name": "INTJ 倾向",
    "archetype": "战略型拆解者",
    "confidence": 0.9,
    "evidence_count": 16,
    "known_dimensions": "4/4",
    "one_sentence": "画像结论更接近 INTJ：先定义问题、标准和边界，再推动 AI 执行。"
  },
  "session_review": {
    "scanned_sessions_total": 1445,
    "analyzed_sessions_total": 1445,
    "high_quality_sessions": 14,
    "low_quality_sessions": 19,
    "factor_results": 11560,
    "representative_sessions": []
  },
  "usage_patterns": {
    "cross_session_phrases": [],
    "session_local_repeats": [],
    "protocol_templates": [],
    "delegated_task_phrases": []
  },
  "factor_summary": {
    "mbti": {},
    "key_sentences": [],
    "repeated_requests": [],
    "sentiment": {},
    "resource_usage": {},
    "tool_failures": {},
    "task_completion": {}
  },
  "evidence_policy": {
    "direct_user_only": true,
    "excluded_scopes": ["delegated_task", "automation", "subagent_event", "context_wrapper"],
    "source_fields": ["session_id", "event_id", "source_ref", "source_line"]
  }
}
```

缺字段时不让 renderer 静默生成半成品；必须返回清晰错误。

## Task 1: 固化 Skill Repo 资源可发现性

**Files:**

- Create: `10-repos/EvoZeus-session-signal-skill/src/evozeus_session_signal_skill/resources.py`
- Create: `10-repos/EvoZeus-session-signal-skill/tests/test_packaged_resources.py`
- Modify: `10-repos/EvoZeus-session-signal-skill/README.md`

- [ ] **Step 1: 写 packaged resource 测试**

Create `tests/test_packaged_resources.py`:

```python
from evozeus_session_signal_skill.resources import source_checkout_root


def test_source_checkout_root_contains_official_factors_and_templates():
    root = source_checkout_root()

    assert (root / "factors" / "mbti-personality-profile" / "FACTOR.xml").is_file()
    assert (root / "factors" / "mbti-personality-profile" / "factor.py").is_file()
    assert (root / "templates" / "ai-usage-profile-report" / "index.html").is_file()
    assert (root / "templates" / "ai-usage-profile-report" / "report-data-contract.md").is_file()
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-session-signal-skill
PYTHONPATH=src python3 -m pytest tests/test_packaged_resources.py -q
```

Expected: FAIL because `evozeus_session_signal_skill.resources` does not exist.

- [ ] **Step 3: 增加源码 checkout root helper**

Create `src/evozeus_session_signal_skill/resources.py`:

```python
from __future__ import annotations

from pathlib import Path


def source_checkout_root() -> Path:
    """Return the repository root when running from a source checkout."""
    return Path(__file__).resolve().parents[2]


def factors_root() -> Path:
    return source_checkout_root() / "factors"


def templates_root() -> Path:
    return source_checkout_root() / "templates"
```

- [ ] **Step 4: 明确当前发布形态**

Update `README.md` 的命令说明，增加：

```markdown
## Runtime Integration

当前 P0 发布形态是 source checkout integration：`evozeus-runtime` 通过 `--official-repo-root /path/to/EvoZeus-session-signal-skill` 读取 `factors/` 和 `templates/`。

这意味着使用者需要同时 clone：

- `EvoZeus-infra`
- `EvoZeus-session-signal-skill`

如果只 `pip install EvoZeus-session-signal-skill`，不能假设 `factors/` 和 `templates/` 已经可被 runtime 发现。正式 wheel resource packaging 作为 P1 单独处理。
```

- [ ] **Step 5: 运行验证**

Run:

```bash
PYTHONPATH=src python3 -m pytest tests/test_packaged_resources.py -q
python3 scripts/validate_official_factor_spec.py factors/*/spec.json
python3 -m unittest discover -s tests
```

Expected:

```text
1 passed
8 valid
53 tests OK
```

- [ ] **Step 6: Commit**

```bash
git add README.md src/evozeus_session_signal_skill/resources.py tests/test_packaged_resources.py
git commit -m "docs: define session signal source resource integration"
```

## Task 2: 把 AI Usage Profile 模板迁入 infra reference resources

**Files:**

- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/__init__.py`
- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/README.md`
- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/report_data_contract.json`
- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/template.html`
- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/style.css`
- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/assets/evozeus-gold-512.png`
- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/assets/evozeus-zeus-hero.png`

- [ ] **Step 1: 复制现有模板资产**

Run:

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster
mkdir -p 10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/assets
cp 10-repos/EvoZeus-session-signal-skill/templates/ai-usage-profile-report/assets/evozeus-gold-512.png \
  10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/assets/evozeus-gold-512.png
cp 10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/project_insights/assets/evozeus-zeus-hero.png \
  10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/assets/evozeus-zeus-hero.png
touch 10-repos/EvoZeus-infra/src/evozeus_runtime/reports/reference/ai_usage_profile/__init__.py
```

- [ ] **Step 2: 从旧 HTML 中拆出 template 和 style**

把 `templates/ai-usage-profile-report/index.html` 中的静态样本数据替换为 Jinja 注入点：

```html
<script id="report-data" type="application/json">{{ report_data_json }}</script>
<script>
  const reportData = JSON.parse(document.getElementById("report-data").textContent);
</script>
```

不要保留 `const reportData = { ... sample ... }` 这种静态样本。模板中所有动态内容必须来自 `reportData`。

- [ ] **Step 3: 创建 JSON contract**

Create `report_data_contract.json`:

```json
{
  "id": "evozeus.ai_usage_profile_report.v1",
  "required_top_level_fields": [
    "schema_version",
    "meta",
    "profile",
    "session_review",
    "usage_patterns",
    "factor_summary",
    "evidence_policy"
  ],
  "required_profile_fields": [
    "code",
    "display_name",
    "archetype",
    "confidence",
    "evidence_count",
    "known_dimensions",
    "one_sentence"
  ],
  "required_session_review_fields": [
    "scanned_sessions_total",
    "analyzed_sessions_total",
    "high_quality_sessions",
    "low_quality_sessions",
    "factor_results",
    "representative_sessions"
  ],
  "evidence_policy": {
    "direct_user_only": true,
    "excluded_scopes": [
      "delegated_task",
      "automation",
      "subagent_event",
      "context_wrapper"
    ],
    "raw_upload": false
  }
}
```

- [ ] **Step 4: 写 reference README**

Create `README.md`:

```markdown
# AI Usage Profile Report Reference

This reference package renders the local EvoZeus AI usage assessment report.

The renderer accepts only `evozeus.ai_usage_profile_report.v1` payloads. It combines MBTI tendency, usage habits, old high-quality session review signals, project insights, factor summaries, and evidence policy into one static HTML report.

The report is local-first. Large HTML output is acceptable because users generate and open it on their own machine.
```

- [ ] **Step 5: Commit**

```bash
git add src/evozeus_runtime/reports/reference/ai_usage_profile
git commit -m "feat: add ai usage profile report reference assets"
```

## Task 3: 实现 AI Usage Profile renderer

**Files:**

- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/reports/ai_usage_profile.py`
- Create: `10-repos/EvoZeus-infra/tests/unit/test_ai_usage_profile_report.py`

- [ ] **Step 1: 写 renderer 单测**

Create `tests/unit/test_ai_usage_profile_report.py`:

```python
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
            markdown_href="ai-usage-profile.md",
        )
    )

    assert "INTJ 倾向" in html
    assert "战略型拆解者" in html
    assert "检查下" in html
    assert "高质量候选" in html
    assert "重复要求看到报告" in html
    assert "direct_user_only" in html
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-infra
PYTHONPATH=src python3 -m pytest tests/unit/test_ai_usage_profile_report.py -q
```

Expected: FAIL because `evozeus_runtime.reports.ai_usage_profile` does not exist.

- [ ] **Step 3: 实现 renderer API**

Create `src/evozeus_runtime/reports/ai_usage_profile.py`:

```python
from __future__ import annotations

import json
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path
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
    return template.render(
        report_data_json=json.dumps(payload, ensure_ascii=False),
        style_css=_read_reference_text("style.css"),
        markdown_href=snapshot.markdown_href,
    )


def load_ai_usage_profile_contract() -> dict[str, Any]:
    parsed = json.loads(_read_reference_text("report_data_contract.json"))
    return parsed if isinstance(parsed, dict) else {}


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


def _read_reference_text(name: str) -> str:
    return files(_REFERENCE_PACKAGE).joinpath(name).read_text(encoding="utf-8")
```

- [ ] **Step 4: 运行 renderer 测试**

Run:

```bash
PYTHONPATH=src python3 -m pytest tests/unit/test_ai_usage_profile_report.py -q
```

Expected:

```text
3 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/evozeus_runtime/reports/ai_usage_profile.py tests/unit/test_ai_usage_profile_report.py
git commit -m "feat: render ai usage profile report"
```

## Task 4: 实现 ledger -> AI Usage Profile payload 装配

**Files:**

- Create: `10-repos/EvoZeus-infra/src/evozeus_runtime/use_cases/generate_ai_usage_profile_report.py`
- Create: `10-repos/EvoZeus-infra/tests/integration/test_ai_usage_profile_report.py`

- [ ] **Step 1: 写集成测试**

Create `tests/integration/test_ai_usage_profile_report.py`:

```python
from pathlib import Path

from evozeus_runtime.factors.protocol import FactorResult, FactorStage
from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository
from evozeus_runtime.sessions.schema import SessionEnvelope, SessionEvent
from evozeus_runtime.use_cases.generate_ai_usage_profile_report import generate_ai_usage_profile_report


def test_generate_ai_usage_profile_report_uses_mbti_and_existing_factor_results(tmp_path):
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
                factor_id="official.mbti-personality-profile",
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
                        "id": "mbti_personality_profile",
                        "semantic_type": "mbti_personality_profile",
                        "shape": "record_set",
                        "records": [
                            {"axis": "E-I", "selected_pole": "I", "evidence_count": 4},
                            {"axis": "S-N", "selected_pole": "N", "evidence_count": 4},
                            {"axis": "T-F", "selected_pole": "T", "evidence_count": 4},
                            {"axis": "J-P", "selected_pole": "J", "evidence_count": 4},
                        ],
                    }
                ],
                evidence_refs=[{"ref_id": "u1", "kind": "user_turn"}],
                confidence=0.9,
            ),
            FactorResult(
                factor_id="official.usage-sentence-cloud",
                factor_version="v0.1.0",
                framework_id="evozeus.official",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="s1",
                session_id="s1",
                status="matched",
                datasets=[
                    {
                        "id": "high_frequency_phrase_set",
                        "semantic_type": "high_frequency_phrase_set",
                        "shape": "record_set",
                        "records": [{"text": "检查下", "count": 2, "weight": 2.0}],
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
    html = result.html_path.read_text(encoding="utf-8")
    assert "INTJ 倾向" in html
    assert "检查下" in html
    assert "检查报告链路" in html
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
PYTHONPATH=src python3 -m pytest tests/integration/test_ai_usage_profile_report.py -q
```

Expected: FAIL because `generate_ai_usage_profile_report` does not exist.

- [ ] **Step 3: 实现 use case**

Create `src/evozeus_runtime/use_cases/generate_ai_usage_profile_report.py` with these public objects:

```python
from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository, SessionAnalysisStatus
from evozeus_runtime.reports.ai_usage_profile import AiUsageProfileSnapshot, render_ai_usage_profile_html


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
) -> GenerateAiUsageProfileReportResult:
    paths = RuntimePaths.for_workspace(workspace_root).ensure()
    ledger = LedgerRepository(paths)
    statuses = ledger.list_session_statuses()
    factor_results = [
        result
        for status in statuses
        for result in ledger.list_factor_results(session_id=status.session_id)
    ]
    payload = build_ai_usage_profile_payload(
        statuses=statuses,
        factor_results=factor_results,
        ledger_path=paths.result_index_db,
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
        html_path.write_text(
            render_ai_usage_profile_html(
                AiUsageProfileSnapshot(payload=payload, ledger_path=paths.result_index_db, markdown_href=markdown_path.name)
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
) -> dict[str, Any]:
    mbti = _best_mbti(factor_results)
    phrases = _usage_phrases(factor_results)
    completion = _completion_counts(factor_results)
    return {
        "schema_version": "evozeus.ai_usage_profile_report.v1",
        "meta": {
            "subject": "用户",
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "scan_scope": "local_codex_sessions",
            "ledger_path": str(ledger_path),
        },
        "profile": mbti,
        "session_review": {
            "scanned_sessions_total": len(statuses),
            "analyzed_sessions_total": len(statuses),
            "high_quality_sessions": _high_quality_count(factor_results),
            "low_quality_sessions": max(0, len(statuses) - _high_quality_count(factor_results)),
            "factor_results": len(factor_results),
            "representative_sessions": _representative_sessions(statuses),
        },
        "usage_patterns": {
            "cross_session_phrases": phrases,
            "session_local_repeats": [],
            "protocol_templates": [],
            "delegated_task_phrases": [],
        },
        "factor_summary": {
            "mbti": mbti,
            "key_sentences": _dataset_records(factor_results, "key_sentence_trend")[:20],
            "repeated_requests": _dataset_records(factor_results, "evidence_record_set")[:20],
            "sentiment": _sentiment_summary(factor_results),
            "resource_usage": _resource_summary(factor_results),
            "tool_failures": _tool_failure_summary(factor_results),
            "task_completion": completion,
        },
        "evidence_policy": {
            "direct_user_only": True,
            "excluded_scopes": ["delegated_task", "automation", "subagent_event", "context_wrapper"],
            "source_fields": ["session_id", "event_id", "source_ref", "source_line"],
        },
    }
```

Append these helper implementations in the same file:

```python
def _best_mbti(factor_results: list[Any]) -> dict[str, Any]:
    matched = [
        result
        for result in factor_results
        if result.factor_id == "official.mbti-personality-profile" and result.status == "matched"
    ]
    if not matched:
        return {
            "code": "UNKNOWN",
            "display_name": "证据不足",
            "archetype": "待观察使用画像",
            "confidence": 0.0,
            "evidence_count": 0,
            "known_dimensions": "0/4",
            "one_sentence": "当前 session 证据不足，暂不推断 MBTI 倾向。",
        }
    best = max(matched, key=lambda result: result.confidence)
    code = str(best.statistics.get("inferred_type") or _tag_value(best.tags, "mbti_profile") or "UNKNOWN")
    evidence_count = int(best.statistics.get("evidence_count") or best.scores.get("mbti_evidence_count") or 0)
    known_dimension_count = int(best.statistics.get("known_dimension_count") or 0)
    return {
        "code": code,
        "display_name": f"{code} 倾向" if code != "UNKNOWN" else "证据不足",
        "archetype": _mbti_archetype(code),
        "confidence": round(float(best.scores.get("mbti_profile_confidence") or best.confidence), 3),
        "evidence_count": evidence_count,
        "known_dimensions": f"{known_dimension_count}/4",
        "one_sentence": _mbti_one_sentence(code),
    }


def _usage_phrases(factor_results: list[Any]) -> list[dict[str, Any]]:
    by_text: dict[str, dict[str, Any]] = {}
    for result in factor_results:
        for record in _result_dataset_records(result, "high_frequency_phrase_set"):
            text = str(record.get("text") or record.get("phrase") or "").strip()
            if not text:
                continue
            item = by_text.setdefault(
                text,
                {"text": text, "count": 0, "weight": 0.0, "session_ids": set()},
            )
            item["count"] += int(record.get("count") or record.get("occurrence_count") or 1)
            item["weight"] += float(record.get("weight") or 0.0)
            item["session_ids"].add(str(result.session_id or result.target_id))
    rows = []
    for item in by_text.values():
        rows.append(
            {
                "text": item["text"],
                "count": item["count"],
                "weight": round(float(item["weight"]), 3),
                "session_count": len(item["session_ids"]),
                "sample_session_ids": sorted(item["session_ids"])[:5],
            }
        )
    rows.sort(key=lambda row: (-int(row["count"]), str(row["text"])))
    return rows[:50]


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
    direct_gate_sessions = {
        result.session_id or result.target_id
        for result in factor_results
        if result.status == "matched"
        and result.factor_id
        in {
            "official.repeated-request",
            "official.user-input-sentiment",
            "official.task-completion",
        }
    }
    return len(direct_gate_sessions)


def _representative_sessions(statuses: list[SessionAnalysisStatus]) -> list[dict[str, Any]]:
    rows = []
    for status in statuses[:30]:
        rows.append(
            {
                "session_id": status.session_id,
                "title": status.session_title or status.session_id,
                "project": status.project_label or status.project_key,
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
```

- [ ] **Step 4: 运行集成测试**

Run:

```bash
PYTHONPATH=src python3 -m pytest tests/integration/test_ai_usage_profile_report.py -q
```

Expected:

```text
1 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/evozeus_runtime/use_cases/generate_ai_usage_profile_report.py tests/integration/test_ai_usage_profile_report.py
git commit -m "feat: build ai usage profile report from ledger"
```

## Task 5: 接入 CLI 和全链路命令

**Files:**

- Modify: `10-repos/EvoZeus-infra/src/evozeus_runtime/cli/main.py`
- Modify: `10-repos/EvoZeus-infra/src/evozeus_runtime/use_cases/run_codex_official_visualization.py`
- Modify: `10-repos/EvoZeus-infra/tests/integration/test_cli.py`
- Modify: `10-repos/EvoZeus-infra/tests/integration/test_codex_official_visualization.py`

- [ ] **Step 1: 增加 CLI 单测**

Add to `tests/integration/test_cli.py`:

```python
def test_usage_profile_report_command_generates_integrated_report(monkeypatch, tmp_path):
    output_dir = tmp_path / "reports" / "ai-usage-profile"
    html_path = output_dir / "index.html"
    json_path = output_dir / "report-data.json"
    markdown_path = output_dir / "summary.md"

    def fake_generate_ai_usage_profile_report(**kwargs: object) -> SimpleNamespace:
        assert kwargs["workspace_root"] == tmp_path
        assert kwargs["formats"] == ["json", "html"]
        assert kwargs["output_dir"] == output_dir
        return SimpleNamespace(
            html_path=html_path,
            json_path=json_path,
            markdown_path=markdown_path,
            ledger_path=tmp_path / ".evozeus" / "runtime" / "index" / "results.sqlite3",
            session_count=3,
            factor_result_count=24,
            mbti_code="INTJ",
        )

    monkeypatch.setattr(cli_main, "generate_ai_usage_profile_report", fake_generate_ai_usage_profile_report, raising=False)

    result = CliRunner().invoke(
        app,
        [
            "usage-profile-report",
            "--workspace",
            str(tmp_path),
            "--format",
            "json",
            "--format",
            "html",
            "--output-dir",
            str(output_dir),
        ],
    )

    assert result.exit_code == 0
    assert "sessions=3" in result.stdout
    assert "factor_results=24" in result.stdout
    assert "mbti=INTJ" in result.stdout
    assert f"html={html_path}" in result.stdout
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
PYTHONPATH=src python3 -m pytest tests/integration/test_cli.py::test_usage_profile_report_command_generates_integrated_report -q
```

Expected: FAIL because command is not registered.

- [ ] **Step 3: 实现 CLI 命令**

In `src/evozeus_runtime/cli/main.py`, import:

```python
from evozeus_runtime.use_cases.generate_ai_usage_profile_report import generate_ai_usage_profile_report
```

Add command:

```python
@app.command("usage-profile-report")
def usage_profile_report(
    format: list[str] = typer.Option(["json", "html"], "--format"),
    workspace: Path = typer.Option(Path.home(), "--workspace", help="Workspace root for .evozeus state. Defaults to home."),
    output_dir: Path | None = typer.Option(None, "--output-dir", help="Output directory. Defaults to runtime reports/ai-usage-profile."),
) -> None:
    result = generate_ai_usage_profile_report(
        workspace_root=workspace,
        formats=format,
        output_dir=output_dir,
    )
    typer.echo(f"sessions={result.session_count}")
    typer.echo(f"factor_results={result.factor_result_count}")
    typer.echo(f"mbti={result.mbti_code}")
    typer.echo(f"ledger={result.ledger_path}")
    typer.echo(f"json={result.json_path}")
    typer.echo(f"markdown={result.markdown_path}")
    typer.echo(f"html={result.html_path}")
```

- [ ] **Step 4: 让 session-insights 同时产出整合报告**

Update `run_codex_official_visualization.py`:

- import `generate_ai_usage_profile_report`
- extend `CodexOfficialVisualizationResult` with `usage_profile_html_path`
- after `generate_project_insights_site(...)`, call:

```python
usage_profile_result = generate_ai_usage_profile_report(
    workspace_root=workspace_root,
    formats=["markdown", "json", "html"],
)
```

- emit progress:

```python
_emit(progress, f"usage_profile_done html={usage_profile_result.html_path} mbti={usage_profile_result.mbti_code}")
```

- return `usage_profile_html_path=usage_profile_result.html_path`

Update `session_insights()` stdout:

```python
typer.echo(f"usage_profile_html={result.usage_profile_html_path}")
```

- [ ] **Step 5: 运行相关测试**

Run:

```bash
PYTHONPATH=src python3 -m pytest \
  tests/integration/test_cli.py::test_usage_profile_report_command_generates_integrated_report \
  tests/integration/test_codex_official_visualization.py -q
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/evozeus_runtime/cli/main.py \
  src/evozeus_runtime/use_cases/run_codex_official_visualization.py \
  tests/integration/test_cli.py \
  tests/integration/test_codex_official_visualization.py
git commit -m "feat: wire ai usage profile report into cli pipeline"
```

## Task 6: 强化 user-origin 口径进入报告

**Files:**

- Modify: `10-repos/EvoZeus-infra/src/evozeus_runtime/use_cases/generate_ai_usage_profile_report.py`
- Modify: `10-repos/EvoZeus-infra/tests/integration/test_ai_usage_profile_report.py`

- [ ] **Step 1: 增加 delegated task 排除测试**

Add to `tests/integration/test_ai_usage_profile_report.py`:

```python
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
    assert "delegated_task" in payload["evidence_policy"]["excluded_scopes"]
```

- [ ] **Step 2: 运行测试**

Run:

```bash
PYTHONPATH=src python3 -m pytest tests/integration/test_ai_usage_profile_report.py -q
```

Expected: PASS.

- [ ] **Step 3: 报告里展示来源判断**

Ensure payload includes:

```python
"evidence_policy": {
    "direct_user_only": True,
    "accepted_origins": ["event_msg", "event_msg_mirror", "response_item_mirror"],
    "excluded_origins": ["synthetic_context"],
    "excluded_scopes": ["delegated_task", "automation", "subagent_event", "context_wrapper"],
    "source_fields": ["session_id", "event_id", "source_ref", "source_line"]
}
```

Template must render this policy in a small evidence section named `证据口径`.

- [ ] **Step 4: Commit**

```bash
git add src/evozeus_runtime/use_cases/generate_ai_usage_profile_report.py tests/integration/test_ai_usage_profile_report.py
git commit -m "feat: expose direct user evidence policy in usage profile report"
```

## Task 7: README 加 clean-run 使用说明

**Files:**

- Modify: `10-repos/EvoZeus-infra/README.md`
- Modify: `10-repos/EvoZeus-session-signal-skill/README.md`

- [ ] **Step 1: infra README 增加一键命令**

Add:

````markdown
## Generate AI Usage Profile Report

从干净 clone 运行：

```bash
cd /path/to/EvoZeus-infra
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -e .
python3 -m pip install -e ../EvoZeus-session-signal-skill[nlp]
evozeus-runtime session-insights \
  --workspace "$HOME" \
  --official-repo-root "../EvoZeus-session-signal-skill" \
  --force \
  --no-skip-fresh \
  --project-min-sessions 1 \
  --project-top-n 30
```

输出：

- `.evozeus/runtime/index/results.sqlite3`
- `.evozeus/runtime/reports/ai-usage-profile/index.html`
- `.evozeus/runtime/reports/project-insights/project-analysis-zh.html`
- 可选完整 ledger browser HTML

本报告是本地生成、本地打开，HTML 文件较大不视为失败。
````

- [ ] **Step 2: skill README 明确依赖**

Add:

````markdown
## NLP Dependencies

完整 official factor chain 需要安装 NLP extra：

```bash
python3 -m pip install -e ".[nlp]"
```

缺少 `scikit-learn`、`jieba`、`rapidfuzz` 或 `snownlp` 时，相关 factor 会失败或输出降级结果。
````

- [ ] **Step 3: Commit**

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-infra
git add README.md
git commit -m "docs: document clean run for ai usage profile report"

cd /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-session-signal-skill
git add README.md
git commit -m "docs: document usage profile factor dependencies"
```

## Task 8: 发布前验证门禁

**Files:**

- No source changes required if previous tasks are complete.

- [ ] **Step 1: infra 单元和集成测试**

Run:

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-infra
PYTHONPATH=src python3 -m pytest -q
git diff --check
```

Expected:

```text
all tests passed
no whitespace errors
```

- [ ] **Step 2: skill factor 测试**

Run:

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-session-signal-skill
PYTHONPATH=src python3 -m pytest tests/test_signal_text_extraction.py -q
python3 -m unittest discover -s tests
python3 scripts/validate_official_factor_spec.py factors/*/spec.json
git diff --check
```

Expected:

```text
9 passed
53 tests OK
8 valid
no whitespace errors
```

- [ ] **Step 3: 从清空本地 runtime 开始跑全链路**

Run:

```bash
cd /Users/anthonyf/Documents/EvoZeus-cluster
rm -rf .evozeus
python3 10-repos/EvoZeus-infra/scripts/run_codex_official_visualization.py \
  --workspace /Users/anthonyf/Documents/EvoZeus-cluster \
  --official-repo-root /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-session-signal-skill \
  --output /Users/anthonyf/Documents/EvoZeus-cluster/30-ops/session-reports/2026-07-09-ai-usage-profile-current/index.html \
  --force \
  --no-skip-fresh \
  --project-min-sessions 1 \
  --project-top-n 30
```

Expected:

- `errors=0`
- `.evozeus/runtime/reports/ai-usage-profile/index.html` exists
- `.evozeus/runtime/reports/project-insights/project-analysis-zh.html` exists
- `.evozeus/runtime/index/results.sqlite3` exists

- [ ] **Step 4: 浏览器真人验收**

Open:

```text
file:///Users/anthonyf/Documents/EvoZeus-cluster/.evozeus/runtime/reports/ai-usage-profile/index.html
```

验收：

- 第一屏能看见 `INTJ 倾向` 或 `证据不足`。
- 能看见高频句、代表 session、重复请求、工具失败、任务完成、资源使用。
- 能看见 `证据口径`，说明 subagent / delegated task / synthetic context 的排除规则。
- 控制台没有 JavaScript error。
- 页面不是开发 repo artifacts 下的旧模板路径。

- [ ] **Step 5: 发布状态检查**

Run:

```bash
git -C /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-infra status --short
git -C /Users/anthonyf/Documents/EvoZeus-cluster/10-repos/EvoZeus-session-signal-skill status --short
```

Expected:

- 只允许有明确要提交的源码、文档、测试、模板变更。
- 不允许有 `build/`、`*.egg-info/`、`.evozeus/`、`__pycache__/`、大 HTML 输出进入待提交状态。

## 验收标准

发布前必须全部满足：

- `evozeus-runtime session-insights ...` 输出 `usage_profile_html=.../ai-usage-profile/index.html`。
- `usage-profile-report` 可单独从已有 ledger 生成报告，不需要重新扫描。
- 报告中 MBTI 结论明显，但带 session-derived 限定。
- 旧报告内容没有丢：高频句、代表 session、高质量候选、重复请求、工具失败、任务完成、资源使用都在同一份报告里。
- direct user evidence 口径可解释，不能把主 thread spawn subagent 的固定提示词当用户真实偏好。
- clean checkout 文档可执行，别人不需要知道本机开发路径。
- 两个 repo 的变更已提交，且没有 untracked 模板、factor 或 renderer 关键文件。

## 残余风险

- 新版 Codex session 原始记录格式如果再次变化，`codex_user_origin` 的判定仍需要 contract test 跟进。
- MBTI 仍是规则型 factor，不应被外部表述成心理测评结果。
- 大规模 session 下 HTML 会很大；P0 接受本机打开，P1 再做分页 JSON lazy load。
- 如果只发布 wheel，不发布 source checkout，必须单独完成 packaged resource integration；本计划 P0 默认使用 source checkout。

## 推荐执行顺序

1. Task 1 保证 skill repo 资源口径清楚。
2. Task 2-4 先让独立报告从已有 ledger 生成。
3. Task 5 接入 CLI 和全链路。
4. Task 6 校准证据口径。
5. Task 7 写 clean-run 文档。
6. Task 8 做发布门禁。
