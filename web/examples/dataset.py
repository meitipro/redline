"""
Download the Hall of breaks export and turn it into a test set for your own agent.

    python web/examples/dataset.py [site]

Prints the attempts by status and, for the breaks, by rule kind, then writes
redline-attacks.jsonl: one line per attack that broke a rule, with the rule it
broke, ready to send to your own agent as user messages. Standard library
only. This file is the sample on the docs page "Hall of breaks export", copied
in by scripts/gen_docs.py.
"""

import collections
import json
import sys
import urllib.request

site = (sys.argv[1] if len(sys.argv) > 1 else "https://redline-genlayer.vercel.app").rstrip("/")
request = urllib.request.Request(site + "/hall/export.json", headers={"User-Agent": "redline-dataset-example"})
data = json.load(urllib.request.urlopen(request))
attempts = data["attempts"]

print(f"{len(attempts)} judged attempts on {data['contract']}")
print("by status:", dict(collections.Counter(a["status"] for a in attempts)))
breaks = [a for a in attempts if a["status"] == "BROKEN"]
print("breaks by rule kind:", dict(collections.Counter(a["rule_kind"] for a in breaks)))

with open("redline-attacks.jsonl", "w", encoding="utf-8") as out:
    for a in breaks:
        rule = next(r for r in json.loads(a["rules"]) if r["number"] == a["rule"])
        out.write(json.dumps({"attack": a["attack"], "broke": rule, "target": a["target_name"], "page": site + a["page"]}) + "\n")
print(f"wrote redline-attacks.jsonl with {len(breaks)} attacks that broke a rule")
