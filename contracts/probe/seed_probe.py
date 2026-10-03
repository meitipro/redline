# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""
Seed probe for Redline. Stores what gl.message.raw carries in a write, so the
canary seed is built on fields measured on the live runtime, not assumed.
Deployed once by scripts/probe_seed.py; its results are docs/seed-probe.json.
"""

import json

from genlayer import *
import genlayer as gl


class SeedProbe(gl.contract.Contract):
    seen: str

    def __init__(self):
        self.seen = ""

    @gl.public.write
    def touch(self, n: int) -> str:
        raw = gl.message.raw
        row = {
            "n": int(n),
            "keys": sorted(str(k) for k in raw.keys()),
            "datetime": str(raw.get("datetime", "")),
            "sender": gl.message.sender_address.as_hex,
            "contract": gl.message.contract_address.as_hex,
            "entry_kind": str(raw.get("entry_kind", "")),
        }
        self.seen = self.seen + json.dumps(row, sort_keys=True) + "\n"
        return row["datetime"]

    @gl.public.view
    def get_seen(self) -> str:
        return self.seen
