#!/usr/bin/env python3
"""Dựng lại memory/index.md từ frontmatter mọi entry. Đừng sửa index tay."""
import sys

import _common


def collect():
    rows = {"tool": [], "map": [], "fact": []}
    for d in (_common.entries_dir(), _common.archive_dir()):
        if not d.exists():
            continue
        for f in sorted(d.glob("*.md")):
            meta, _ = _common.parse_frontmatter(f.read_text(encoding="utf-8"))
            etype = meta.get("type")
            if etype not in rows:
                continue
            meta["_file"] = f
            rows[etype].append(meta)
    for k in rows:
        rows[k].sort(key=lambda m: m.get("id", ""))
    return rows


def rel(path):
    return path.relative_to(_common.memory_dir()).as_posix()


def fmt_tags(meta):
    tags = meta.get("tags", [])
    return ", ".join(tags) if isinstance(tags, list) else str(tags)


def link(meta):
    return f"[↗]({rel(meta['_file'])})"


def render(rows):
    out = ["# Memory Index", ""]
    out += ["## 🔧 Tools (skill cải tiến + skill mới)",
            "| ID | Tiêu đề | Loại | Status | Tags | File |",
            "|----|---------|------|--------|------|------|"]
    for m in rows["tool"]:
        out.append(f"| {m.get('id','')} | {m.get('title','')} | {m.get('subtype','')} "
                   f"| {m.get('status','')} | {fmt_tags(m)} | {link(m)} |")
    out += ["", "## 🗺️ Maps (workflow lặp lại)",
            "| ID | Tiêu đề | Status | Tags | File |",
            "|----|---------|--------|------|------|"]
    for m in rows["map"]:
        out.append(f"| {m.get('id','')} | {m.get('title','')} "
                   f"| {m.get('status','')} | {fmt_tags(m)} | {link(m)} |")
    out += ["", "## 📌 Facts (context rời rạc)",
            "| ID | Tiêu đề | Status | Tags | File |",
            "|----|---------|--------|------|------|"]
    for m in rows["fact"]:
        out.append(f"| {m.get('id','')} | {m.get('title','')} "
                   f"| {m.get('status','')} | {fmt_tags(m)} | {link(m)} |")
    out.append("")
    return "\n".join(out)


def main(argv):
    _common.ensure_dirs()
    path = _common.memory_dir() / "index.md"
    path.write_text(render(collect()), encoding="utf-8")
    print(str(path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
