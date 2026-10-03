'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { CHAIN_HEX } from '@/lib/genlayer-core.mjs';
import { gen, short } from '@/lib/format';
import { balanceOf, connect as connectWallet, currentChain, ethereum, switchNetwork } from '@/lib/write';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Step = 'none' | 'no-wallet' | 'connect' | 'switch' | 'fund' | 'ready';

type WalletState = {
  account: string;
  chainOk: boolean;
  balance: bigint | null;
  step: Step;
  busy: string;
  error: string;
  connect: () => Promise<void>;
  switchNet: () => Promise<void>;
  faucet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
};

const Ctx = createContext<WalletState | null>(null);

/** Below this a write and its fee deposit may not fit. */
const LOW = 2n * 10n ** 18n;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState('');
  const [chainOk, setChainOk] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [hasWallet, setHasWallet] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refreshBalance = useCallback(async () => {
    if (!account) return;
    try {
      setBalance(await balanceOf(account));
    } catch {
      /* the next refresh will try again */
    }
  }, [account]);

  useEffect(() => {
    let eth: any;
    try {
      eth = ethereum();
    } catch {
      setHasWallet(false);
      return;
    }
    eth.request({ method: 'eth_accounts' }).then((a: string[]) => setAccount(a?.[0] ?? '')).catch(() => {});
    currentChain().then((c) => setChainOk(c === CHAIN_HEX)).catch(() => {});
    const onAccounts = (a: string[]) => setAccount(a?.[0] ?? '');
    const onChain = (c: string) => setChainOk(String(c).toLowerCase() === CHAIN_HEX);
    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  useEffect(() => {
    setBalance(null);
    refreshBalance();
  }, [account, refreshBalance]);

  const connect = useCallback(async () => {
    setError('');
    setBusy('connect');
    try {
      setAccount(await connectWallet());
      setChainOk((await currentChain()) === CHAIN_HEX);
    } catch (e: any) {
      setError(e?.message === 'no_wallet' ? 'No wallet found in this browser.' : String(e?.message ?? e).slice(0, 160));
    } finally {
      setBusy('');
    }
  }, []);

  const switchNet = useCallback(async () => {
    setError('');
    setBusy('switch');
    try {
      await switchNetwork();
      setChainOk((await currentChain()) === CHAIN_HEX);
    } catch (e: any) {
      setError(String(e?.message ?? e).slice(0, 160));
    } finally {
      setBusy('');
    }
  }, []);

  const faucet = useCallback(async () => {
    if (!account) return;
    setError('');
    setBusy('faucet');
    try {
      const response = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account }),
      });
      const body = await response.json();
      if (!response.ok) setError(body.error ?? 'The faucet did not pay.');
      if (body.after) setBalance(BigInt(body.after));
    } catch {
      setError('The faucet did not answer. Try again in a minute.');
    } finally {
      setBusy('');
    }
  }, [account]);

  const step: Step = !hasWallet ? 'no-wallet' : !account ? 'connect' : !chainOk ? 'switch' : balance !== null && balance < LOW ? 'fund' : 'ready';

  const value = useMemo(
    () => ({ account, chainOk, balance, step, busy, error, connect, switchNet, faucet, refreshBalance }),
    [account, chainOk, balance, step, busy, error, connect, switchNet, faucet, refreshBalance],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}

/** The navbar button: connect, then the account and its GEN. */
export function WalletButton() {
  const w = useWallet();
  if (w.step === 'no-wallet') {
    return (
      <a className="c-btn small ghost" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        Get a wallet
      </a>
    );
  }
  if (!w.account) {
    return (
      <button className="c-btn small" onClick={w.connect} disabled={w.busy === 'connect'}>
        Connect wallet
      </button>
    );
  }
  if (!w.chainOk) {
    return (
      <button className="c-btn small" onClick={w.switchNet} disabled={w.busy === 'switch'}>
        Switch to Studio Next
      </button>
    );
  }
  return (
    <Link href="/me" className="c-pill hover:text-[var(--ink)]" title={`${w.account}: my targets and attacks`}>
      <span className="mono">{short(w.account)}</span>
      {w.balance !== null && <span className="c-faint">{gen(w.balance)}</span>}
    </Link>
  );
}

/**
 * Stands in front of any write: walks the visitor through Connect wallet,
 * Switch network (adding chain 61997 if the wallet lacks it) and Get test GEN,
 * and only then shows the children.
 */
export function WalletGate({ children, action = 'continue' }: { children: React.ReactNode; action?: string }) {
  const w = useWallet();
  let body: React.ReactNode = null;
  if (w.step === 'no-wallet') {
    body = (
      <>
        <p className="c-muted text-[14px]">A wallet is needed to {action}. Reading works without one.</p>
        <a className="c-btn" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
          Install a wallet
        </a>
      </>
    );
  } else if (w.step === 'connect') {
    body = (
      <>
        <p className="c-muted text-[14px]">Step 1 of 3. Connect a wallet to {action}.</p>
        <button className="c-btn solid" onClick={w.connect} disabled={w.busy === 'connect'}>
          Connect wallet
        </button>
      </>
    );
  } else if (w.step === 'switch') {
    body = (
      <>
        <p className="c-muted text-[14px]">Step 2 of 3. Redline runs on GenLayer Studio Next, chain 61997.</p>
        <button className="c-btn solid" onClick={w.switchNet} disabled={w.busy === 'switch'}>
          Switch network
        </button>
      </>
    );
  } else if (w.step === 'fund') {
    body = (
      <>
        <p className="c-muted text-[14px]">
          Step 3 of 3. This account holds {w.balance !== null ? gen(w.balance) : 'no GEN'}. Every write carries a small fee
          deposit, and test GEN is free.
        </p>
        <button className="c-btn solid" onClick={w.faucet} disabled={w.busy === 'faucet'}>
          {w.busy === 'faucet' ? 'Asking the faucet…' : 'Get test GEN'}
        </button>
      </>
    );
  }
  if (!body) return <>{children}</>;
  return (
    <div className="c-card pad flex flex-col items-start gap-3">
      {body}
      {w.error && <p className="text-[13px]" style={{ color: 'var(--danger)' }}>{w.error}</p>}
    </div>
  );
}
