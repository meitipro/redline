#!/usr/bin/env python3
"""
Confirm on the live runtime what a write can read from gl.message.raw.

    python scripts/probe_seed.py

Deploys contracts/probe/seed_probe.py, sends two writes from two accounts, and
writes what the contract stored to docs/seed-probe.json. The canary seed in
contracts/redline.py (run_seed) uses only fields this probe found.
"""

from __future__ import annotations

import json
import sys

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = C.ROOT / "docs" / "seed-probe.json"


def main() -> int:
    people = C.accounts("deployer", "probe-b")
    deployer = C.Chain(people["deployer"])
    deployer.ensure(people["deployer"].address, minimum_gen=50)
    deployer.ensure(people["probe-b"].address, minimum_gen=20)
    done = deployer.deploy(C.ROOT / "contracts" / "probe" / "seed_probe.py")
    record = {"network": C.NETWORK, "probe": done["address"], "deploy_tx": done["tx"], "writes": []}
    OUT.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="\n")
    for n, name in enumerate(["deployer", "probe-b"], 1):
        out = C.Chain(people[name]).send(done["address"], "touch", [n])
        record["writes"].append({"n": n, "tx": out["hash"], "ok": out["ok"], "returned": out["result"], "detail": out["detail"]})
        OUT.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"  touch {n}: ok={out['ok']} returned={out['result']}")
    seen = deployer.read(done["address"], "get_seen")
    record["stored"] = [json.loads(line) for line in str(seen).splitlines() if line.strip()]
    OUT.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(record["stored"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
