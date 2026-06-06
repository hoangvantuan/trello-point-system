import _common


def test_next_id_starts_at_001(tmp_path, monkeypatch):
    monkeypatch.setenv("PROJECT_MEMORY_ROOT", str(tmp_path))
    _common.ensure_dirs()
    assert _common.next_id("T") == "T-001"


def test_next_id_increments_to_max_plus_one(tmp_path, monkeypatch):
    monkeypatch.setenv("PROJECT_MEMORY_ROOT", str(tmp_path))
    _common.ensure_dirs()
    (_common.entries_dir() / "T-001.md").write_text("x")
    (_common.entries_dir() / "T-004.md").write_text("x")
    assert _common.next_id("T") == "T-005"


def test_next_id_is_per_prefix(tmp_path, monkeypatch):
    monkeypatch.setenv("PROJECT_MEMORY_ROOT", str(tmp_path))
    _common.ensure_dirs()
    (_common.entries_dir() / "T-009.md").write_text("x")
    assert _common.next_id("M") == "M-001"


def test_next_id_counts_archive_too(tmp_path, monkeypatch):
    monkeypatch.setenv("PROJECT_MEMORY_ROOT", str(tmp_path))
    _common.ensure_dirs()
    (_common.archive_dir() / "F-002.md").write_text("x")
    assert _common.next_id("F") == "F-003"


def test_parse_frontmatter_scalar_and_list():
    text = "---\nid: T-001\ntitle: hello world\ntags: [a, b]\nrelated: []\n---\n\n## Body\nx\n"
    meta, body = _common.parse_frontmatter(text)
    assert meta["id"] == "T-001"
    assert meta["title"] == "hello world"
    assert meta["tags"] == ["a", "b"]
    assert meta["related"] == []
    assert body.startswith("## Body")


def test_parse_frontmatter_no_frontmatter():
    meta, body = _common.parse_frontmatter("just text\n")
    assert meta == {}
    assert body == "just text\n"


def test_append_log_writes_line(tmp_path, monkeypatch):
    monkeypatch.setenv("PROJECT_MEMORY_ROOT", str(tmp_path))
    line = _common.append_log("capture", "T-001 hello")
    log = (tmp_path / "memory" / "log.md").read_text()
    assert "capture | T-001 hello" in log
    assert line.startswith("## [")
