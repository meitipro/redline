#!/usr/bin/env python3
"""
Run the golden cases through the deployed Redline contract on Studio Next,
through real consensus, and publish what came out.

    python eval/run_golden.py              # golden cases 1 to 9
    python eval/run_golden.py H1 H2 H3     # the held-out cases, once
    python eval/run_golden.py --report     # rewrite results.md from results.json

eval/golden.json was written, hashed and timestamped (eval/golden.lock.json)
before the first run, and this script refuses to run if it has changed since.
Each target is posted once by the "golden_builder" account with a 5 GEN bounty,
a 1 GEN entry fee and a seven-day lock. Each attack is sent by a hunter account
that is not the builder, and judged by the hunter that sent it, so every
verdict below is the real agent run and the real rule check on the real
contract. The verdict is read back with get_attack, never from memory.

A judge whose round produced no verdict (the committee timed out or could not
agree) is recorded as such. For cases 1 to 9 it may be sent again, and every
attempt stays in the record; H1 to H3 run once and a missing agreement is their
result. A case that produced a verdict is never sent again, whatever it was.
Every step is saved before anything is printed.
"""

from __future__ import annotations

import ast
import datetime
import hashlib
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))

import chain as C  # noqa: E402

# A model's reply can carry any character; the Windows console codepage cannot.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
GOLDEN = HERE / "golden.json"
LOCK = HERE / "golden.lock.json"
RESULTS = HERE / "results.json"
REPORT = HERE / "results.md"
BUILDER = "golden_builder"
HUNTERS = ["golden_hunter_1", "golden_hunter_2"]
BOUNTY = 5 * C.GEN
FEE = 1 * C.GEN
LOCK_DAYS = 7


def judge_sha() -> str:
    tree = ast.parse(C.CONTRACT_FILE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "SCOPE_JUDGE":
            return hashlib.sha256(ast.literal_eval(node.value).encode("utf-8")).hexdigest()
    raise SystemExit("no SCOPE_JUDGE constant")


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"targets": {}, "cases": {}, "attempts": []}


def save(results: dict) -> None:
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def final(results: dict, case_id: str) -> dict | None:
    for attempt in results["attempts"]:
        if attempt["case"] == case_id and attempt.get("verdict"):
            return attempt
    return None


def must(outcome: dict, what: str) -> dict:
    if not outcome["ok"]:
        raise SystemExit(f"{what} failed: {outcome['detail']}  {C.EXPLORER}/tx/{outcome['hash']}")
    return outcome


def matches(expected: str, got: str) -> bool:
    if expected == "EITHER":
        return got in ("HELD",) or got.startswith("BROKEN:")
    return got == expected


def post(name: str, spec: dict, results: dict, address: str, builder: C.Chain) -> int:
    row = results["targets"].get(name)
    if row:
        return int(row["id"])
    before = builder.read_json(address, "list_targets", ["", 0, 1])["total"]
    args = [spec["name"], spec["instructions"], spec["mode"], json.dumps(spec["rules"]), FEE, LOCK_DAYS]
    outcome = must(builder.send(address, "create_target", args, value=BOUNTY), f"create_target {name}")
    tid = outcome["result"] if isinstance(outcome["result"], int) else None
    if not tid:
        latest = builder.read_json(address, "list_targets", ["", 0, 1])
        tid = int(latest["items"][0]["id"]) if latest["total"] > before else None
    if not tid:
        raise SystemExit(f"create_target {name} returned no target id")
    results["targets"][name] = {"id": int(tid), "tx": outcome["hash"]}
    save(results)
    print(f"  posted {name} as target {tid}  {C.EXPLORER}/tx/{outcome['hash']}")
    return int(tid)


def send_attack(case: dict, tid: int, results: dict, address: str, hunter: C.Chain, hunter_name: str) -> int:
    row = results["cases"].setdefault(case["id"], {})
    if "attack_id" in row:
        return int(row["attack_id"])
    before = hunter.read_json(address, "list_attacks", [tid, 0, 1])["total"]
    outcome = must(hunter.send(address, "attack", [tid, case["attack"]], value=FEE), f"attack for case {case['id']}")
    aid = outcome["result"] if isinstance(outcome["result"], int) else None
    if not aid:
        latest = hunter.read_json(address, "list_attacks", [tid, 0, 1])
        aid = int(latest["items"][0]["id"]) if latest["total"] > before else None
    if not aid:
        raise SystemExit(f"attack for case {case['id']} returned no attack id")
    row.update({"target_id": tid, "attack_id": int(aid), "attack_tx": outcome["hash"], "hunter": hunter_name})
    save(results)
    print(f"  attack {aid} on target {tid}  {C.EXPLORER}/tx/{outcome['hash']}")
    return int(aid)


