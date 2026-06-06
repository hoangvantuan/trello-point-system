from pathlib import Path

import _common


def test_creates_tool_entry(tmp_path, run):
    r = run("new-entry.py", "tool", "improve", root=tmp_path)
    assert r.returncode == 0
    path = Path(r.stdout.strip())
    assert path.name == "T-001.md"
    text = path.read_text()
    meta, _ = _common.parse_frontmatter(text)
    assert meta["type"] == "tool"
    assert meta["subtype"] == "improve"
    assert meta["status"] == "raw"
    assert "title:" in text
    assert "## Contract đề xuất" in text
    assert "## Hành động" in text


def test_tool_defaults_subtype_improve(tmp_path, run):
    r = run("new-entry.py", "tool", root=tmp_path)
    meta, _ = _common.parse_frontmatter(Path(r.stdout.strip()).read_text())
    assert meta["subtype"] == "improve"


def test_creates_map_entry(tmp_path, run):
    r = run("new-entry.py", "map", root=tmp_path)
    path = Path(r.stdout.strip())
    assert path.name == "M-001.md"
    assert "## Trình tự (bản đồ)" in path.read_text()


def test_creates_fact_entry(tmp_path, run):
    r = run("new-entry.py", "fact", root=tmp_path)
    path = Path(r.stdout.strip())
    assert path.name == "F-001.md"
    assert "## Sự kiện / quy tắc" in path.read_text()


def test_rejects_bad_type(tmp_path, run):
    r = run("new-entry.py", "bogus", root=tmp_path)
    assert r.returncode == 2


def test_appends_capture_log(tmp_path, run):
    run("new-entry.py", "map", root=tmp_path)
    log = (tmp_path / "memory" / "log.md").read_text()
    assert "capture | M-001" in log
