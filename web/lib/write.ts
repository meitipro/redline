'use client';

/**
 * Writes, signed in the visitor's own wallet. No key ever exists on a server.
 *
 * Every step below is lib/genlayer-core.mjs, the same file scripts/send-as.mjs
 * drives with a stand-in wallet, so the path a reviewer takes is the path the
 * live test took.
 */

import { CHAIN_HEX, DEPLOYMENT, explain, outcomeOf, retried, submit, waitDecided, walletClient } from './genlayer-core.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Phase = 'idle' | 'signing' | 'deciding' | 'done' | 'refused' | 'error';

export type TxState = {
  phase: Phase;
  method?: string;
  hash?: string;
  message?: string;
  returned?: unknown;
  startedAt?: number;
  seconds?: number;
};

export const NETWORK_NAME = 'GenLayer Studio Next';

export function ethereum(): any {
  const eth = (globalThis as any).ethereum;
  if (!eth?.request) throw new Error('no_wallet');
  return eth;
}

function codeOf(error: any): number | undefined {
  return error?.code === -32603 ? (error?.data?.originalError?.code ?? error?.data?.code) : error?.code;
}

export async function connect(): Promise<string> {
  const accounts: string[] = await ethereum().request({ method: 'eth_requestAccounts' });
  if (!accounts?.[0]) throw new Error('The wallet returned no account.');
  return accounts[0];
}

export async function currentChain(): Promise<string> {
  return String(await ethereum().request({ method: 'eth_chainId' })).toLowerCase();
}

export async function switchNetwork(): Promise<void> {
  const eth = ethereum();
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  } catch (error: any) {
    if (codeOf(error) !== 4902) throw error;
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: NETWORK_NAME,
          rpcUrls: [DEPLOYMENT.rpc],
          blockExplorerUrls: [`${DEPLOYMENT.explorer}/`],
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
        },
      ],
    });
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
  }
}

export async function balanceOf(address: string): Promise<bigint> {
  const response = await retried(() =>
    fetch(DEPLOYMENT.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
    }),
  );
  const body = await response.json();
  return BigInt(body?.result ?? '0x0');
}

/** Drop the site's cached reads that this write touched, then the caller re-renders. */
export async function refreshReads(tags: string[]): Promise<void> {
  try {
    await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags }) });
  } catch {
    // The cache expires on its own within 20 seconds.
  }
}

/**
 * Sign, wait for validators, and say honestly what happened. `onState` sees
 * every phase so the page can show "Validators are running the agent" with
 * the transaction link while it waits.
 */
export async function send(
  account: string,
  method: string,
  args: unknown[],
  value: bigint,
  onState: (s: TxState) => void,
): Promise<TxState> {
  const startedAt = Date.now();
  let state: TxState = { phase: 'signing', method, startedAt };
  onState(state);
  try {
    const client = walletClient(account, ethereum());
    const hash: string = await submit(client, { method, args, value, sender: account });
    state = { ...state, phase: 'deciding', hash };
    onState(state);
    const receipt = await waitDecided(client, hash, method);
    const outcome = outcomeOf(receipt);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    state = outcome.ok
      ? { ...state, phase: 'done', returned: outcome.returned, seconds }
      : {
          ...state,
          phase: 'refused',
          seconds,
          message:
            outcome.refusal ||
            (outcome.status === 'UNDETERMINED'
              ? 'The validators could not agree on a verdict, so nothing was stored and nobody is paid: the break did not reproduce across their models. The attack is still queued.'
              : `The transaction ended ${outcome.status} (${outcome.execution || 'no execution'}).`),
        };
  } catch (error) {
    state = { ...state, phase: 'error', message: explain(error) };
  }
  onState(state);
  return state;
}
