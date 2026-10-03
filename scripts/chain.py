"""
One place that talks to GenLayer Studio Next, used by every script here.

Studio Next is chain 61997, consensus v0.6 with a fee deposit on every write,
reached with genlayer-py 0.19.0rc2 (requirements.txt). An interpreter with
another SDK line is refused by name at the first line rather than failing three
calls later.

The measured rules kept from the Recourse and Keepalive plumbing:

  - Studio drops TLS handshakes in bursts, and genlayer-py posts once per RPC
    call. A session with connection-layer retries is installed under the SDK.
  - A write is retried only while it is provably unsent: the nonce is read
    before and after, and a write whose nonce moved is never sent again.
  - Every write carries a fee deposit from the SDK estimate. Redline's writes
    emit no internal messages, so a flat allocation of 600 time units per phase
    covers them. claim() and reclaim() pay the caller at the root of their own
    transaction, which needs an External allocation at the root of the fee tree.
  - A decided or accepted transaction is not a successful one: a refusal is
    decided too. Success is an accepted outcome AND a returned execution.
  - sim_fundAccount wants the amount as a decimal string, and its answer is not
    evidence either way. The balance moving is.
  - Studio allows about thirty requests a minute from one address, so waits
    poll every five seconds and everything runs in one lane.

No private key is ever written inside the repository. Accounts live in
~/.redline/accounts.json on this machine, and only addresses are printed.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import pathlib
import time
import typing

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from genlayer_py import create_account, create_client

ROOT = pathlib.Path(__file__).resolve().parent.parent
FROZEN = ROOT / "contracts" / "FROZEN.json"
WEB_DEPLOYMENT = ROOT / "web" / "lib" / "deployment.json"
KEYS = pathlib.Path(os.environ.get("REDLINE_KEYS", pathlib.Path.home() / ".redline" / "accounts.json"))
GEN = 10**18
SDK_VERSION = importlib.metadata.version("genlayer_py")

NETWORK = "studio-next"
CHAIN_ID = 61997
# studio-next.genlayer.com and studio-dev.genlayer.com are one network; the spec names the first.
RPC = os.environ.get("REDLINE_RPC", "https://studio-next.genlayer.com/api")
EXPLORER = "https://explorer-studio-dev.genlayer.com"
RUNTIME = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng"
CONTRACT_FILE = ROOT / "contracts" / "redline.py"



def _chain_object():
    try:
        from genlayer_py.chains import studio_devnet
    except ImportError:
        raise SystemExit(
            f"Studio Next needs genlayer-py 0.19.0rc2 (requirements.txt); this interpreter has genlayer-py {SDK_VERSION}."
        ) from None
    studio_devnet.rpc_urls = {"default": {"http": [RPC]}}
    return studio_devnet


CHAIN = _chain_object()

#: Consensus v0.6 fee allocation. Studio Next refuses anything outside 30 to 600 time units.
MAX_TIMEUNITS = 600
FLAT = {
    "leaderTimeunitsAllocation": MAX_TIMEUNITS,
    "validatorTimeunitsAllocation": MAX_TIMEUNITS,
    "totalMessageFees": 0,
    "rotations": [1],
}
#: judge() runs the agent and the checks, and a disagreement rotates the
#: leader, so it is allowed more rotations than a plain write.
NONDET_METHODS = {"judge"}
NONDET_ROTATIONS = [3]
#: Writes that pay their caller at the root of their own transaction.
ROOT_PAYOUTS = {"claim", "reclaim"}
EXTERNAL_BUDGET = 10**15
EXTERNAL_GAS = {"gasLimit": 100000, "maxGasPrice": 10**9}

RETRIES = 8
BACKOFF = 1.6

# --- transport ------------------------------------------------------------
_SESSION = requests.Session()
_SESSION.mount(
    "https://",
    HTTPAdapter(
        max_retries=Retry(
            total=12,
            connect=12,
            read=6,
            backoff_factor=0.7,
            backoff_max=20,
            status_forcelist=[408, 429, 500, 502, 503, 504],
            allowed_methods=frozenset(["POST", "GET"]),
            raise_on_status=False,
        ),
        pool_connections=2,
        pool_maxsize=8,
    ),
)


def _install_session() -> None:
    from genlayer_py.provider import provider as _provider

    if getattr(_provider, "_redline_session", False):
        return
    _provider.requests = _SESSION
    _SESSION.exceptions = requests.exceptions
    _provider._redline_session = True


_install_session()


# --- accounts -------------------------------------------------------------
def accounts(*names: str) -> dict:
    """Named local accounts, created on first use and kept outside the repository."""
    KEYS.parent.mkdir(parents=True, exist_ok=True)
    stored = json.loads(KEYS.read_text(encoding="utf-8")) if KEYS.exists() else {}
    made = False
    for name in names:
        if name not in stored:
            stored[name] = create_account().key.hex()
            made = True
    if made:
        KEYS.write_text(json.dumps(stored, indent=2) + "\n", encoding="utf-8")
        try:
            os.chmod(KEYS, 0o600)
        except OSError:
            pass
    return {name: create_account(account_private_key=stored[name]) for name in names}


# --- the record -----------------------------------------------------------
def frozen() -> dict:
    if not FROZEN.exists():
        return {"deployments": {}}
    return json.loads(FROZEN.read_text(encoding="utf-8"))


def deployment() -> dict:
    entry = frozen().get("deployments", {}).get(NETWORK)
    if not entry:
        raise SystemExit("contracts/FROZEN.json has no studio-next deployment. Run: python scripts/deploy.py")
    return entry


def address() -> str:
    return deployment()["redline"]


def save_frozen(record: dict) -> None:
    FROZEN.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    entry = record.get("deployments", {}).get(NETWORK, {})
    if not entry:
        return
    public = {
        "network": NETWORK,
        "chainId": CHAIN_ID,
        "rpc": "https://studio-next.genlayer.com/api",
        "explorer": EXPLORER,
        "redline": entry.get("redline", ""),
        "deployTx": entry.get("redline_tx", ""),
        "deployedAt": entry.get("deployed_at", ""),
        "sourceSha256": entry.get("redline_sha256", ""),
    }
    WEB_DEPLOYMENT.parent.mkdir(parents=True, exist_ok=True)
    WEB_DEPLOYMENT.write_text(json.dumps(public, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def sha256_file(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --- retries --------------------------------------------------------------
FATAL = ("reverted", "UserError", "[EXPECTED]", "insufficient", "execution failed")


def retry(what: str, fn, *args, **kwargs):
    """Retry a READ or a WAIT on a transient failure. Never a write."""
    last: Exception | None = None
    for attempt in range(RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as error:  # noqa: BLE001
            text = str(error)
            if any(word in text for word in FATAL):
                raise
            last = error
            if attempt == RETRIES - 1:
                break
            print(f"  retry {attempt + 1}/{RETRIES} on {what}: {text[:110]}")
            time.sleep(BACKOFF**attempt)
    raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")


def _external_node(recipient: str) -> dict:
    """One External allocation at the root of the v0.6 fee tree, for a value transfer to recipient."""
    from genlayer_py.transactions.fees import (
        MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
        MessageType,
        derive_external_message_call_key,
        encode_external_message_fee_params,
    )

    return {
        "messageType": int(MessageType.External),
        "onAcceptance": False,
        "parentIndex": MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
        "recipient": recipient,
        "callKey": derive_external_message_call_key("0x"),
        "budget": EXTERNAL_BUDGET,
        "feeParams": encode_external_message_fee_params(EXTERNAL_GAS),
    }


def _fee_options(estimate: dict) -> dict:
    options = {"distribution": estimate["distribution"], "feeValue": estimate["feeValue"]}
    if estimate.get("messageAllocations"):
        options["messageAllocations"] = estimate["messageAllocations"]
    return options


_READER = None


def _reader():
    """A throwaway account for reads. Never funded, never signs."""
    global _READER
    if _READER is None:
        _READER = create_account()
    return _READER


class Chain:
    def __init__(self, account=None) -> None:
        self.account = account
        # genlayer-py reads through an account and fails without one, so a
        # read-only Chain gets the throwaway reader. Writes still refuse to run
        # without a real account: see _guarded.
        self.client = create_client(chain=CHAIN, account=account or _reader())

    # -- accounts ----------------------------------------------------------

    def balance(self, address: str) -> int:
        try:
            return int(retry("get_balance", self.client.get_balance, address))
        except Exception:  # noqa: BLE001
            return 0

    def fund(self, address: str, wei: int) -> tuple[int, int]:
        """Studio's faucet, once, never retried; success is the balance moving."""
        before = self.balance(address)
        try:
            self.client.provider.make_request(method="sim_fundAccount", params=[address, str(int(wei))])
        except Exception as error:  # noqa: BLE001
            print(f"  sim_fundAccount answered {str(error)[:80]}, reading the balance instead")
        after = before
        for _ in range(20):
            after = self.balance(address)
            if after > before:
                break
            time.sleep(1.5)
        print(f"  {address[:10]} {before / GEN:.2f} -> {after / GEN:.2f} GEN")
        return before, after

    def ensure(self, address: str, minimum_gen: int, top_up_gen: int = 1000) -> None:
        if self.balance(address) < minimum_gen * GEN:
            self.fund(address, top_up_gen * GEN)

    # -- contracts ---------------------------------------------------------

    def deploy(self, path: pathlib.Path, args: list | None = None) -> dict:
        code = path.read_text(encoding="utf-8")
        print(f"  deploying {path.relative_to(ROOT).as_posix()} ({len(code.encode('utf-8'))} bytes) to {NETWORK}")
        call: dict = {"code": code, "args": args or []}
        call["fees"] = _fee_options(retry("deploy fee estimate", self.client.estimate_transaction_fees, dict(FLAT)))
        tx = self._guarded("deploy", lambda: self.client.deploy_contract(**call))
        receipt = self.wait(_hash(tx), "finalized", retries=200)
        outcome = check(receipt)
        if not outcome["ok"]:
            raise RuntimeError(f"deploy of {path.name} did not succeed: {outcome['detail']}")
        address = _contract_address(receipt)
        if not address:
            raise RuntimeError(f"deploy finished with no address: {str(receipt)[:300]}")
        retry("get_contract_schema", self.client.get_contract_schema, address)
        print(f"  {path.name} -> {address}")
        return {"address": address, "tx": _hash(tx)}

    def read(self, address: str, method: str, args: list | None = None):
        return retry(
            "read " + method,
            lambda: self.client.read_contract(
                address=address, function_name=method, args=args or [], account=self.account or _reader()
            ),
        )

    def read_json(self, address: str, method: str, args: list | None = None):
        return json.loads(self.read(address, method, args))

    def fees_for(self, method: str) -> dict:
        options = dict(FLAT)
        if method in NONDET_METHODS:
            options["rotations"] = list(NONDET_ROTATIONS)
        if method in ROOT_PAYOUTS and self.account is not None:
            # The SDK derives the message total from the allocations; a stated 0
            # beside a budget reverts with MessageAllocationsNotEqualBudget.
            del options["totalMessageFees"]
            options["messageAllocations"] = [_external_node(self.account.address)]
        return _fee_options(retry("fee estimate for " + method, self.client.estimate_transaction_fees, options))

    def write(self, address: str, method: str, args: list | None = None, value: int = 0) -> str:
        call: dict = {"address": address, "function_name": method, "args": args or [], "value": value}
        call["fees"] = self.fees_for(method)
        return _hash(self._guarded("write " + method, lambda: self.client.write_contract(**call)))

    def _guarded(self, what: str, attempt):
        sender = self.account.address if self.account else None
        last: Exception | None = None
        for index in range(RETRIES):
            before = self._nonce(sender)
            try:
                return attempt()
            except Exception as error:  # noqa: BLE001
                text = str(error)
                if any(word in text for word in ("reverted", "UserError", "[EXPECTED]", "insufficient")):
                    raise
                last = error
                after = self._nonce(sender)
                if sender is not None and (before is None or after is None):
                    raise RuntimeError(f"{what}: failed and the nonce could not be read, not resending: {text[:120]}") from error
                if before is not None and after is not None and after > before:
                    raise RuntimeError(f"{what}: the node took nonce {before} and the answer was lost. Not resending.") from error
                if index == RETRIES - 1:
                    break
                print(f"  retry {index + 1}/{RETRIES} on {what}: {text[:110]}")
                time.sleep(BACKOFF**index)
        raise RuntimeError(f"{what} failed after {RETRIES} attempts: {last}")

    def _nonce(self, sender) -> int | None:
        if sender is None:
            return None
        try:
            return int(retry("nonce", self.client.get_current_nonce, address=sender))
        except Exception:  # noqa: BLE001
            return None

    def wait(self, tx: str, until: str = "decided", retries: int = 120) -> dict:
        # Five seconds between polls: Studio allows about thirty requests a
        # minute from one address, and a check takes a minute or two.
        return retry(
            "wait",
            self.client.wait_for_transaction_receipt,
            transaction_hash=tx,
            wait_until=until,
            interval=5000,
            retries=retries,
            full_transaction=True,
        )

    def send(self, address: str, method: str, args: list | None = None, value: int = 0, until: str = "decided") -> dict:
        """Write, wait, and say honestly what happened. Never raises on a refusal; the caller decides."""
        tx = self.write(address, method, args, value)
        print(f"  {method} {tx}")
        try:
            receipt = self.wait(tx, until, retries=200 if method in NONDET_METHODS else 120)
        except Exception as error:  # noqa: BLE001  a round that never settles is an outcome, not a crash
            return {"ok": False, "hash": tx, "method": method, "detail": f"no decision: {str(error)[:200]}", "refusal": "", "result": None}
        outcome = check(receipt)
        outcome["hash"] = tx
        outcome["method"] = method
        return outcome


