import _common


def test_archive_moves_entry_and_sets_status(tmp_path, run):
    run("new-entry.py", "tool", "improve", root=tmp_path)
    r = run("archive.py", "T-001", root=tmp_path)
    assert r.returncode == 0
    assert not (tmp_path / "memory" / "entries" / "T-001.md").exists()
    archived = tmp_path / "memory" / "archive" / "T-001.md"
    assert archived.exists()
    meta, _ = _common.parse_frontmatter(archived.read_text())
    assert meta["status"] == "archived"


def test_archive_reindexes_with_archive_link(tmp_path, run):
    run("new-entry.py", "tool", "improve", root=tmp_path)
    run("archive.py", "T-001", root=tmp_path)
    idx = (tmp_path / "memory" / "index.md").read_text()
    assert "[↗](archive/T-001.md)" in idx


def test_archive_missing_id_returns_1(tmp_path, run):
    r = run("archive.py", "T-999", root=tmp_path)
    assert r.returncode == 1


def test_archive_logs(tmp_path, run):
    run("new-entry.py", "map", root=tmp_path)
    run("archive.py", "M-001", root=tmp_path)
    log = (tmp_path / "memory" / "log.md").read_text()
    assert "archive | M-001" in log
