from evozeus.factors.defaults import run_default_factors
from evozeus.models import SessionEvent


def test_default_factors_extract_rework_negative_and_tool_failure_tags():
    events = [
        SessionEvent(event_id="e1", role="user", content="修复 dashboard 的图表展示"),
        SessionEvent(event_id="e2", role="assistant", content="我会检查。"),
        SessionEvent(event_id="e3", role="user", content="不对，继续修复 dashboard，之前没改到根因"),
        SessionEvent(
            event_id="e4",
            role="tool",
            content="",
            tool_name="exec_command",
            tool_result={"stderr": "Traceback: failed with timeout"},
        ),
    ]

    results = run_default_factors(session_id="s1", events=events)
    tags = [tag for result in results for tag in result.tags]
    verdict_signals = {signal for result in results for signal in result.verdict_signals}

    assert {"type": "negative_feedback", "value": "correction"} in tags
    assert {"type": "rework", "value": "same_target_rework"} in tags
    assert {"type": "tool_failure", "value": "exec_command"} in tags
    assert "Promote to Skill" in verdict_signals
    assert "Fix Environment" in verdict_signals
