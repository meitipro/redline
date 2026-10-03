"""
Read a target and its attempt record from Python, with genlayer-py 0.19.0rc2.

    python web/examples/read_target.py <target id>

genlayer-py reads through an account even for views, so a throwaway one is
made here; it is never funded and never signs. This file is the Python sample
on the docs page "Quickstart: send your first attack", copied in by
scripts/gen_docs.py.
"""

import json
import sys

from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet

REDLINE = "0xeE63477515314322496640f3fB06021a24D0d66d"
studio_devnet.rpc_urls = {"default": {"http": ["https://studio-next.genlayer.com/api"]}}

reader = create_account()
client = create_client(chain=studio_devnet, account=reader)
target_id = int(sys.argv[1] if len(sys.argv) > 1 else 1)
target = json.loads(client.read_contract(address=REDLINE, function_name="get_target", args=[target_id], account=reader))
if not target["found"]:
    raise SystemExit("no such target")
page = json.loads(client.read_contract(address=REDLINE, function_name="list_attacks", args=[target_id, 0, 10], account=reader))
print(json.dumps({"name": target["name"], "status": target["status"], "bounty_wei": target["bounty"], "attempts": [a["verdict"] or a["status"] for a in page["items"]]}))
