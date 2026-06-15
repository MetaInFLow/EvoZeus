from __future__ import annotations

import sys

from evozeus.factors.base import FactorContext
from evozeus.factors.builtins import builtin_factors
from evozeus.factors.registry import FactorRegistry
from evozeus.factors.runner import FactorRunner
from smoke_support import sample_session


def main() -> None:
    factor_id = sys.argv[1] if len(sys.argv) > 1 else "default.tool_failure"
    registry = FactorRegistry()
    for factor in builtin_factors():
        registry.register(factor)

    factor = registry.get(factor_id)
    summary = FactorRunner([factor]).run(FactorContext(session=sample_session()))
    assert not summary.errors, summary.errors
    assert summary.results, "expected a factor result"
    result = summary.results[0]
    assert result.status == "matched"
    verdict = result.verdict_signals[0] if result.verdict_signals else "None"
    print(f"run factor ok: factor_id={result.factor_id} status={result.status} verdict={verdict}")


if __name__ == "__main__":
    main()
