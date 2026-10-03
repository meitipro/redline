#!/usr/bin/env python3
"""
Check that what is deployed is what is in this repository.

    python scripts/verify.py

The deployment is the submission and the repository documents it, not the
other way round. For every contract in contracts/FROZEN.json this reads the
code back off the chain with gen_getContractCode and compares it with the file,
then runs genvm-lint over the bytes that came back, because a reviewer lints
the deployed source, not the repository.

Cosmetic differences are reported as cosmetic and are not failures: pasting
through an editor rewrites line endings and eats a trailing newline, and
neither is a byte of what runs. A checker that calls those a mismatch is one
people learn to ignore. Anything else is material and fails.
"""

from __future__ import annotations

import base64
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FILES = {"redline": C.CONTRACT_FILE}


def deployed_source(chain: C.Chain, address: str) -> str:
    raw = C.retry("gen_getContractCode", chain.client.provider.make_request, "gen_getContractCode", [address])
    value = raw.get("result", raw) if isinstance(raw, dict) else raw
    if isinstance(value, dict):
        value = value.get("code") or value.get("result") or ""
    if isinstance(value, str):
        try:
            return base64.b64decode(value, validate=True).decode("utf-8")
        except Exception:  # noqa: BLE001
            return value
    if isinstance(value, (bytes, bytearray)):
        return bytes(value).decode("utf-8", "replace")
    return str(value)


def cosmetic(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n")


def linter() -> str:
    folder = pathlib.Path(sys.executable).parent
    for name in ("genvm-lint.exe", "genvm-lint"):
        if (folder / name).exists():
            return str(folder / name)
    return shutil.which("genvm-lint") or "genvm-lint"


def lint_bytes(source: str) -> tuple[bool, str]:
    """Lint the deployed bytes. The first line of `check` is the verdict; its last line can be green under a lint failure."""
    with tempfile.TemporaryDirectory() as folder:
        target = pathlib.Path(folder) / "deployed.py"
        target.write_text(source, encoding="utf-8", newline="")
        # v0.6.0-rc6 carries Studio Next's runtime, py-genlayer:5jycge4q.
        env = dict(os.environ, PYTHONIOENCODING="utf-8", GENVM_VERSION="v0.6.0-rc6")
        result = subprocess.run([linter(), "check", str(target), "--json"], capture_output=True, text=True, encoding="utf-8", env=env)
        try:
            report = json.loads(result.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            return False, (result.stdout + result.stderr).strip()[:200]
        ok = bool(report.get("ok")) and result.returncode == 0
        return ok, json.dumps(report.get("validate", report))[:200]


def main() -> int:
    entry = C.deployment()
    chain = C.Chain()
    failures = 0
    print(f"network {C.NETWORK} (chain {C.CHAIN_ID})")
    for name, path in FILES.items():
        address = entry.get(name)
        if not address:
            continue
        local = path.read_text(encoding="utf-8")
        print(f"\n{name}  {address}")
        recorded = entry.get(name + "_sha256")
        digest = C.sha256_file(path)
        print(f"  file sha256     {digest}{'  (matches FROZEN.json)' if digest == recorded else '  (FROZEN.json says ' + str(recorded) + ')'}")
        if digest != recorded:
            failures += 1
        try:
            onchain = deployed_source(chain, address)
        except Exception as error:  # noqa: BLE001
            print(f"  could not read the deployed code: {str(error)[:140]}")
            failures += 1
            continue
        if onchain == local:
            print(f"  deployed bytes  identical to {path.relative_to(C.ROOT).as_posix()} ({len(local.encode('utf-8'))} bytes)")
        elif cosmetic(onchain) == cosmetic(local):
            print("  deployed bytes  differ only in line endings or the trailing newline (cosmetic)")
        else:
            failures += 1
            print(f"  MATERIAL MISMATCH against {path.relative_to(C.ROOT).as_posix()}")
            for index, (a, b) in enumerate(zip(cosmetic(local).splitlines(), cosmetic(onchain).splitlines())):
                if a != b:
                    print(f"    first difference at line {index + 1}\n      repo:     {a[:90]}\n      on chain: {b[:90]}")
                    break
            continue
        ok, detail = lint_bytes(onchain)
        print(f"  deployed lint   {'clean' if ok else 'FAILED'} {detail}")
        if not ok:
            failures += 1
    print("\n" + ("the deployment matches this repository" if not failures else f"{failures} problem(s)"))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
