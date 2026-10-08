#!/usr/bin/env python3
"""Count the characters of every field in submission/portal.md, exactly as it will be pasted."""

import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
LIMITS = {"description": 1000, "steward": 500, "proof": 500}

text = (pathlib.Path(__file__).parent / "portal.md").read_text(encoding="utf-8")
failed = False
for name, body in re.findall(r"<!-- ([\w -]+?) -->\n(.*?)\n<!-- end -->", text, flags=re.S):
    body = body.strip()
    if name.startswith("step"):
        title, _, instruction = body.partition(" — ")
        print(f"{name:12} title {len(title.strip('*')):3}  instruction {len(instruction):4}")
        continue
    limit = LIMITS.get(name)
    ok = limit is None or len(body) <= limit
    failed |= not ok
    print(f"{name:12} {len(body):4}" + (f" / {limit} {'ok' if ok else 'OVER'}" if limit else ""))
sys.exit(1 if failed else 0)