# --- reading a receipt honestly -------------------------------------------
def _hash(tx) -> str:
    if isinstance(tx, str):
        return tx
    return getattr(tx, "hex", lambda: str(tx))()


def _find_key(node, names):
    if isinstance(node, dict):
        for key, value in node.items():
            if key in names and value:
                return value
        for value in node.values():
            hit = _find_key(value, names)
            if hit:
                return hit
    elif isinstance(node, list):
        for value in node:
            hit = _find_key(value, names)
            if hit:
                return hit
    return None


def _contract_address(receipt) -> str | None:
    found = _find_key(receipt, ("contract_address", "contractAddress"))
    return found if isinstance(found, str) and found.startswith("0x") else None


def _leader(receipt: dict) -> dict:
    consensus = receipt.get("consensus_data") or {}
    rounds = consensus.get("leader_receipt") or [{}]
    if isinstance(rounds, dict):
        rounds = [rounds]
    for one in rounds:
        if str(one.get("mode", "")).lower() == "leader":
            return one
    return rounds[0] if rounds else {}


#: Consensus answers a status as a number or a name depending on the call.
STATUS_NAMES = {
    0: "UNINITIALIZED", 1: "PENDING", 2: "PROPOSING", 3: "COMMITTING", 4: "REVEALING", 5: "ACCEPTED",
    6: "UNDETERMINED", 7: "FINALIZED", 8: "CANCELED", 9: "APPEAL_REVEALING", 10: "APPEAL_COMMITTING",
    11: "READY_TO_FINALIZE", 12: "VALIDATORS_TIMEOUT", 13: "LEADER_TIMEOUT",
}


