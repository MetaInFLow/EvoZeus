from __future__ import annotations

import hashlib
import os
import re
import stat
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

from evozeus_runtime.coevolve.contracts.loader import ContractBundle


CANONICAL_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SKILL_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class AttachmentPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["external-sidecar"] = "external-sidecar"
    target_writes: Literal[False] = False
    canonical_repo: str
    canonical_path: str
    target_kind: Literal["skillware", "software"]
    skill_name: str
    target_tree_sha256: str
    contract_bundle_version: str
    contract_manifest_sha256: str


def target_tree_sha256(root: Path) -> str:
    root = root.expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"target is not a directory: {root}")
    digest = hashlib.sha256()
    paths = sorted(
        (path for path in root.rglob("*") if ".git" not in path.relative_to(root).parts),
        key=lambda path: path.relative_to(root).as_posix(),
    )
    for path in paths:
        relative = path.relative_to(root).as_posix()
        metadata = path.lstat()
        mode = stat.S_IMODE(metadata.st_mode)
        if path.is_symlink():
            kind = "symlink"
            payload = os.readlink(path).encode("utf-8")
        elif path.is_dir():
            kind = "directory"
            payload = b""
        elif path.is_file():
            kind = "file"
            payload = hashlib.sha256(path.read_bytes()).digest()
        else:
            raise ValueError(f"unsupported target tree entry: {path}")
        for value in (
            relative.encode("utf-8"),
            kind.encode("ascii"),
            str(mode).encode("ascii"),
            payload,
        ):
            digest.update(value)
            digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def plan_external_attachment(
    *,
    target: Path,
    canonical_repo: str,
    skill_name: str,
    target_kind: Literal["skillware", "software"],
    bundle: ContractBundle,
) -> AttachmentPlan:
    if CANONICAL_REPO_RE.fullmatch(canonical_repo) is None:
        raise ValueError(f"invalid canonical repository: {canonical_repo}")
    if SKILL_NAME_RE.fullmatch(skill_name) is None:
        raise ValueError(f"invalid skill name: {skill_name}")
    canonical_target = target.expanduser().resolve(strict=True)
    if not canonical_target.is_dir():
        raise ValueError(f"target is not a directory: {canonical_target}")
    return AttachmentPlan(
        canonical_repo=canonical_repo,
        canonical_path=str(canonical_target),
        target_kind=target_kind,
        skill_name=skill_name,
        target_tree_sha256=target_tree_sha256(canonical_target),
        contract_bundle_version=bundle.manifest.bundle_version,
        contract_manifest_sha256=f"sha256:{bundle.manifest_sha256}",
    )
