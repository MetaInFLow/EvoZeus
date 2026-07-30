from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal, NoReturn

import typer

from evozeus_runtime.coevolve.attachment.installer import install_contract_bundle
from evozeus_runtime.coevolve.attachment.plan import plan_external_attachment
from evozeus_runtime.coevolve.attachment.registry import AttachmentRegistry
from evozeus_runtime.coevolve.contracts.loader import ContractBundleError, load_contract_bundle


app = typer.Typer(help="EvoZeus-CoEvolve local runtime.")
contracts_app = typer.Typer(help="Verify and install pinned CoEvolve contract packs.")
skill_app = typer.Typer(help="Attach existing Skillware without changing target-owned files.")
app.add_typer(contracts_app, name="contracts")
app.add_typer(skill_app, name="skill")


def _configured_evozeus_home() -> Path:
    configured = os.environ.get("EVOZEUS_RUNTIME_STATE_ROOT") or os.environ.get("EVOZEUS_HOME")
    return Path(configured).expanduser().resolve() if configured else Path.home() / ".evozeus"


def _emit(payload: dict[str, object]) -> None:
    typer.echo(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def _fail(stage: str, error: Exception) -> NoReturn:
    _emit({"ok": False, "stage": stage, "error": str(error)})
    raise typer.Exit(2)


def _default_contract_pack(evozeus_home: Path) -> Path:
    return evozeus_home.expanduser().resolve() / "packs" / "coevolve" / "current"


@contracts_app.command("verify")
def contracts_verify(
    pack: Path = typer.Option(..., "--pack", help="CoEvolve contract bundle directory."),
) -> None:
    try:
        bundle = load_contract_bundle(pack)
    except (ContractBundleError, OSError) as exc:
        _fail("contracts.verify", exc)
    _emit(
        {
            "ok": True,
            "stage": "contracts.verify",
            "bundle_id": bundle.manifest.bundle_id,
            "bundle_version": bundle.manifest.bundle_version,
            "manifest_sha256": f"sha256:{bundle.manifest_sha256}",
            "pack": str(bundle.root),
        }
    )


@contracts_app.command("install")
def contracts_install(
    source: Path = typer.Option(..., "--source", help="Verified source contract bundle."),
    evozeus_home: Path = typer.Option(
        _configured_evozeus_home(),
        "--evozeus-home",
        help="EvoZeus installation and local-state root.",
    ),
) -> None:
    try:
        result = install_contract_bundle(source, evozeus_home)
    except (ContractBundleError, OSError, ValueError) as exc:
        _fail("contracts.install", exc)
    _emit(
        {
            "ok": True,
            "stage": "contracts.install",
            "status": result.status,
            "bundle_version": result.bundle.manifest.bundle_version,
            "manifest_sha256": f"sha256:{result.bundle.manifest_sha256}",
            "installed_path": str(result.installed_path),
            "current_path": str(result.current_path),
            "target_writes": False,
        }
    )


@skill_app.command("attach")
def skill_attach(
    target: Path = typer.Option(..., "--target", help="Existing Skillware/software directory."),
    canonical_repo: str = typer.Option(..., "--repo", help="Canonical OWNER/REPO identity."),
    skill_name: str = typer.Option(..., "--skill-name"),
    target_kind: Literal["skillware", "software"] = typer.Option("skillware", "--target-kind"),
    contract_pack: Path | None = typer.Option(None, "--contract-pack"),
    evozeus_home: Path = typer.Option(
        _configured_evozeus_home(),
        "--evozeus-home",
        help="EvoZeus installation and local-state root.",
    ),
) -> None:
    pack = contract_pack or _default_contract_pack(evozeus_home)
    try:
        bundle = load_contract_bundle(pack)
        result = AttachmentRegistry(evozeus_home).attach(
            target=target,
            canonical_repo=canonical_repo,
            skill_name=skill_name,
            target_kind=target_kind,
            bundle=bundle,
        )
    except (ContractBundleError, OSError, ValueError) as exc:
        _fail("skill.attach", exc)
    _emit(
        {
            "ok": True,
            "stage": "skill.attach",
            **result.model_dump(mode="json"),
        }
    )


@skill_app.command("plan")
def skill_plan(
    target: Path = typer.Option(..., "--target", help="Existing Skillware/software directory."),
    canonical_repo: str = typer.Option(..., "--repo", help="Canonical OWNER/REPO identity."),
    skill_name: str = typer.Option(..., "--skill-name"),
    target_kind: Literal["skillware", "software"] = typer.Option("skillware", "--target-kind"),
    contract_pack: Path | None = typer.Option(None, "--contract-pack"),
    evozeus_home: Path = typer.Option(
        _configured_evozeus_home(),
        "--evozeus-home",
        help="EvoZeus installation and local-state root.",
    ),
) -> None:
    pack = contract_pack or _default_contract_pack(evozeus_home)
    try:
        bundle = load_contract_bundle(pack)
        plan = plan_external_attachment(
            target=target,
            canonical_repo=canonical_repo,
            skill_name=skill_name,
            target_kind=target_kind,
            bundle=bundle,
        )
    except (ContractBundleError, OSError, ValueError) as exc:
        _fail("skill.plan", exc)
    _emit(
        {
            "ok": True,
            "stage": "skill.plan",
            **plan.model_dump(mode="json"),
        }
    )


@skill_app.command("detach")
def skill_detach(
    canonical_repo: str = typer.Option(..., "--repo", help="Canonical OWNER/REPO identity."),
    evozeus_home: Path = typer.Option(
        _configured_evozeus_home(),
        "--evozeus-home",
        help="EvoZeus installation and local-state root.",
    ),
) -> None:
    try:
        result = AttachmentRegistry(evozeus_home).detach(canonical_repo)
    except (OSError, ValueError) as exc:
        _fail("skill.detach", exc)
    _emit(
        {
            "ok": True,
            "stage": "skill.detach",
            **result.model_dump(mode="json"),
        }
    )


@skill_app.command("list")
def skill_list(
    evozeus_home: Path = typer.Option(
        _configured_evozeus_home(),
        "--evozeus-home",
        help="EvoZeus installation and local-state root.",
    ),
) -> None:
    try:
        records = AttachmentRegistry(evozeus_home).list()
    except (OSError, ValueError) as exc:
        _fail("skill.list", exc)
    _emit(
        {
            "ok": True,
            "stage": "skill.list",
            "targets": [record.model_dump(mode="json") for record in records],
        }
    )


if __name__ == "__main__":
    app()
