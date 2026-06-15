from evozeus.workspace import create_workspace, detect_workspace


def test_detect_workspace_returns_none_when_missing(tmp_path):
    assert detect_workspace(tmp_path) is None


def test_create_workspace_creates_expected_directories(tmp_path):
    workspace = create_workspace(tmp_path)

    assert workspace.root.exists()
    assert workspace.sessions_dir.exists()
    assert (workspace.drafts_dir / "rule-proposals").exists()
    assert (workspace.drafts_dir / "skill-proposals").exists()
    assert (workspace.factors_dir / "installed").exists()
    assert workspace.history_dir.exists()
    assert '"manual-session-review"' in (workspace.root / "config.json").read_text(encoding="utf-8")
