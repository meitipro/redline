import { NextResponse } from 'next/server';
import { getAddress, isAddress } from 'viem';

import { RPC } from '@/lib/genlayer-core.mjs';

/**
 * Test GEN for a visitor's wallet, from Studio's own faucet (sim_fundAccount).
 *
 * Two measured traps: Studio's faucet answers a lowercase address with a
 * transaction hash and funds nothing, and wallets report addresses in lower
 * case. So the address is checksummed first, and success is the balance
 * moving, read before and after, never the hash.
 *
 * Rate limited per IP and per address, in memory. No key is involved.
 */

const AMOUNT = 20n * 10n ** 18n;
const ENOUGH = 10n * 10n ** 18n;
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 3;
const seenIp = new Map<string, number[]>();
const seenAddress = new Map<string, number>();

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const body = await response.json();
  if (body.error) throw Object.assign(new Error(String(body.error.message)), { code: body.error.code });
  return body.result;
}

async function balance(address: string): Promise<bigint> {
  return BigInt(String((await rpc('eth_getBalance', [address, 'latest'])) ?? '0x0'));
}

export async function POST(request: Request) {
  let address = '';
  try {
    address = String((await request.json())?.address ?? '');
  } catch {
    /* handled below */
  }
  if (!isAddress(address, { strict: false })) {
    return NextResponse.json({ error: 'Send a wallet address.' }, { status: 400 });
  }
  const checksummed = getAddress(address);
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (seenIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) {
    return NextResponse.json({ error: 'The faucet already paid this connection three times in ten minutes. Try again later.' }, { status: 429 });
  }
  if (now - (seenAddress.get(checksummed) ?? 0) < WINDOW_MS) {
    return NextResponse.json({ error: 'This address was funded a few minutes ago. Try again later.' }, { status: 429 });
  }

  try {
    const before = await balance(checksummed);
    if (before >= ENOUGH) {
      return NextResponse.json({ error: 'This address already holds enough test GEN.', before: before.toString(), after: before.toString() }, { status: 409 });
    }
    seenIp.set(ip, [...recent, now]);
    seenAddress.set(checksummed, now);
    try {
      // Studio Next wants the amount as a decimal string.
      await rpc('sim_fundAccount', [checksummed, AMOUNT.toString()]);
    } catch {
      // Its answer is not evidence either way; the balance is.
    }
    let after = before;
    for (let i = 0; i < 12 && after <= before; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      after = await balance(checksummed);
    }
    if (after <= before) {
      return NextResponse.json({ error: 'The faucet did not pay. Try again in a minute.', before: before.toString(), after: after.toString() }, { status: 502 });
    }
    return NextResponse.json({ address: checksummed, before: before.toString(), after: after.toString() });
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    const limited = /-32029|rate limit/i.test(text) || (error as { code?: number })?.code === -32029;
    return NextResponse.json(
      { error: limited ? 'Studio Next is rate limiting the faucet. Wait a minute and try again.' : 'The faucet did not answer. Try again in a minute.' },
      { status: limited ? 429 : 502 },
    );
  }
}
