/**
 * A stand-in EIP-1193 wallet for a local test account: what MetaMask would
 * answer, signed with the test key. It answers eth_requestAccounts with the
 * account, signs eth_sendTransaction, and forwards everything else to the RPC.
 *
 * The key is read from ~/.redline/accounts.json at run time and never
 * printed or written anywhere. `ensureAccount` creates a fresh account there
 * when the name is new, and returns only its address.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { CHAIN_ID, RPC, chainFor } from '../lib/genlayer-core.mjs';

const KEYS = path.join(os.homedir(), '.redline', 'accounts.json');

function readKeys() {
  return fs.existsSync(KEYS) ? JSON.parse(fs.readFileSync(KEYS, 'utf8')) : {};
}

/** Make the named account if it does not exist yet. Returns its address, never its key. */
export function ensureAccount(name) {
  const keys = readKeys();
  if (!keys[name]) {
    keys[name] = generatePrivateKey().slice(2);
    fs.mkdirSync(path.dirname(KEYS), { recursive: true });
    fs.writeFileSync(KEYS, JSON.stringify(keys, null, 2) + '\n', { mode: 0o600 });
  }
  return privateKeyToAccount(`0x${keys[name].replace(/^0x/, '')}`).address;
}

export async function rpc(method, params = []) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = await response.json();
    if (body.error?.code === -32029 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
    return body.result;
  }
}

export async function balanceOf(address) {
  return BigInt(await rpc('eth_getBalance', [address, 'latest']));
}

/** The wallet for a named account: its address and an EIP-1193 provider. */
export function standinWallet(name) {
  const keys = readKeys();
  if (!keys[name]) throw new Error(`no account named ${name}`);
  const signer = privateKeyToAccount(`0x${keys[name].replace(/^0x/, '')}`);
  const wallet = createWalletClient({ account: signer, chain: chainFor(), transport: http(RPC) });
  const provider = {
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [signer.address];
      if (method === 'eth_chainId') return `0x${CHAIN_ID.toString(16)}`;
      if (method === 'eth_sendTransaction') {
        const tx = params[0];
        return wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? BigInt(tx.value) : 0n,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
          gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
          nonce: tx.nonce ? Number(BigInt(tx.nonce)) : undefined,
          type: 'legacy',
        });
      }
      return rpc(method, params ?? []);
    },
    on() {},
    removeListener() {},
  };
  return { address: signer.address, provider };
}