def _status(receipt: dict) -> str:
    """ACCEPTED, FINALIZED, or what went wrong, under either consensus version."""
    lifecycle = receipt.get("lifecycle")
    if isinstance(lifecycle, dict) and lifecycle.get("state"):
        state = str(lifecycle["state"]).lower()
        outcome = str(lifecycle.get("outcome") or "").lower()
        if outcome in ("", "accepted"):
            return {"decided": "ACCEPTED", "finalized": "FINALIZED"}.get(state, state.upper())
        return outcome.upper()
    raw = receipt.get("status_name") or receipt.get("statusName") or receipt.get("status", "")
    if isinstance(raw, int) or (isinstance(raw, str) and raw.isdigit()):
        return STATUS_NAMES.get(int(raw), f"STATUS_{raw}")
    return str(raw).upper()


def check(receipt) -> dict:
    """
    Accepted means the committee agreed on the receipt, not that the contract
    returned: validators can agree that a refusal is the correct result.
    Success is ACCEPTED or FINALIZED and an execution that returned.
    """
    if not isinstance(receipt, dict):
        return {"ok": False, "status": "?", "execution": "?", "detail": str(receipt)[:300], "refusal": "", "result": None}
    status = _status(receipt)
    leader = _leader(receipt)
    execution = str(
        receipt.get("txExecutionResultName")
        or receipt.get("tx_execution_result_name")
        or leader.get("execution_result", "")
    ).upper()
    result = leader.get("result") or {}
    refusal = ""
    returned: typing.Any = None
    if isinstance(result, dict):
        kind = str(result.get("status", "")).lower()
        payload = result.get("payload")
        if kind in ("rollback", "user_error"):
            refusal = payload if isinstance(payload, str) else json.dumps(payload)[:300]
        elif kind == "return":
            readable = payload.get("readable") if isinstance(payload, dict) else payload
            try:
                returned = json.loads(readable) if isinstance(readable, str) else readable
            except ValueError:
                returned = readable
    ok = status in ("ACCEPTED", "FINALIZED") and execution in ("FINISHED_WITH_RETURN", "SUCCESS", "") and not refusal
    detail = "" if ok else f"status={status} execution={execution} {refusal}".strip()
    return {
        "ok": ok,
        "status": status,
        "execution": execution,
        "refusal": refusal,
        "detail": detail,
        "result": returned,
        "receipt": receipt,
    }
