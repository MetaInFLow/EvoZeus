from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Literal

from pydantic import BaseModel, ConfigDict, Field

from evozeus_runtime.coevolve.attachment.plan import plan_external_attachment, target_tree_sha256
from evozeus_runtime.coevolve.contracts.loader import ContractBundle
from evozeus_runtime.coevolve.storage.atomic import atomic_write_json, private_directory


CANONICAL_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class AttachmentTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    canonical_repo: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    canonical_path: str
    target_kind: Literal["skillware", "software"]
    skill_name: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class AttachmentBundleRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bundle_id: Literal["evozeus-coevolve"]
    bundle_version: str = Field(pattern=r"^v[0-9]+\.[0-9]+\.[0-9]+$")
    manifest_sha256: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")


class AttachmentRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["evozeus.coevolve.attachment.v1"]
    attachment_id: str = Field(pattern=r"^att_[a-f0-9]{24}$")
    mode: Literal["external-sidecar"]
    target: AttachmentTarget
    contract_bundle: AttachmentBundleRef
    target_tree_sha256: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    attached_at: datetime


class AttachmentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["attached", "already_attached", "detached", "absent"]
    target_writes: Literal[False] = False
    record: AttachmentRecord | None = None


def _attachment_id(canonical_repo: str) -> str:
    digest = hashlib.sha256(canonical_repo.lower().encode("utf-8")).hexdigest()
    return f"att_{digest[:24]}"


@contextmanager
def _registry_lock(root: Path) -> Iterator[None]:
    private_directory(root)
    path = root / ".registry.lock"
    descriptor = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
    with os.fdopen(descriptor, "r+") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


class AttachmentRegistry:
    def __init__(self, evozeus_home: Path):
        self.root = evozeus_home.expanduser().resolve() / "coevolve" / "targets"

    def _record_path(self, canonical_repo: str) -> Path:
        return self.root / f"{_attachment_id(canonical_repo)}.json"

    def get(self, canonical_repo: str) -> AttachmentRecord | None:
        path = self._record_path(canonical_repo)
        if path.is_symlink():
            raise ValueError(f"attachment record must not be a symlink: {path}")
        if not path.exists():
            return None
        if not path.is_file():
            raise ValueError(f"attachment record is not a regular file: {path}")
        return AttachmentRecord.model_validate_json(path.read_text(encoding="utf-8"))

    def list(self) -> list[AttachmentRecord]:
        if not self.root.is_dir():
            return []
        records = []
        for path in sorted(self.root.glob("att_*.json")):
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"attachment record is not a regular file: {path}")
            records.append(AttachmentRecord.model_validate_json(path.read_text(encoding="utf-8")))
        return sorted(records, key=lambda record: record.target.canonical_repo.lower())

    def attach(
        self,
        *,
        target: Path,
        canonical_repo: str,
        skill_name: str,
        target_kind: Literal["skillware", "software"],
        bundle: ContractBundle,
    ) -> AttachmentResult:
        plan = plan_external_attachment(
            target=target,
            canonical_repo=canonical_repo,
            skill_name=skill_name,
            target_kind=target_kind,
            bundle=bundle,
        )
        record = AttachmentRecord(
            schema_version="evozeus.coevolve.attachment.v1",
            attachment_id=_attachment_id(canonical_repo),
            mode="external-sidecar",
            target=AttachmentTarget(
                canonical_repo=canonical_repo,
                canonical_path=plan.canonical_path,
                target_kind=target_kind,
                skill_name=skill_name,
            ),
            contract_bundle=AttachmentBundleRef(
                bundle_id=bundle.manifest.bundle_id,
                bundle_version=bundle.manifest.bundle_version,
                manifest_sha256=f"sha256:{bundle.manifest_sha256}",
            ),
            target_tree_sha256=plan.target_tree_sha256,
            attached_at=datetime.now(timezone.utc),
        )
        with _registry_lock(self.root):
            existing = self.get(canonical_repo)
            if existing is not None:
                if (
                    existing.target.canonical_path != plan.canonical_path
                    or existing.target.skill_name != skill_name
                    or existing.target.target_kind != target_kind
                ):
                    raise ValueError(
                        "canonical repository is already attached to a different target identity"
                    )
                return AttachmentResult(status="already_attached", record=existing)
            atomic_write_json(
                self._record_path(canonical_repo),
                record.model_dump(mode="json"),
            )
        return AttachmentResult(status="attached", record=record)

    def detach(self, canonical_repo: str) -> AttachmentResult:
        if CANONICAL_REPO_RE.fullmatch(canonical_repo) is None:
            raise ValueError(f"invalid canonical repository: {canonical_repo}")
        with _registry_lock(self.root):
            record = self.get(canonical_repo)
            if record is None:
                return AttachmentResult(status="absent")
            self._record_path(canonical_repo).unlink()
        return AttachmentResult(status="detached", record=record)
