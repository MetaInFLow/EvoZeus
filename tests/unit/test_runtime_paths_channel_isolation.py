from pathlib import Path

from evozeus_runtime.ledger.paths import RuntimePaths


def test_explicit_runtime_state_root_overrides_workspace(monkeypatch, tmp_path):
    channel_root = tmp_path / "home" / ".evozeus" / "state" / "uat"
    monkeypatch.setenv("EVOZEUS_RUNTIME_STATE_ROOT", str(channel_root))

    paths = RuntimePaths.for_workspace(tmp_path / "workspace").ensure()

    assert paths.state_root == channel_root.resolve()
    assert paths.result_index_db == channel_root.resolve() / "runtime" / "index" / "results.sqlite3"
    assert not (tmp_path / "workspace" / ".evozeus").exists()


def test_stable_and_uat_runtime_roots_are_disjoint(monkeypatch, tmp_path):
    roots: dict[str, Path] = {}
    for channel in ("stable", "uat"):
        root = tmp_path / ".evozeus" / "state" / channel
        monkeypatch.setenv("EVOZEUS_RUNTIME_STATE_ROOT", str(root))
        paths = RuntimePaths.for_workspace(tmp_path / "workspace").ensure()
        marker = paths.logs_dir / "channel.txt"
        marker.write_text(channel, encoding="utf-8")
        roots[channel] = paths.state_root

    assert roots["stable"] != roots["uat"]
    assert (roots["stable"] / "logs" / "channel.txt").read_text(encoding="utf-8") == "stable"
    assert (roots["uat"] / "logs" / "channel.txt").read_text(encoding="utf-8") == "uat"
