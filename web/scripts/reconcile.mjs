/**
 * Reconcile a reviewer-path run's balances over the whole run, from every
 * transaction's own fee accounting.
 *
 *   node scripts/reconcile.mjs [run-name]
 *
 * A balance read around one claim can also catch the refund of an earlier
 * transaction that settles in the same window. So this adds everything each
 * account received (faucet, claims) and subtracts everything it sent (value
 * and the net fee of every transaction it signed), and compares the result
 * with the balance now, once every transaction has settled.
 */
import fs from 'node:fs';
import path from 'node:path';

import { balanceOf, rpc } from './standin-wallet.mjs';

const run = process.argv[2] ?? 'rp1';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RECORD = path.join(here, '..', '..', 'docs', 'reviewer-path.studio-next.json');
const record = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
const log = record.runs[run];
const fmt = (wei) => `${Number(wei) / 1e18} GEN`;

const out = { at: new Date().toISOString(), accounts: {} };
for (const [who, address] of Object.entries({ bea: log.accounts.bea, hal: log.accounts.hal })) {
  const faucet = log.steps.find((s) => s.key === `faucet-${who}`);
  let expected = BigInt(faucet.read_after);
  const rows = [];
  for (const s of log.steps.filter((x) => x.hash && x.from === address)) {
    const tx = await rpc('eth_getTransactionByHash', [s.hash]);
    const acct = tx?.data?.fee_accounting ?? {};
    // The primary fee is what leaves the wallet; see feeAccounting in reviewer-path.mjs for the message term.
    const net =
      (acct.top_ups ?? []).reduce((sum, t) => sum + BigInt(t.primaryAmount ?? 0), 0n) -
      (acct.refunds ?? []).reduce((sum, r) => sum + BigInt(r.primary ?? 0), 0n);
    // A refused write is rolled back with its value: only a write that returned took the value it carried.
    const value = s.ok ? BigInt(s.value ?? 0) : 0n;
    const message =
      (acct.top_ups ?? []).reduce((sum, t) => sum + BigInt(t.messageFees ?? 0), 0n) -
      (acct.refunds ?? []).reduce((sum, r) => sum + BigInt(r.message ?? 0), 0n);
    expected -= value + net;
    rows.push({ key: s.key, hash: s.hash, value: value.toString(), fee_paid: String(acct.paid_fee_value ?? 0), refunded: String(acct.total_refunded ?? 0), fee_status: acct.status ?? null, primary_net: net.toString(), message_consumed: message.toString(), outcome: s.ok ? 'returned' : s.status });
  }
  const claims = log.steps.filter((s) => s.key.startsWith('balance-') && s.key.endsWith(`-${who}`));
  const claimed = claims.reduce((sum, s) => sum + BigInt(s.paid_by_contract), 0n);
  expected += claimed;
  const now = await balanceOf(address);
  out.accounts[who] = { address, expected: expected.toString(), balance: now.toString(), difference: (now - expected).toString(), claimed: claimed.toString(), transactions: rows };
  console.log(`${who}: expected ${fmt(expected)}, balance ${fmt(now)}, difference ${(now - expected).toString()} wei over ${rows.length} transactions`);
}
log.reconciliation = out;
fs.writeFileSync(RECORD, JSON.stringify(record, null, 2) + '\n');
