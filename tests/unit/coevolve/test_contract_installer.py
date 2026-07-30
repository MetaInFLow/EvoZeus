import json
import shutil
from pathlib import Path

import pytest

import evozeus_runtime.coevolve.attachment.installer as installer
from evozeus_runtime.coevolve.attachment.installer import install_contract_bundle


COEVOLVE_BUNDLE = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "coevolve_contracts"
    / "v1"
)


def make_version(source: Path, destination: Path, version: str) -> Path:
    shutil.copytree(source, destination)
    manifest_path = destination / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["bundle_version"] = version
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    return destination


def test_contract_upgrade_keeps_previous_pack_and_switches_current(tmp_path: Path) -> None:
    home = tmp_path / ".evozeus"
    first = install_contract_bundle(COEVOLVE_BUNDLE, home)
    upgrade = make_version(COEVOLVE_BUNDLE, tmp_path / "upgrade", "v1.0.1")

    second = install_contract_bundle(upgrade, home)

    assert first.installed_path.exists()
    assert second.installed_path.exists()
    assert second.current_path.resolve() == second.installed_path


def test_pointer_switch_failure_restores_previous_install(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    home = tmp_path / ".evozeus"
    first = install_contract_bundle(COEVOLVE_BUNDLE, home)
    upgrade = make_version(COEVOLVE_BUNDLE, tmp_path / "upgrade", "v1.0.1")

    def fail_switch(current: Path, version_name: str) -> None:
        raise OSError("simulated interruption")

    monkeypatch.setattr(installer, "_switch_current", fail_switch)
    with pytest.raises(OSError, match="simulated interruption"):
        install_contract_bundle(upgrade, home)

    assert first.current_path.resolve() == first.installed_path
    assert not (home / "packs" / "coevolve" / "v1.0.1").exists()
