#!/usr/bin/env python3
"""Chuyển entry sang archive/, đổi status=archived, reindex, append log."""
import sys

import _common
import reindex


def set_status(text, status):
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("status:"):
            lines[i] = f"status: {status}"
            break
    tail = "\n" if text.endswith("\n") else ""
    return "\n".join(lines) + tail


def main(argv):
    if not argv:
        print("Usage: archive.py <id>", file=sys.stderr)
        return 2
    entry_id = argv[0]
    _common.ensure_dirs()
    src = _common.entries_dir() / f"{entry_id}.md"
    if not src.exists():
        print(f"Not found: {src}", file=sys.stderr)
        return 1
    text = set_status(src.read_text(encoding="utf-8"), "archived")
    (_common.archive_dir() / f"{entry_id}.md").write_text(text, encoding="utf-8")
    src.unlink()
    _common.append_log("archive", f"{entry_id} → archive/")
    reindex.main([])
    print(str(_common.archive_dir() / f"{entry_id}.md"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
