import { abi } from 'genlayer-js';
import { unstable_cache } from 'next/cache';

import { CONTRACT, EXPLORER } from './genlayer-core.mjs';

/**
 * The transactions behind each target and attack, read from the Studio Next
 * explorer's API. The contract cannot know its own transaction hashes, so a
 * page finds them here: the create_target whose returned id is the target, the
 * attack whose returned id is the attack, judge by its attack id, and top_up,
 * claim and reclaim by their target id.
 *
 * Only decided, successful transactions count. A refused claim is on the
 * explorer too, and it paid nothing.
 */

export type ChainTx = { method: string; hash: string; from: string; created: string };
export type TxIndex = { targets: Record<string, ChainTx[]>; attacks: Record<string, ChainTx[]> };

/* eslint-disable @typescript-eslint/no-explicit-any */

function decode(b64: string): { method: string; args: unknown[] } | null {
  try {
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
    const out = abi.calldata.decode(bytes) as any;
    if (!(out instanceof Map)) return null;
    return { method: String(out.get('') ?? ''), args: (out.get('args') as unknown[]) ?? [] };
  } catch {
    return null;
  }
}

function leaderOf(tx: any): any {
  const rounds = tx?.consensus_data?.leader_receipt;
  if (Array.isArray(rounds)) return rounds.find((r: any) => String(r?.mode ?? '').toLowerCase() === 'leader') ?? rounds[0];
  return rounds;
}

/**
 * The explorer stores the leader's result as base64: one status byte (0 means
 * the method returned) and then the returned value, calldata-encoded. The
 * node's own receipts carry it decoded instead, so both shapes are read.
 */
function succeeded(tx: any): { ok: boolean; returned?: string } {
  const status = String(tx?.status ?? '').toUpperCase();
  if (status !== 'ACCEPTED' && status !== 'FINALIZED') return { ok: false };
  const leader = leaderOf(tx);
  if (String(leader?.execution_result ?? '').toUpperCase() !== 'SUCCESS') return { ok: false };
  const result = leader?.result;
  if (typeof result === 'string') {
    try {
      const bytes = Uint8Array.from(Buffer.from(result, 'base64'));
      if (bytes[0] !== 0) return { ok: false };
      const value = abi.calldata.decode(bytes.subarray(1)) as unknown;
      return { ok: true, returned: typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string' ? String(value) : undefined };
    } catch {
      return { ok: false };
    }
  }
  const ok = String(result?.status ?? '').toLowerCase() === 'return';
  const readable = result?.payload?.readable ?? result?.payload;
  return { ok, returned: typeof readable === 'string' ? readable : undefined };
}

const BY_TARGET = new Set(['top_up', 'claim', 'reclaim']);

async function scan(): Promise<TxIndex> {
  const index: TxIndex = { targets: {}, attacks: {} };
  for (let page = 1; page <= 30; page++) {
    const url = `${EXPLORER}/api/transactions?address=${CONTRACT}&limit=100&page=${page}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`explorer answered ${response.status}`);
    const body = await response.json();
    for (const tx of body.transactions ?? []) {
      const call = tx?.data?.calldata ? decode(tx.data.calldata) : null;
      if (!call) continue;
      const done = succeeded(tx);
      if (!done.ok) continue;
      const row = { method: call.method, hash: tx.hash, from: String(tx.from_address ?? ''), created: String(tx.created_at ?? '') };
      const id = done.returned && /^\d+$/.test(done.returned) ? done.returned : '';
      if (call.method === 'create_target' && id) (index.targets[id] ??= []).push(row);
      else if (call.method === 'attack' && id) {
        (index.attacks[id] ??= []).push(row);
        if (call.args.length) (index.targets[String(call.args[0])] ??= []).push(row);
      } else if (call.method === 'judge' && call.args.length) (index.attacks[String(call.args[0])] ??= []).push(row);
      else if (BY_TARGET.has(call.method) && call.args.length) (index.targets[String(call.args[0])] ??= []).push(row);
    }
    const pages = Number(body?.pagination?.totalPages ?? 1);
    if (page >= pages) break;
  }
  return index;
}

const cachedScan = unstable_cache(scan, ['explorer-scan', CONTRACT], { revalidate: 60, tags: ['txs'] });

/** Every successful write on one target (its post, attacks, top-ups and payouts), newest first. */
export async function targetTxs(id: number): Promise<ChainTx[]> {
  try {
    return (await cachedScan()).targets[String(id)] ?? [];
  } catch {
    return [];
  }
}

/** The attack transaction and the judge transaction of one attack, newest first. */
export async function attackTxs(id: number): Promise<ChainTx[]> {
  try {
    return (await cachedScan()).attacks[String(id)] ?? [];
  } catch {
    return [];
  }
}

/** The newest successful transaction of one kind, optionally from one address. */
export function latest(txs: ChainTx[], method: string, from = ''): ChainTx | undefined {
  return txs.find((t) => t.method === method && (!from || t.from.toLowerCase() === from.toLowerCase()));
}
