#!/usr/bin/env python3
"""Tạo một entry skeleton với ID tăng dần. In ra path file."""
import sys

import _common

USAGE = "Usage: new-entry.py <tool|map|fact> [subtype]"

BODIES = {
    "tool": (
        "## Vấn đề / Cơ hội\n\n"
        "## Bài học gốc\n\n"
        "## Contract đề xuất (làm gì, không phải làm sao)\n\n"
        "## Hành động (khi execute)\n"
    ),
    "map": (
        "## Mục tiêu workflow\n\n"
        "## Trigger\n\n"
        "## Trình tự (bản đồ)\n\n"
        "## Cạm bẫy / lưu ý\n"
    ),
    "fact": (
        "## Sự kiện / quy tắc\n\n"
        "## Khi nào liên quan\n\n"
        "## Nguồn\n"
    ),
}


def skeleton(entry_id, etype, subtype):
    fm = [
        "---",
        f"id: {entry_id}",
        f"type: {etype}",
    ]
    if etype == "tool":
        fm.append(f"subtype: {subtype or 'improve'}")
    fm.append("title: ")
    fm.append("status: raw")
    fm.append(f"created: {_common.today()}")
    if etype == "tool":
        fm.append("source: conversation")
    fm += ["tags: []", "related: []", "---", ""]
    return "\n".join(fm) + BODIES[etype]


def main(argv):
    if not argv or argv[0] not in _common.PREFIX_BY_TYPE:
        print(USAGE, file=sys.stderr)
        return 2
    etype = argv[0]
    subtype = argv[1] if len(argv) > 1 else None
    _common.ensure_dirs()
    entry_id = _common.next_id(_common.PREFIX_BY_TYPE[etype])
    path = _common.entries_dir() / f"{entry_id}.md"
    path.write_text(skeleton(entry_id, etype, subtype), encoding="utf-8")
    _common.append_log("capture", f"{entry_id} (new {etype} entry)")
    print(str(path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
