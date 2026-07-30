import json
import shutil
from pathlib import Path

import pytest

from evozeus_runtime.coevolve.contracts.loader import ContractBundleError, load_contract_bundle


COEVOLVE_BUNDLE = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "coevolve_contracts"
    / "v1"
)


def test_load_contract_bundle_verifies_manifest_and_runtime_compatibility() -> None:
    bundle = load_contract_bundle(COEVOLVE_BUNDLE)

    assert bundle.manifest.bundle_id == "evozeus-coevolve"
    assert bundle.manifest.bundle_version == "v1.0.0"
    assert len(bundle.manifest_sha256) == 64


def test_load_contract_bundle_rejects_changed_contract(tmp_path: Path) -> None:
    copy = tmp_path / "contracts"
    shutil.copytree(COEVOLVE_BUNDLE, copy)
    attachment = copy / "schemas" / "attachment-v1.schema.json"
    attachment.write_text("{}\n", encoding="utf-8")

    with pytest.raises(ContractBundleError, match="hash mismatch"):
        load_contract_bundle(copy)


def test_load_contract_bundle_rejects_undeclared_file(tmp_path: Path) -> None:
    copy = tmp_path / "contracts"
    shutil.copytree(COEVOLVE_BUNDLE, copy)
    (copy / "unexpected.txt").write_text("unexpected\n", encoding="utf-8")

    with pytest.raises(ContractBundleError, match="inventory mismatch"):
        load_contract_bundle(copy)


def test_load_contract_bundle_rejects_symlink(tmp_path: Path) -> None:
    copy = tmp_path / "contracts"
    shutil.copytree(COEVOLVE_BUNDLE, copy)
    (copy / "unsafe-link").symlink_to("schemas", target_is_directory=True)

    with pytest.raises(ContractBundleError, match="symlinks"):
        load_contract_bundle(copy)


def test_load_contract_bundle_rejects_incompatible_runtime(tmp_path: Path) -> None:
    copy = tmp_path / "contracts"
    shutil.copytree(COEVOLVE_BUNDLE, copy)
    manifest_path = copy / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["runtime_compatibility"] = {
        "min_inclusive": "9.0.0",
        "max_exclusive": "10.0.0",
    }
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(ContractBundleError, match="outside supported range"):
        load_contract_bundle(copy)
