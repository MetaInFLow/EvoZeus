from __future__ import annotations

from pydantic import BaseModel, Field

from evozeus.factors.base import Factor, FactorContext
from evozeus.factors.protocol import FactorResult


class FactorRunError(BaseModel):
    factor_id: str
    error_type: str
    message: str


class FactorRunSummary(BaseModel):
    results: list[FactorResult] = Field(default_factory=list)
    errors: list[FactorRunError] = Field(default_factory=list)


class FactorRunner:
    def __init__(self, factors: list[Factor]):
        self.factors = factors

    def run(self, context: FactorContext) -> FactorRunSummary:
        summary = FactorRunSummary()
        for factor in self.factors:
            try:
                result = factor.execute(context)
            except Exception as exc:
                summary.errors.append(
                    FactorRunError(
                        factor_id=factor.manifest.id,
                        error_type=type(exc).__name__,
                        message=str(exc),
                    )
                )
                continue
            summary.results.append(result)
        return summary
