import stat
from pathlib import Path

import pytest

from evozeus_runtime.coevolve.attachment.registry import (
    AttachmentRegistry,
    target_tree_sha256,
)
from evozeus_runtime.coevolve.contracts.loader import load_contract_bundle


COEVOLVE_BUNDLE = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "coevolve_contracts"
    / "v1"
)


def test_external_sidecar_attach_detach_never_changes_target_tree(tmp_path: Path) -> None:
    target = tmp_path / "target-skill"
    target.mkdir()
    (target / "SKILL.md").write_text("# Original Skill\n", encoding="utf-8")
    before = target_tree_sha256(target)
    registry = AttachmentRegistry(tmp_path / "home" / ".evozeus")

    attached = registry.attach(
        target=target,
        canonical_repo="MetaInFLow/example-skill",
        skill_name="example-skill",
        target_kind="skillware",
        bundle=load_contract_bundle(COEVOLVE_BUNDLE),
    )
    after_attach = target_tree_sha256(target)
    detached = registry.detach("MetaInFLow/example-skill")
    after_detach = target_tree_sha256(target)

    assert attached.status == "attached"
    assert attached.target_writes is False
    assert attached.record is not None
    assert attached.record.target_tree_sha256 == before
    assert detached.status == "detached"
    assert before == after_attach == after_detach
    assert list(target.iterdir()) == [target / "SKILL.md"]


def test_attach_is_idempotent_and_registry_is_private(tmp_path: Path) -> None:
    target = tmp_path / "target"
    target.mkdir()
    bundle = load_contract_bundle(COEVOLVE_BUNDLE)
    registry = AttachmentRegistry(tmp_path / ".evozeus")
    kwargs = {
        "target": target,
        "canonical_repo": "MetaInFLow/example",
        "skill_name": "example",
        "target_kind": "skillware",
        "bundle": bundle,
    }

    first = registry.attach(**kwargs)
    second = registry.attach(**kwargs)
    record_files = list(registry.root.glob("att_*.json"))

    assert first.status == "attached"
    assert second.status == "already_attached"
    assert len(record_files) == 1
    assert stat.S_IMODE(registry.root.stat().st_mode) == 0o700
    assert stat.S_IMODE(record_files[0].stat().st_mode) == 0o600


def test_registry_rejects_symlinked_record(tmp_path: Path) -> None:
    registry = AttachmentRegistry(tmp_path / ".evozeus")
    registry.root.mkdir(parents=True)
    outside = tmp_path / "outside.json"
    outside.write_text("{}\n", encoding="utf-8")
    record_path = registry._record_path("MetaInFLow/example")
    record_path.symlink_to(outside)

    with pytest.raises(ValueError, match="symlink"):
        registry.get("MetaInFLow/example")
