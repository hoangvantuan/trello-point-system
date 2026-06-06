def test_reindex_lists_all_types(tmp_path, run):
    run("new-entry.py", "tool", "improve", root=tmp_path)
    run("new-entry.py", "map", root=tmp_path)
    run("new-entry.py", "fact", root=tmp_path)
    r = run("reindex.py", root=tmp_path)
    assert r.returncode == 0
    idx = (tmp_path / "memory" / "index.md").read_text()
    assert "## 🔧 Tools" in idx
    assert "## 🗺️ Maps" in idx
    assert "## 📌 Facts" in idx
    assert "T-001" in idx and "M-001" in idx and "F-001" in idx


def test_reindex_links_to_entry_file(tmp_path, run):
    run("new-entry.py", "tool", "improve", root=tmp_path)
    run("reindex.py", root=tmp_path)
    idx = (tmp_path / "memory" / "index.md").read_text()
    assert "[↗](entries/T-001.md)" in idx


def test_reindex_reads_title(tmp_path, run):
    run("new-entry.py", "fact", root=tmp_path)
    f = tmp_path / "memory" / "entries" / "F-001.md"
    f.write_text(f.read_text().replace("title: ", "title: gws CLI quirk"))
    run("reindex.py", root=tmp_path)
    idx = (tmp_path / "memory" / "index.md").read_text()
    assert "gws CLI quirk" in idx


def test_reindex_shows_subtype_for_tool(tmp_path, run):
    run("new-entry.py", "tool", "new", root=tmp_path)
    run("reindex.py", root=tmp_path)
    idx = (tmp_path / "memory" / "index.md").read_text()
    # Cột "Loại" của Tools hiển thị subtype
    assert "| new |" in idx
