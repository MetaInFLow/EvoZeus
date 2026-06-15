from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from pathlib import Path
import xml.etree.ElementTree as ET

from evozeus.factors.base import Factor
from evozeus.factors.manifest import FactorManifest, load_manifest


@dataclass(frozen=True)
class FactorIntroduction:
    id: str
    version: str
    name: str
    summary: str
    category: str
    stage: str
    runtime: str
    inputs: list[str]
    outputs: list[str]
    when_to_use: str
    limitations: str
    privacy: str
    visualization: FactorVisualization


@dataclass(frozen=True)
class FactorVisualization:
    component: str
    title: str
    description: str


@dataclass(frozen=True)
class FactorPack:
    root: Path
    manifest: FactorManifest
    introduction: FactorIntroduction


class FactorPackRepository:
    def __init__(self, pack_root: Path):
        self.pack_root = pack_root

    def discover(self) -> list[FactorPack]:
        if not self.pack_root.exists():
            return []
        packs = [load_factor_pack(path.parent) for path in sorted(self.pack_root.glob("*/*/factor.json"))]
        return packs

    def load(self, factor_id: str, version: str | None = None) -> Factor:
        return load_factor_from_pack(self.get(factor_id, version))

    def get(self, factor_id: str, version: str | None = None) -> FactorPack:
        matches = [
            pack
            for pack in self.discover()
            if pack.manifest.id == factor_id and (version is None or pack.manifest.version == version)
        ]
        if not matches:
            raise KeyError(f"unknown factor pack: {factor_id}")
        return matches[-1]


def load_factor_pack(root: Path) -> FactorPack:
    manifest = load_manifest(root / "factor.json")
    introduction = load_introduction(root / "FACTOR.xml")
    _validate_intro_matches_manifest(introduction, manifest, root)
    return FactorPack(root=root, manifest=manifest, introduction=introduction)


def load_introduction(path: Path) -> FactorIntroduction:
    if not path.is_file():
        raise FileNotFoundError(f"missing FACTOR.xml: {path}")

    root = ET.fromstring(path.read_text(encoding="utf-8"))
    if root.tag != "factor":
        raise ValueError(f"FACTOR.xml root element must be <factor>: {path}")

    introduction = FactorIntroduction(
        id=(root.attrib.get("id") or "").strip(),
        version=(root.attrib.get("version") or "").strip(),
        name=_required_text(root, "name", path),
        summary=_required_text(root, "summary", path),
        category=_required_text(root, "category", path),
        stage=_required_text(root, "stage", path),
        runtime=_required_text(root, "runtime", path),
        inputs=_required_list(root, "inputs", "input", path),
        outputs=_required_list(root, "outputs", "output", path),
        when_to_use=_required_text(root, "when_to_use", path),
        limitations=_required_text(root, "limitations", path),
        privacy=_required_text(root, "privacy", path),
        visualization=_required_visualization(root, path),
    )
    if not introduction.id or not introduction.version:
        raise ValueError(f"FACTOR.xml must declare id and version attributes: {path}")
    return introduction


def load_factor_from_pack(pack: FactorPack) -> Factor:
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


def _validate_intro_matches_manifest(introduction: FactorIntroduction, manifest: FactorManifest, root: Path) -> None:
    mismatches = []
    if introduction.id != manifest.id:
        mismatches.append(f"id={introduction.id!r} expected {manifest.id!r}")
    if introduction.version != manifest.version:
        mismatches.append(f"version={introduction.version!r} expected {manifest.version!r}")
    if introduction.stage != manifest.stage.value:
        mismatches.append(f"stage={introduction.stage!r} expected {manifest.stage.value!r}")
    if introduction.runtime != manifest.runtime.mode.value:
        mismatches.append(f"runtime={introduction.runtime!r} expected {manifest.runtime.mode.value!r}")
    if mismatches:
        raise ValueError(f"FACTOR.xml does not match factor.json in {root}: {', '.join(mismatches)}")


def _required_text(root: ET.Element, name: str, path: Path) -> str:
    child = root.find(name)
    text = child.text.strip() if child is not None and child.text else ""
    if not text:
        raise ValueError(f"FACTOR.xml missing required <{name}> text: {path}")
    return text


def _required_list(root: ET.Element, parent_name: str, item_name: str, path: Path) -> list[str]:
    parent = root.find(parent_name)
    values = [
        (child.text or "").strip()
        for child in list(parent) if child.tag == item_name
    ] if parent is not None else []
    values = [value for value in values if value]
    if not values:
        raise ValueError(f"FACTOR.xml missing required <{parent_name}><{item_name}> items: {path}")
    return values


def _required_visualization(root: ET.Element, path: Path) -> FactorVisualization:
    node = root.find("visualization")
    if node is None:
        raise ValueError(f"FACTOR.xml missing required <visualization>: {path}")
    component = (node.attrib.get("component") or "").strip()
    if not component:
        raise ValueError(f"FACTOR.xml <visualization> must declare component: {path}")
    return FactorVisualization(
        component=component,
        title=_required_text(node, "title", path),
        description=_required_text(node, "description", path),
    )
