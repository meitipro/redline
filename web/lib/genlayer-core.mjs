/**
 * The one write path, shared by the site (lib/write.ts, in the visitor's
 * wallet) and by scripts/send-as.mjs (a stand-in wallet for a test account).
 * The TypeScript twin of scripts/chain.py, for Studio Next (chain 61997).
 *
 * Plain JavaScript on purpose, so a Node script can import the exact code the
 * browser runs instead of a copy of it.
 *
 *   - Every write carries a fee deposit from the SDK's own estimate: a flat
 *     600 time units per phase, one rotation for a plain write and three for
 *     judge(), whose agent run may need a second committee.
 *   - claim() and reclaim() pay the caller at the root of their own
 *     transaction, so their fee tree carries one External allocation for the
 *     caller.
 *   - Accepted is not success. Validators can agree that a refusal is the
 *     right result. Success is an accepted status AND a leader execution that
 *     returned; anything else carries the contract's own sentence.
 */

import {
  MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
  MessageType,
  createClient,
  deriveExternalMessageCallKey,
  encodeExternalMessageFeeParams,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

import deployment from "./deployment.json" with { type: "json" };

export const DEPLOYMENT = deployment;
/** @type {`0x${string}`} */
export const CONTRACT = /** @type {`0x${string}`} */ (deployment.redline);
export const EXPLORER = deployment.explorer;
export const RPC = deployment.rpc;
export const CHAIN_ID = deployment.chainId;
export const CHAIN_HEX = `0x${deployment.chainId.toString(16)}`;

/** Studio Next. studio-next.genlayer.com and studio-dev.genlayer.com are one network; the spec names the first. */
export function chainFor(rpc = RPC) {
  return { ...studioDevnet, id: CHAIN_ID, rpcUrls: { default: { http: [rpc] } } };
}

export const MAX_TIMEUNITS = 600;
/** judge() runs the agent and the checks; a disagreement rotates the leader, so it may use more rotations. */
export const NONDET = new Set(["judge"]);
/** Writes that pay their caller at the root of their own transaction. */
export const ROOT_PAYOUTS = new Set(["claim", "reclaim"]);
const EXTERNAL_BUDGET = 10n ** 15n;

export function transient(error) {
  return /fetch failed|ECONNRESET|socket|network|timed out|timeout|Server busy|-32029|rate limit|429|502|503|504/i.test(
    String(error?.message ?? error),
  );
}

export async function retried(fn, attempts = 5) {
  let wait = 1500;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= attempts || !transient(error)) throw error;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 12000);
    }
  }
}

/** A client that signs through `provider` (an EIP-1193 wallet) as `address`. */
export function walletClient(address, provider, rpc = RPC) {
  return createClient({ chain: chainFor(rpc), account: address, provider });
}

/** A client for reads only. */
export function readClient(rpc = RPC) {
  return createClient({ chain: chainFor(rpc) });
}

/** The fee deposit for one write, from the SDK estimate. */
export async function feesFor(client, method, sender) {
  const options = {
    leaderTimeunitsAllocation: MAX_TIMEUNITS,
    validatorTimeunitsAllocation: MAX_TIMEUNITS,
    totalMessageFees: 0,
    rotations: [NONDET.has(method) ? 3 : 1],
  };
  if (ROOT_PAYOUTS.has(method)) {
    // The SDK derives the message total from the allocations; a stated 0
    // beside a budget reverts with MessageAllocationsNotEqualBudget.
    delete options.totalMessageFees;
    options.messageAllocations = [
      {
        messageType: MessageType.External,
        onAcceptance: false,
        parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
        recipient: sender,
        callKey: deriveExternalMessageCallKey("0x"),
        budget: EXTERNAL_BUDGET,
        feeParams: encodeExternalMessageFeeParams({ gasLimit: 100000n, maxGasPrice: 10n ** 9n }),
      },
    ];
  }
  const estimate = await retried(() => client.estimateTransactionFees(options));
  const fees = { distribution: estimate.distribution, feeValue: estimate.feeValue };
  if (estimate.messageAllocations?.length) fees.messageAllocations = estimate.messageAllocations;
  return fees;
}

