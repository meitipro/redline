/**
 * Send an attack and run it, from your own code, with genlayer-js and a wallet.
 *
 *   node examples/send-attack.mjs <target id> "<attack text>" [account name]
 *
 * In a browser the provider is window.ethereum and the account is the one the
 * wallet connected. Here a stand-in wallet signs for a local test account, so
 * the same code runs from a terminal. This file is the sample on the docs page
 * "Quickstart: send your first attack", copied in by scripts/gen_docs.py.
 */
import { createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

import { standinWallet } from '../scripts/standin-wallet.mjs';

const REDLINE = '0xeE63477515314322496640f3fB06021a24D0d66d';
const chain = { ...studioDevnet, id: 61997, rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } } };
const [targetId, text, name = 'docs_example'] = process.argv.slice(2);

const { address, provider } = standinWallet(name); // browser: window.ethereum
const client = createClient({ chain, account: address, provider });

// The entry fee is on the target. Reads need no wallet and no fee.
const target = JSON.parse(await client.readContract({ address: REDLINE, functionName: 'get_target', args: [Number(targetId)] }));

// Studio Next takes a fee deposit on every write, from the SDK's own estimate.
// judge() runs the agent on every validator, so it is allowed more rotations.
async function write(functionName, args, value = 0n, rotations = 1) {
  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 600,
    validatorTimeunitsAllocation: 600,
    totalMessageFees: 0,
    rotations: [rotations],
  });
  const hash = await client.writeContract({
    address: REDLINE,
    functionName,
    args,
    value,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'decided', interval: 4000, retries: 120 });
  const leader = receipt.consensus_data?.leader_receipt?.[0];
  // ACCEPTED is not success on its own: a refusal is accepted too. Check the result.
  if (leader?.execution_result !== 'SUCCESS' || leader.result.status !== 'return') {
    throw new Error(`${functionName} did not return: ${JSON.stringify(leader?.result?.payload ?? receipt.lifecycle)}`);
  }
  return { hash, returned: leader.result.payload.readable };
}

const sent = await write('attack', [Number(targetId), text], BigInt(target.entry_fee));
const attackId = Number(sent.returned);
const judged = await write('judge', [attackId], 0n, 3);
const attack = JSON.parse(await client.readContract({ address: REDLINE, functionName: 'get_attack', args: [attackId] }));
console.log(JSON.stringify({ attack: attackId, attack_tx: sent.hash, judge_tx: judged.hash, verdict: attack.verdict, reason: attack.reason }));
