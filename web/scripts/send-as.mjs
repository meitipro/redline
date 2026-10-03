/**
 * Sends one write the way the site does, from a local test account.
 *
 *   node scripts/send-as.mjs <account name> <method> '<json args>' [GEN to send] [--final]
 *
 * The site's own signing code (lib/genlayer-core.mjs) gets a stand-in EIP-1193
 * wallet (scripts/standin-wallet.mjs). Then it waits for the decision and
 * applies the site's success test. With --final it also waits for finality,
 * where value transfers settle.
 *
 * A string argument written as "123n" is sent as a bigint. Prints one JSON
 * line: the hash, the outcome and what the contract returned. Exits 1 unless
 * the write was decided and accepted with a returned result.
 */

import { parseEther } from 'viem';

import { outcomeOf, submit, waitDecided, waitFinal, walletClient } from '../lib/genlayer-core.mjs';
import { standinWallet } from './standin-wallet.mjs';

const [name, method, argsText = '[]', genText = '0', ...flags] = process.argv.slice(2);
if (!name || !method) {
  console.error("usage: node scripts/send-as.mjs <account> <method> '<json args>' [GEN] [--final]");
  process.exit(2);
}
const { address, provider } = standinWallet(name);
const client = walletClient(address, provider);
const args = JSON.parse(argsText).map((a) => (typeof a === 'string' && /^\d+n$/.test(a) ? BigInt(a.slice(0, -1)) : a));
const started = Date.now();
const hash = await submit(client, { method, args, value: parseEther(genText), sender: address });
const decided = await waitDecided(client, hash, method);
const outcome = outcomeOf(decided);
const line = {
  account: name,
  from: address,
  method,
  hash,
  ok: outcome.ok,
  status: outcome.status,
  execution: outcome.execution,
  returned: outcome.returned ?? null,
  refusal: outcome.refusal || null,
  seconds_to_decision: Math.round((Date.now() - started) / 1000),
};
if (flags.includes('--final') && outcome.ok) {
  const final = await waitFinal(client, hash);
  line.final_status = outcomeOf(final).status;
}
console.log(JSON.stringify(line, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));
process.exit(outcome.ok ? 0 : 1);
