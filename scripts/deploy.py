#!/usr/bin/env python3
"""
Deploy contracts/redline.py to Studio Next and record what was deployed.

    python scripts/deploy.py            # lint, validate against the live runtime, deploy, record
    python scripts/deploy.py --check    # lint and validate only, deploy nothing

Before anything is sent, the file is linted (genvm-lint, JSON verdict and exit
code, never the last line) and validated against the live runtime with
gen_getContractSchemaForCode: a contract with the wrong runtime header deploys
as ACCEPTED and creates nothing, so the only safe check is the network's own.

The deployer is the local "deployer" account in ~/.redline/accounts.json,
funded from Studio's faucet when it runs low. contracts/FROZEN.json records the
address, the deploy transaction, the sha256 of the exact bytes sent, and when;
web/lib/deployment.json is written from it for the site. scripts/verify.py later
reads the source back off the chain and compares.

A second run refuses to redeploy over a recorded address: the deployment is
frozen, and replacing it is a decision for a person, not a script.
"""

from __future__ import annotations

import datetime
import json
import os
import pathlib
import shutil
import subprocess
import sys

import eth_utils

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def linter() -> str:
    folder = pathlib.Path(sys.executable).parent
    for name in ("genvm-lint.exe", "genvm-lint"):
        if (folder / name).exists():
            return str(folder / name)
    return shutil.which("genvm-lint") or "genvm-lint"


def lint(path: pathlib.Path) -> dict:
    env = dict(os.environ, PYTHONIOENCODING="utf-8", GENVM_VERSION="v0.6.0-rc6")
    result = subprocess.run([linter(), "check", str(path), "--json"], capture_output=True, text=True, encoding="utf-8", env=env)
    try:
        report = json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise SystemExit("lint gave no JSON verdict:\n" + result.stdout + result.stderr)
    if not report.get("ok") or result.returncode != 0:
        raise SystemExit("lint failed: " + json.dumps(report))
    return report


def validate(chain: C.Chain, path: pathlib.Path) -> dict:
    code = path.read_bytes()
    raw = C.retry(
        "gen_getContractSchemaForCode",
        chain.client.provider.make_request,
        method="gen_getContractSchemaForCode",
        params=[eth_utils.hexadecimal.encode_hex(code)],
    )
    schema = raw.get("result") if isinstance(raw, dict) else None
    if not isinstance(schema, dict) or "methods" not in schema:
        raise SystemExit("the live runtime did not accept the contract: " + json.dumps(raw)[:400])
    return schema


def main() -> int:
    path = C.CONTRACT_FILE
    report = lint(path)
    print(f"lint     ok  {report['validate']['methods']} methods ({report['validate']['write_methods']} writes, {report['validate']['view_methods']} views)")
    reader = C.Chain()
    schema = validate(reader, path)
    print(f"validate ok  the live Studio Next runtime reads {len(schema['methods'])} methods")
    if "--check" in sys.argv:
        return 0

    record = C.frozen()
    entry = record.setdefault("deployments", {}).setdefault(C.NETWORK, {})
    if entry.get("redline"):
        raise SystemExit(f"already deployed at {entry["redline"]}; the deployment is frozen. Ask before replacing it.")

    deployer = C.accounts("deployer")["deployer"]
    chain = C.Chain(deployer)
    print(f"network  {C.NETWORK} (chain {C.CHAIN_ID}) via {C.RPC}")
    print(f"deployer {deployer.address}")
    chain.ensure(deployer.address, minimum_gen=50)

    digest = C.sha256_file(path)
    done = chain.deploy(path)
    entry.update(
        {
            "chain_id": C.CHAIN_ID,
            "rpc": C.RPC,
            "explorer": C.EXPLORER,
            "runtime": C.RUNTIME,
            "redline": done["address"],
            "redline_tx": done["tx"],
            "redline_sha256": digest,
            "redline_deployer": deployer.address,
            "redline_file": path.relative_to(C.ROOT).as_posix(),
            "deployed_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    )
    C.save_frozen(record)
    print(f"recorded {done['address']}  {C.EXPLORER}/tx/{done['tx']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