/**
 * Send one write; returns the transaction hash. Never retried once the wallet has signed.
 * @param {any} client
 * @param {{ method: string, args?: any[], value?: bigint, sender: string }} call
 * @returns {Promise<string>}
 */
export async function submit(client, { method, args = [], value = 0n, sender }) {
  const fees = await feesFor(client, method, sender);
  return client.writeContract({ address: CONTRACT, functionName: method, args, value: BigInt(value), fees });
}

/** Wait until validators decide. judge() takes a minute or two. */
export async function waitDecided(client, hash, method) {
  return retried(
    () =>
      client.waitForTransactionReceipt({
        hash,
        waitUntil: "decided",
        interval: 4000,
        retries: NONDET.has(method) ? 120 : 60,
      }),
    4,
  );
}

/** Wait until the transaction is final: value transfers settle here, not at ACCEPTED. */
export async function waitFinal(client, hash) {
  return retried(() => client.waitForTransactionReceipt({ hash, waitUntil: "finalized", interval: 5000, retries: 120 }), 4);
}

function leaderOf(receipt) {
  const rounds = receipt?.consensus_data?.leader_receipt;
  if (Array.isArray(rounds)) return rounds.find((r) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0];
  return rounds;
}

export function statusOf(receipt) {
  const life = receipt?.lifecycle;
  if (life && typeof life === "object" && life.state) {
    const outcome = String(life.outcome ?? "").toLowerCase();
    if (outcome === "" || outcome === "accepted") {
      return { decided: "ACCEPTED", finalized: "FINALIZED" }[String(life.state).toLowerCase()] ?? String(life.state).toUpperCase();
    }
    return outcome.toUpperCase();
  }
  const name = receipt?.status_name ?? receipt?.statusName;
  if (typeof name === "string" && name) return name.toUpperCase();
  const code = Number(receipt?.status);
  return code === 5 ? "ACCEPTED" : code === 7 ? "FINALIZED" : String(receipt?.status ?? "").toUpperCase();
}

/**
 * The success test, identical to scripts/chain.py check(): an accepted
 * status, a leader execution that finished, and a result that returned.
 */
export function outcomeOf(receipt) {
  const status = statusOf(receipt);
  const leader = leaderOf(receipt) ?? {};
  const execution = String(leader.execution_result ?? receipt?.txExecutionResultName ?? "").toUpperCase();
  const result = leader.result ?? {};
  const kind = String(result.status ?? "").toLowerCase();
  let refusal = "";
  let returned;
  if (kind === "return") {
    const readable = result.payload?.readable ?? result.payload;
    try {
      returned = typeof readable === "string" ? JSON.parse(readable) : readable;
    } catch {
      returned = readable;
    }
  } else if (result.payload !== undefined) {
    const payload = result.payload;
    refusal = typeof payload === "string" ? payload : String(payload?.readable ?? JSON.stringify(payload));
    refusal = refusal.replace(/^"|"$/g, "").replace(/^\[(EXPECTED|LLM_ERROR)\]\s*/, "");
  }
  const ok = (status === "ACCEPTED" || status === "FINALIZED") && (execution === "SUCCESS" || execution === "FINISHED_WITH_RETURN") && kind === "return";
  return { ok, status, execution, kind, refusal, returned };
}

/** One sentence for a failed write, for people. */
export function explain(error) {
  const text = String(error?.shortMessage ?? error?.message ?? error);
  if (/user rejected|denied transaction|rejected the request|4001/i.test(text)) return "You declined the signature in your wallet.";
  if (/-32029|rate limit/i.test(text)) return "Studio Next is rate limiting this address. Wait a minute and try again.";
  if (/insufficient/i.test(text)) return "Not enough GEN for this transaction and its fee. Use the faucet, then try again.";
  if (/no_wallet/.test(text)) return "No wallet found in this browser.";
  return text.length > 220 ? text.slice(0, 220) + "…" : text;
}
