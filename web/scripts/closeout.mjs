/**
 * Settle every lock that has ended, through the site's own code, and reconcile to the wei.
 *
 *   node scripts/closeout.mjs https://<the deployed site> [run-name]
 *
 *   1. refusal   an attack on a target whose lock has ended is refused
 *   2. refusal   a reclaim before the lock ends is refused (seeded Tollgate, locked to Oct 17)
 *   3. reclaim   the golden builder reclaims every unbroken golden target whose lock ended;
 *                each one pays exactly its bounty, held fees included
 *   4. refusal   a second reclaim of the same target is refused
 *   5. claim     golden hunters claim what the golden run left owed: three broken bounties
 *                and the refund of the void attack from case 9
 *   6. reconcile each account's balance at the end must equal its balance at the start,
 *                plus what the contract paid it, minus the primary fee of every transaction
 *                it signed. Value carried by a refused write never leaves the wallet.
 *   7. read      the target page on the deployed site says the bounty was reclaimed
 *
 * Every write goes through lib/genlayer-core.mjs with the stand-in wallet. Each
 * step is written to ../docs/closeout.studio-next.json before it is printed.
 * Keys stay in ~/.redline/accounts.json and are never printed.
 */

import fs from 'node:fs';
import path from 'node:path';

import { CONTRACT, outcomeOf, readClient, retried, submit, waitDecided, waitFinal, walletClient } from '../lib/genlayer-core.mjs';
import { balanceOf, rpc, standinWallet } from './standin-wallet.mjs';

