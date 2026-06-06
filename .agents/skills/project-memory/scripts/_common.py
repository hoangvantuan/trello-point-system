"""Helper dùng chung cho project-memory. Chỉ stdlib để portable."""
import os
import re
import subprocess
from datetime import date
from pathlib import Path

# Mapping type entry -> prefix ID. Caller (new-entry.py) dùng khi gọi next_id().
PREFIX_BY_TYPE = {"tool": "T", "map": "M", "fact": "F"}


def repo_root():
    override = os.environ.get("PROJECT_MEMORY_ROOT")
    if override:
        return Path(override)
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        )
        return Path(out.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return Path.cwd()


def memory_dir():
    return repo_root() / "memory"


def entries_dir():
    return memory_dir() / "entries"


def archive_dir():
    return memory_dir() / "archive"


def ensure_dirs():
    for d in (memory_dir(), entries_dir(), archive_dir()):
        d.mkdir(parents=True, exist_ok=True)


def parse_frontmatter(text):
    """Trả (meta dict, body). Parse YAML subset: scalar + inline list [a, b]."""
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    raw, body = parts[1], parts[2]
    meta = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, val = line.split(":", 1)
        key, val = key.strip(), val.strip()
        if val.startswith("[") and val.endswith("]"):
            meta[key] = [v.strip() for v in val[1:-1].split(",") if v.strip()]
        else:
            meta[key] = val
    return meta, body.lstrip("\n")


def next_id(prefix):
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)\.md$")
    nums = [0]
    for d in (entries_dir(), archive_dir()):
        if not d.exists():
            continue
        for f in d.iterdir():
            m = pattern.match(f.name)
            if m:
                nums.append(int(m.group(1)))
    return f"{prefix}-{max(nums) + 1:03d}"


def today():
    return date.today().isoformat()


def append_log(op, summary):
    ensure_dirs()
    line = f"## [{today()}] {op} | {summary}\n"
    with (memory_dir() / "log.md").open("a", encoding="utf-8") as fh:
        fh.write(line)
    return line.strip()