def judge(case: dict, results: dict, address: str, hunter: C.Chain) -> None:
    cid = case["id"]
    row = results["cases"][cid]
    aid = row["attack_id"]
    tries = sum(1 for a in results["attempts"] if a["case"] == cid)
    attempt = {
        "case": cid,
        "attempt": tries + 1,
        "held_out": bool(case.get("held_out")),
        "target_id": row["target_id"],
        "attack_id": aid,
        "expected": case["expected"],
        "sent_at": now_iso(),
    }
    current = C.retry("get_attack", hunter.read_json, address, "get_attack", [aid])
    if current["status"] == "REJECTED":
        # Refused by the exact checks inside attack(): no judge is sent, and the
        # attack transaction is the evidence.
        attempt.update({"tx": row["attack_tx"], "consensus": "rejected before judging"})
    else:
        outcome = hunter.send(address, "judge", [aid])
        attempt.update({"tx": outcome["hash"], "consensus": "decided" if outcome["ok"] else outcome["detail"]})
        current = C.retry("get_attack", hunter.read_json, address, "get_attack", [aid])
    if current["status"] != "QUEUED":
        attempt.update(
            {
                "verdict": current["verdict"],
                "status": current["status"],
                "rule": current["rule"],
                "reply": current["reply"],
                "reason": current["reason"],
            }
        )
    # Saved before anything is printed: a result that exists on chain must
    # never be lost to a failure on this side of the wire.
    results["attempts"].append(attempt)
    save(results)
    if attempt.get("verdict"):
        print(f"  {'MATCH' if matches(case['expected'], attempt['verdict']) else 'MISS '} {attempt['verdict']}  {attempt['reason']}")
    else:
        print(f"  no verdict: {attempt['consensus']}")
    print(f"  {C.EXPLORER}/tx/{attempt['tx']}")


def run(ids: list[str]) -> None:
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    if C.sha256_file(GOLDEN) != lock["sha256"]:
        raise SystemExit("eval/golden.json changed after it was locked; the golden set is not edited after the first run")
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    address = C.address()
    people = C.accounts(BUILDER, *HUNTERS)
    builder = C.Chain(people[BUILDER])
    hunters = {name: C.Chain(people[name]) for name in HUNTERS}
    results = load_results()
    results.update(
        {
            "contract": address,
            "contract_sha256": C.deployment().get("redline_sha256"),
            "golden_sha256": lock["sha256"],
            "golden_locked_at": lock["locked_at"],
            "scope_judge_sha256": judge_sha(),
            "network": C.NETWORK,
            "explorer": C.EXPLORER,
            "builder": people[BUILDER].address,
            "hunters": [people[name].address for name in HUNTERS],
        }
    )
    save(results)
    wanted = ids or [c["id"] for c in golden["cases"] if not c.get("held_out")]
    cases = [c for c in golden["cases"] if c["id"] in wanted]
    held_out_done = {c["id"] for c in cases if c.get("held_out") and any(a["case"] == c["id"] for a in results["attempts"])}
    cases = [c for c in cases if not final(results, c["id"]) and c["id"] not in held_out_done]
    if not cases:
        print("nothing to run")
        report()
        return
    builder.ensure(people[BUILDER].address, minimum_gen=80)
    for name in HUNTERS:
        hunters[name].ensure(people[name].address, minimum_gen=40)
    # Every attack is queued first, so case 9 is queued while its target is still open.
    for index, case in enumerate(cases):
        spec = golden["targets"][case["target"]]
        print(f"\n{case['id']} {spec['name']} (expected {case['expected']})")
        tid = post(case["target"], spec, results, address, builder)
        name = HUNTERS[1] if case.get("after") else HUNTERS[0]
        send_attack(case, tid, results, address, hunters[name], name)
    # Then judged in order, case 9 after the case it follows.
    order = sorted(cases, key=lambda c: 1 if c.get("after") else 0)
    for case in order:
        print(f"\n{case['id']} judge")
        judge(case, results, address, hunters[results["cases"][case["id"]]["hunter"]])
    report()


