from __future__ import annotations

import os
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from evozeus_runtime.coevolve.contracts.loader import ContractBundle, load_contract_bundle
from evozeus_runtime.coevolve.storage.atomic import private_directory


@dataclass(frozen=True)
class ContractInstallResult:
    status: str
    bundle: ContractBundle
    installed_path: Path
    current_path: Path


def _copy_bundle(source: ContractBundle, destination: Path) -> None:
    private_directory(destination)
    paths = ["manifest.json", *(entry.path for entry in source.manifest.files)]
    for relative_path in paths:
        source_path = source.root / relative_path
        destination_path = destination / relative_path
        private_directory(destination_path.parent)
        destination_path.write_bytes(source_path.read_bytes())
        destination_path.chmod(0o600)


def _switch_current(current: Path, version_name: str) -> None:
    temporary = current.parent / f".{current.name}.{uuid.uuid4().hex}.tmp"
    temporary.symlink_to(version_name, target_is_directory=True)
    try:
        os.replace(temporary, current)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def install_contract_bundle(source_root: Path, evozeus_home: Path) -> ContractInstallResult:
    source = load_contract_bundle(source_root)
    packs_root = private_directory(evozeus_home.expanduser().resolve() / "packs" / "coevolve")
    destination = packs_root / source.manifest.bundle_version
    current = packs_root / "current"
    created_destination = False

    if destination.is_symlink():
        raise ValueError(f"refusing symlinked contract version directory: {destination}")
    if destination.exists():
        installed = load_contract_bundle(destination)
        if installed.manifest_sha256 != source.manifest_sha256:
            raise ValueError(
                f"installed contract version has a different manifest: {destination}"
            )
        status = "already_installed"
    else:
        staging = packs_root / f".{source.manifest.bundle_version}.staging-{uuid.uuid4().hex}"
        try:
            _copy_bundle(source, staging)
            installed = load_contract_bundle(staging)
            if installed.manifest_sha256 != source.manifest_sha256:
                raise ValueError("staged contract manifest changed during installation")
            os.replace(staging, destination)
            created_destination = True
            status = "installed"
        except BaseException:
            if staging.exists():
                shutil.rmtree(staging)
            raise

    if current.exists() and not current.is_symlink():
        if created_destination:
            shutil.rmtree(destination)
        raise ValueError(f"refusing to replace non-symlink contract pointer: {current}")
    try:
        _switch_current(current, destination.name)
    except BaseException:
        if created_destination:
            shutil.rmtree(destination)
        raise

    installed = load_contract_bundle(destination)
    return ContractInstallResult(
        status=status,
        bundle=installed,
        installed_path=destination,
        current_path=current,
    )
