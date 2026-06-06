#!/usr/bin/env python3
"""Append một dòng timeline vào memory/log.md."""
import sys

import _common


def main(argv):
    if len(argv) < 2:
        print("Usage: log.py <op> <summary>", file=sys.stderr)
        return 2
    op = argv[0]
    summary = " ".join(argv[1:])
    print(_common.append_log(op, summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