def report() -> None:
    results = load_results()
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    finals = {c["id"]: final(results, c["id"]) for c in golden["cases"]}

    def score(held: bool) -> tuple[int, int]:
        rows = [(c, finals[c["id"]]) for c in golden["cases"] if bool(c.get("held_out")) == held and finals[c["id"]]]
        return sum(1 for c, a in rows if matches(c["expected"], a["verdict"])), len(rows)

    g_hit, g_n = score(False)
    h_hit, h_n = score(True)
    explorer = results.get("explorer", C.EXPLORER)
    contract = results.get("contract", "")
    lines = [
        "# Golden cases, through real consensus",
        "",
        f"Contract [`{contract}`]({explorer}/address/{contract}) on Studio Next (chain 61997). Every row is one attack "
        "on a target posted to the deployed contract: a hunter account sent it with the entry fee, and one `judge` "
        "transaction had every validator run the agent on its own model and check the rules. The verdict is read back "
        "from the contract with `get_attack`, not from the script's memory.",
        "",
        f"- Golden cases 1 to 9: **{g_hit} of {g_n}** matched.",
        f"- Held-out cases: **{h_hit} of {h_n}** reached a verdict (they have no expected answer; any agreed verdict counts, and no agreement is reported as it came).",
        f"- `eval/golden.json` sha256 `{results.get('golden_sha256', '')}`, locked at {results.get('golden_locked_at', '')}, before the first run.",
        f"- Scope judge prompt sha256 `{results.get('scope_judge_sha256', '')}`, the spec's prompt word for word.",
        "",
        "Nothing here was tuned. No case was edited after the lock.",
        "",
        "| Case | Target | Attack | Expected | Got | Why (the leader's run, display only) | Transaction |",
        "|---|---|---|---|---|---|---|",
    ]
    for case in golden["cases"]:
        cid = case["id"]
        spec = golden["targets"][case["target"]]
        a = finals[cid]
        tag = f"{cid}{' (held out)' if case.get('held_out') else ''}"
        attack = case["attack"] if len(case["attack"]) <= 90 else case["attack"][:87] + "..."
        attack = attack.replace("|", "/")
        if not a:
            tried = [x for x in results["attempts"] if x["case"] == cid]
            got = "no agreement" if tried else "not run yet"
            tx = tried[-1]["tx"] if tried else ""
            link = f"[{tx[:10]}…]({explorer}/tx/{tx})" if tx else ""
            lines.append(f"| {tag} | {spec['name']} | {attack} | {case['expected']} | {got} | | {link} |")
            continue
        mark = "✓" if matches(case["expected"], a["verdict"]) else "✗ miss"
        reason = (a.get("reason") or "").replace("|", "/")
        lines.append(f"| {tag} | {spec['name']} | {attack} | {case['expected']} | {a['verdict']} {mark} | {reason} | [{a['tx'][:10]}…]({explorer}/tx/{a['tx']}) |")
    lines += ["", "## The leader's replies", "", "Cut to 400 characters by the contract; the canary, when it appeared, is stored as `{CANARY}`.", ""]
    for case in golden["cases"]:
        a = finals[case["id"]]
        if a and a.get("reply"):
            lines.append(f"- **{case['id']}**: `{' '.join(a['reply'].split())[:400].replace('`', "'")}`")
    others = [a for a in results["attempts"] if not a.get("verdict")]
    lines += ["", "## Every attempt", ""]
    if others:
        lines.append("Judge transactions whose round produced no verdict:")
        lines.append("")
        for a in others:
            lines.append(f"- case {a['case']} attempt {a['attempt']}: {a['consensus'][:160]} ([tx]({explorer}/tx/{a['tx']}))")
    else:
        lines.append("Every judge produced a verdict on its first attempt; nothing was sent twice.")
    lines += ["", "## The targets", ""]
    for name, row in results.get("targets", {}).items():
        lines.append(f"- {golden['targets'][name]['name']}: target {row['id']}, posted in [{row['tx'][:10]}…]({explorer}/tx/{row['tx']})")
    lines.append("")
    REPORT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"\nwrote {REPORT.relative_to(C.ROOT).as_posix()}: golden {g_hit}/{g_n}, held out {h_hit}/{h_n}")


if __name__ == "__main__":
    if "--report" in sys.argv:
        report()
    else:
        run([a for a in sys.argv[1:] if not a.startswith("--")])
