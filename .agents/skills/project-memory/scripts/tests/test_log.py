def test_log_appends_line(tmp_path, run):
    r = run("log.py", "consolidate", "merged T-003 + T-007", root=tmp_path)
    assert r.returncode == 0
    log = (tmp_path / "memory" / "log.md").read_text()
    assert "consolidate | merged T-003 + T-007" in log


def test_log_joins_multiword_summary(tmp_path, run):
    r = run("log.py", "execute", "T-001", "đã", "cải", "tiến", root=tmp_path)
    assert r.returncode == 0
    log = (tmp_path / "memory" / "log.md").read_text()
    assert "execute | T-001 đã cải tiến" in log


def test_log_requires_op_and_summary(tmp_path, run):
    r = run("log.py", "only-op", root=tmp_path)
    assert r.returncode == 2
