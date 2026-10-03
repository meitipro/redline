/**
 * Read an attack's verdict. Reads need no wallet and no fee.
 *
 *   node examples/read-attack.mjs <attack id>
 *
 * This file is the sample on the docs page "Quickstart: send your first
 * attack", copied in by scripts/gen_docs.py.
 */
import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const REDLINE = '0xeE63477515314322496640f3fB06021a24D0d66d';
const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } } };

const client = createClient({ chain });
const attack = JSON.parse(await client.readContract({ address: REDLINE, functionName: 'get_attack', args: [Number(process.argv[2] ?? 1)] }));

if (!attack.found) throw new Error('no such attack');
console.log(JSON.stringify({ target: attack.target_name, status: attack.status, verdict: attack.verdict, reason: attack.reason }));
