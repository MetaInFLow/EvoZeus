import json
from pathlib import Path

from typer.testing import CliRunner

from evozeus_runtime.cli.coevolve import app
from evozeus_runtime.coevolve.attachment.plan import target_tree_sha256


COEVOLVE_BUNDLE = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "coevolve_contracts"
    / "v1"
)


def invoke_json(arguments: list[str]) -> tuple[int, dict[str, object]]:
    result = CliRunner().invoke(app, arguments)
    assert result.stdout.strip(), result.exception
    return result.exit_code, json.loads(result.stdout)


def test_contract_install_and_external_sidecar_cli_flow(tmp_path: Path) -> None:
    home = tmp_path / ".evozeus"
    target = tmp_path / "existing-skill"
    target.mkdir()
    (target / "SKILL.md").write_text("# Untouched\n", encoding="utf-8")
    before = target_tree_sha256(target)

    code, installed = invoke_json(
        [
            "contracts",
            "install",
            "--source",
            str(COEVOLVE_BUNDLE),
            "--evozeus-home",
            str(home),
        ]
    )
    assert code == 0
    assert installed["status"] == "installed"
    assert installed["target_writes"] is False

    code, plan = invoke_json(
        [
            "skill",
            "plan",
            "--target",
            str(target),
            "--repo",
            "MetaInFLow/existing-skill",
            "--skill-name",
            "existing-skill",
            "--evozeus-home",
            str(home),
        ]
    )
    assert code == 0
    assert plan["target_writes"] is False
    assert plan["target_tree_sha256"] == before

    code, attached = invoke_json(
        [
            "skill",
            "attach",
            "--target",
            str(target),
            "--repo",
            "MetaInFLow/existing-skill",
            "--skill-name",
            "existing-skill",
            "--evozeus-home",
            str(home),
        ]
    )
    assert code == 0
    assert attached["status"] == "attached"
    assert attached["target_writes"] is False
    assert target_tree_sha256(target) == before

    code, listed = invoke_json(["skill", "list", "--evozeus-home", str(home)])
    assert code == 0
    assert len(listed["targets"]) == 1

    code, detached = invoke_json(
        [
            "skill",
            "detach",
            "--repo",
            "MetaInFLow/existing-skill",
            "--evozeus-home",
            str(home),
        ]
    )
    assert code == 0
    assert detached["status"] == "detached"
    assert target_tree_sha256(target) == before


def test_contract_install_rejects_non_symlink_current_without_damaging_it(tmp_path: Path) -> None:
    home = tmp_path / ".evozeus"
    current = home / "packs" / "coevolve" / "current"
    current.mkdir(parents=True)
    sentinel = current / "sentinel.txt"
    sentinel.write_text("preserve\n", encoding="utf-8")

    code, result = invoke_json(
        [
            "contracts",
            "install",
            "--source",
            str(COEVOLVE_BUNDLE),
            "--evozeus-home",
            str(home),
        ]
    )

    assert code == 2
    assert result["ok"] is False
    assert "non-symlink" in str(result["error"])
    assert sentinel.read_text(encoding="utf-8") == "preserve\n"
    assert not (home / "packs" / "coevolve" / "v1.0.0").exists()
