from __future__ import annotations

import json
from pathlib import Path

from pydantic import Field

from evozeus.factors.protocol import FactorSpec


class FactorManifest(FactorSpec):
    schema_version: str = "factor.v0"
    version: str
    status: str
    description: str
    entrypoint: str = ""
    permissions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    rollback: str
    run: dict[str, str | int] = Field(default_factory=dict)


def load_manifest(path: Path) -> FactorManifest:
    data = json.loads(path.read_text(encoding="utf-8"))
    return FactorManifest.model_validate(data)
