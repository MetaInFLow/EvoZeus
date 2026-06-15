from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from pathlib import Path

from evozeus.factors.base import Factor
from evozeus.factors.manifest import FactorManifest, load_manifest


@dataclass(frozen=True)
class FactorPack:
    root: Path
    manifest: FactorManifest


class FactorPackRepository:
    def __init__(self, pack_root: Path):
        self.pack_root = pack_root

    def discover(self) -> list[FactorPack]:
        if not self.pack_root.exists():
            return []
        packs = [
            FactorPack(root=path.parent, manifest=load_manifest(path))
            for path in sorted(self.pack_root.glob("*/*/factor.json"))
        ]
        return packs

    def load(self, factor_id: str, version: str | None = None) -> Factor:
        matches = [
            pack
            for pack in self.discover()
            if pack.manifest.id == factor_id and (version is None or pack.manifest.version == version)
        ]
        if not matches:
            raise KeyError(f"unknown factor pack: {factor_id}")
        return _load_factor(matches[-1])


def _load_factor(pack: FactorPack) -> Factor:
    module_name, class_name = _parse_entrypoint(pack.manifest.entrypoint)
    module_path = pack.root / f"{module_name}.py"
    spec = importlib.util.spec_from_file_location(
        f"evozeus_factor_pack_{pack.manifest.id.replace('.', '_')}_{pack.manifest.version.replace('.', '_')}",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load factor module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    factor_class = getattr(module, class_name)
    factor = factor_class()
    if not isinstance(factor, Factor):
        raise TypeError(f"factor entrypoint does not implement Factor: {pack.manifest.entrypoint}")
    return factor


def _parse_entrypoint(entrypoint: str) -> tuple[str, str]:
    if ":" not in entrypoint:
        raise ValueError("factor entrypoint must use module:ClassName")
    module_name, class_name = entrypoint.split(":", 1)
    return module_name, class_name