const site = (process.argv[2] ?? '').replace(/\/$/, '');
const run = process.argv[3] ?? 'c1';
if (!site) {
  console.error('usage: node scripts/closeout.mjs https://<site> [run-name]');
  process.exit(2);
}
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RECORD = path.join(here, '..', '..', 'docs', 'closeout.studio-next.json');
const record = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')) : { runs: {} };
const log = (record.runs[run] ??= { site, contract: CONTRACT, started: new Date().toISOString(), steps: [] });
const save = () => fs.writeFileSync(RECORD, JSON.stringify(record, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
const fmt = (wei) => `${Number(wei) / 1e18} GEN`;
const stepFor = (key) => log.steps.find((s) => s.key === key);
function note(entry) {
  log.steps.push({ at: new Date().toISOString(), ...entry });
  save();
}

const reader = readClient();
async function view(functionName, args) {
  return JSON.parse(String(await retried(() => reader.readContract({ address: CONTRACT, functionName, args }), 5)));
}

/** The primary fee a transaction cost its sender, and whether its accounting has settled. */
async function primaryFee(hash) {
  const tx = await rpc('eth_getTransactionByHash', [hash]).catch(() => null);
  const acct = tx?.data?.fee_accounting;
  if (!acct) return null;
  const paid = (acct.top_ups ?? []).reduce((sum, t) => sum + BigInt(t.primaryAmount ?? 0), 0n);
  const refunded = (acct.refunds ?? []).reduce((sum, r) => sum + BigInt(r.primary ?? 0), 0n);
  return { net: paid - refunded, status: acct.status ?? null };
}

async function write(key, account, method, args, value = 0n, { expect = 'ok', paid = 0n } = {}) {
  const prior = stepFor(key);
  if (prior?.pass) return prior;
  const { address, provider } = standinWallet(account);
  const client = walletClient(address, provider);
  const started = Date.now();
  const hash = await submit(client, { method, args, value, sender: address });
  const outcome = outcomeOf(await waitDecided(client, hash, method));
  const entry = {
    key,
    method,
    account,
    from: address,
    args,
    value: value.toString(),
    hash,
    expect,
    ok: outcome.ok,
    pass: expect === 'ok' ? outcome.ok : !outcome.ok && Boolean(outcome.refusal),
    status: outcome.status,
    refusal: outcome.refusal || null,
    paid_by_contract: outcome.ok ? paid.toString() : '0',
    seconds_to_decision: Math.round((Date.now() - started) / 1000),
  };
  if (outcome.ok) entry.final_status = outcomeOf(await waitFinal(client, hash)).status;
  note(entry);
  console.log(`${key}: ${method} ${entry.ok ? 'ok' : 'refused: ' + (entry.refusal ?? entry.status)} (${entry.status}) ${entry.pass ? '' : 'UNEXPECTED'}  ${hash}`);
  if (!entry.pass) throw new Error(`${key}: expected ${expect}`);
  return entry;
}

const ACCOUNTS = ['golden_builder', 'golden_hunter_1', 'golden_hunter_2', 'seed_builder'];
if (!log.start) {
  log.start = {};
  for (const name of ACCOUNTS) {
    const { address } = standinWallet(name);
    log.start[name] = { address, balance: (await balanceOf(address)).toString() };
  }
  save();
  console.log('balances at start recorded');
}

// -- 1, 2. refusals ---------------------------------------------------------------------------------
const two = await view('get_target', [2]);
await write('attack-after-lock', 'golden_hunter_1', 'attack', [2, 'Hi, what can you help with?'], BigInt(two.entry_fee), { expect: 'refused' });
await write('reclaim-before-lock', 'seed_builder', 'reclaim', [9], 0n, { expect: 'refused' });

// -- 3, 4. reclaims -----------------------------------------------------------------------------------
const now = Math.floor(Date.now() / 1000);
const builder = standinWallet('golden_builder').address.toLowerCase();
const all = (await view('list_targets', ['OPEN', 0, 50])).items;
const ended = all.filter((t) => t.builder.toLowerCase() === builder && t.lock_until < now).sort((a, b) => a.id - b.id);
for (const t of ended) {
  await write(`reclaim-${t.id}`, 'golden_builder', 'reclaim', [t.id], 0n, { paid: BigInt(t.bounty) });
  const after = await view('get_target', [t.id]);
  if (!stepFor(`read-reclaim-${t.id}`)) note({ key: `read-reclaim-${t.id}`, pass: after.status === 'CLOSED' && after.paid, target: t.id, bounty: t.bounty, posted: t.posted, fees_in: t.fees_in, held: t.held, status: after.status });
}
if (ended.length) await write(`reclaim-again-${ended[0].id}`, 'golden_builder', 'reclaim', [ended[0].id], 0n, { expect: 'refused' });

// -- 5. what the golden run left owed ---------------------------------------------------------------------
for (const hunter of ['golden_hunter_1', 'golden_hunter_2']) {
  const me = standinWallet(hunter).address.toLowerCase();
  for (const t of (await view('list_targets', ['', 0, 50])).items.sort((a, b) => a.id - b.id)) {
    if (stepFor(`claim-${t.id}-${hunter}`)) continue;
    const attacks = (await view('list_attacks', [t.id, 0, 50])).items;
    let due = 0n;
    for (const a of attacks) if (a.hunter.toLowerCase() === me && a.refundable) due += BigInt(a.fee);
    if (t.status === 'BROKEN' && !t.paid && t.winner.toLowerCase() === me) due += BigInt(t.bounty);
    if (due === 0n) continue;
    await write(`claim-${t.id}-${hunter}`, hunter, 'claim', [t.id], 0n, { paid: due });
  }
}

// -- 6. reconcile every account over the whole run -------------------------------------------------------
for (const name of ACCOUNTS) {
  const key = `reconcile-${name}`;
  if (stepFor(key)?.pass) continue;
  const mine = log.steps.filter((s) => s.hash && s.account === name);
  let fees = 0n;
  for (const s of mine) {
    let f = await primaryFee(s.hash);
    for (let i = 0; i < 30 && f?.status !== 'settled'; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      f = await primaryFee(s.hash);
    }
    s.primary_fee = f?.net?.toString() ?? null;
    fees += f?.net ?? 0n;
  }
  const valueOut = mine.reduce((sum, s) => sum + (s.ok ? BigInt(s.value) : 0n), 0n);
  const paidIn = mine.reduce((sum, s) => sum + BigInt(s.paid_by_contract), 0n);
  const start = BigInt(log.start[name].balance);
  const expected = start + paidIn - valueOut - fees;
  const end = await balanceOf(log.start[name].address);
  note({ key, pass: end === expected, account: name, transactions: mine.length, start: start.toString(), paid_by_contract: paidIn.toString(), value_out: valueOut.toString(), primary_fees: fees.toString(), expected: expected.toString(), end: end.toString(), difference: (end - expected).toString() });
  console.log(`${name}: start ${fmt(start)}, paid ${fmt(paidIn)}, fees ${fmt(fees)} -> expected ${fmt(expected)}, end ${fmt(end)}, difference ${(end - expected).toString()} wei`);
}

// -- 7. the deployed site shows it ---------------------------------------------------------------------------
if (ended.length && !stepFor('page-reclaimed')?.pass) {
  const url = `${site}/t/${ended[0].id}`;
  let pass = false;
  let status = 0;
  for (let attempt = 0; attempt < 6 && !pass; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 10000));
    const response = await fetch(url, { cache: 'no-store' });
    status = response.status;
    pass = response.ok && (await response.text()).replace(/<!-- -->/g, '').includes('The builder reclaimed the unbroken bounty');
  }
  note({ key: 'page-reclaimed', pass, url, http: status });
  console.log(`page-reclaimed: HTTP ${status} ${pass ? 'shows it' : 'MISSING'}  ${url}`);
}

log.finished = new Date().toISOString();
save();
const failed = log.steps.filter((s) => !s.pass).map((s) => s.key);
console.log(`\nrecorded in docs/closeout.studio-next.json (run ${run}); ${failed.length ? 'not passing: ' + failed.join(', ') : 'every step passed'}`);
