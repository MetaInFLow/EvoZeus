from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from evozeus_runtime import __version__


SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
VERSION_RE = re.compile(r"^(?:v)?([0-9]+)\.([0-9]+)\.([0-9]+)$")


class ContractBundleError(ValueError):
    """Raised when a CoEvolve contract pack cannot be trusted."""


class RuntimeCompatibility(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min_inclusive: str
    max_exclusive: str


class ContractFileEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    sha256: str
    role: str = Field(min_length=1, max_length=120)


class ContractManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str
    bundle_id: str
    bundle_version: str
    source_repository: str
    source_revision: str
    runtime_compatibility: RuntimeCompatibility
    files: list[ContractFileEntry]


@dataclass(frozen=True)
class ContractBundle:
    root: Path
    manifest: ContractManifest
    manifest_sha256: str


def _version_tuple(value: str) -> tuple[int, int, int]:
    match = VERSION_RE.fullmatch(value)
    if match is None:
        raise ContractBundleError(f"invalid semantic version: {value}")
    return tuple(int(part) for part in match.groups())


def _validate_relative_path(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise ContractBundleError(f"unsafe contract path: {value}")
    if path.as_posix() != value:
        raise ContractBundleError(f"contract path must use canonical POSIX form: {value}")
    return path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_contract_bundle(
    root: Path,
    *,
    runtime_version: str = __version__,
) -> ContractBundle:
    root = root.expanduser().resolve()
    manifest_path = root / "manifest.json"
    if not root.is_dir() or not manifest_path.is_file() or manifest_path.is_symlink():
        raise ContractBundleError(f"contract bundle manifest is missing or unsafe: {manifest_path}")

    try:
        raw_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest = ContractManifest.model_validate(raw_manifest)
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        raise ContractBundleError(f"invalid contract manifest: {exc}") from exc

    if manifest.schema_version != "evozeus.coevolve.contract-manifest.v1":
        raise ContractBundleError(f"unsupported contract manifest: {manifest.schema_version}")
    if manifest.bundle_id != "evozeus-coevolve":
        raise ContractBundleError(f"unexpected contract bundle id: {manifest.bundle_id}")
    _version_tuple(manifest.bundle_version)

    runtime = _version_tuple(runtime_version)
    minimum = _version_tuple(manifest.runtime_compatibility.min_inclusive)
    maximum = _version_tuple(manifest.runtime_compatibility.max_exclusive)
    if not minimum <= runtime < maximum:
        raise ContractBundleError(
            f"runtime {runtime_version} is outside supported range "
            f"[{manifest.runtime_compatibility.min_inclusive}, "
            f"{manifest.runtime_compatibility.max_exclusive})"
        )

    declared: set[str] = set()
    for entry in manifest.files:
        relative = _validate_relative_path(entry.path)
        if entry.path in declared:
            raise ContractBundleError(f"duplicate contract path: {entry.path}")
        declared.add(entry.path)
        if SHA256_RE.fullmatch(entry.sha256) is None:
            raise ContractBundleError(f"invalid sha256 for contract file: {entry.path}")
        path = root.joinpath(*relative.parts)
        if not path.is_file() or path.is_symlink():
            raise ContractBundleError(f"declared contract file is missing or unsafe: {entry.path}")
        if _sha256(path) != entry.sha256:
            raise ContractBundleError(f"contract hash mismatch: {entry.path}")

    actual = {
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path != manifest_path
    }
    symlinks = sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_symlink()
    )
    if symlinks:
        raise ContractBundleError(f"contract bundle contains symlinks: {symlinks}")
    if actual != declared:
        missing = sorted(declared - actual)
        undeclared = sorted(actual - declared)
        raise ContractBundleError(
            f"contract inventory mismatch: missing={missing}, undeclared={undeclared}"
        )

    return ContractBundle(
        root=root,
        manifest=manifest,
        manifest_sha256=_sha256(manifest_path),
    )
