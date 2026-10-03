'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CONTRACT, readClient, retried } from '@/lib/genlayer-core.mjs';
import { dayTime, gen, toWei } from '@/lib/format';
import { MAX_ATTACK, canaryShaped } from '@/lib/keyscan';
import { owedTo } from '@/lib/target';
import type { Attack, AttackPage, Target } from '@/lib/types';
import { refreshReads, send, type TxState } from '@/lib/write';

import { Tx } from './ui';
import { WalletGate, useWallet } from './Wallet';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A fresh read from the browser, skipping the site's cache. */
async function fresh<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => readClient().readContract({ address: CONTRACT, functionName: method, args }), 4);
  return JSON.parse(String(raw)) as T;
}

/** Every attack on one target, from the browser. */
export async function attacksOf(targetId: number): Promise<Attack[]> {
  const first = await fresh<AttackPage>('list_attacks', [targetId, 0, 50]);
  const items = [...first.items];
  for (let offset = 50; offset < first.total; offset += 50) items.push(...(await fresh<AttackPage>('list_attacks', [targetId, offset, 50])).items);
  return items;
}

/** While a transaction is in flight: what is happening, with its link. */
export function TxProgress({ state, waiting }: { state: TxState; waiting: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (state.phase !== 'deciding' && state.phase !== 'signing') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state.phase]);
  if (state.phase === 'idle') return null;
  if (state.phase === 'signing') {
    return (
      <div className="c-note flex items-center gap-2">
        <span className="c-spin" /> Confirm the transaction in your wallet.
      </div>
    );
  }
  if (state.phase === 'deciding') {
    const s = Math.max(0, Math.round((now - (state.startedAt ?? now)) / 1000));
    return (
      <div className="c-note accent flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="c-spin" />
        <span>{waiting}</span>
        <span className="mono text-[12px]">{s} s</span>
        {state.hash && <Tx hash={state.hash} label="tx" />}
      </div>
    );
  }
  if (state.phase === 'refused' || state.phase === 'error') {
    return (
      <div className="c-note" style={{ color: 'var(--danger)' }}>
        <p>
          {state.phase === 'refused' && !state.message?.startsWith('The validators could not agree') ? 'The contract refused: ' : ''}
          {state.message}
        </p>
        {state.hash && (
          <p className="mt-1">
            <Tx hash={state.hash} label="tx" />
          </p>
        )}
        {state.phase === 'error' && <p className="mt-1 text-[12.5px]">Nothing was sent, or the wallet did not return a hash. You can try again.</p>}
      </div>
    );
  }
  if (state.phase === 'done' && state.hash) {
    return (
      <div className="c-note accent flex flex-wrap items-center gap-x-3">
        <span>Done{state.seconds !== undefined ? ` in ${state.seconds} s` : ''}.</span>
        <Tx hash={state.hash} label="tx" />
      </div>
    );
  }
  return null;
}

/** Send one write, then drop the cached reads it touched and re-render. */
function useWrite(tags: string[]) {
  const w = useWallet();
  const router = useRouter();
  const [state, setState] = useState<TxState>({ phase: 'idle' });
  const busy = state.phase === 'signing' || state.phase === 'deciding';
  async function run(method: string, args: unknown[], value = 0n): Promise<TxState> {
    const done = await send(w.account, method, args, value, setState);
    if (done.phase === 'done' || done.phase === 'refused') {
      await refreshReads(['targets', 'attacks', ...tags]);
      w.refreshBalance();
      router.refresh();
    }
    return done;
  }
  return { w, state, busy, run };
}

/** The attack box: pre-checks first, then the entry fee and one message. */
export function AttackBox({ target }: { target: Target }) {
  const { w, state, busy, run } = useWrite([`target:${target.id}`]);
  const router = useRouter();
  const [text, setText] = useState('');
  const shaped = canaryShaped(text);
  const tooLong = text.trim().length > MAX_ATTACK;
  const isBuilder = w.account && w.account.toLowerCase() === target.builder.toLowerCase();
  const lockEnded = target.lock_until * 1000 <= Date.now();
  if (target.status !== 'OPEN') {
    return <p className="c-note">This target is closed. {target.status === 'BROKEN' ? 'It was broken; later attacks are void and refunded.' : 'The builder reclaimed the bounty.'}</p>;
  }
  if (lockEnded) return <p className="c-note">The attack window ended with the lock on {dayTime(target.lock_until)}.</p>;
  return (
    <div className="flex flex-col gap-3">
      <label className="c-label" htmlFor="attack">
        Your attack
      </label>
      <textarea
        id="attack"
        className="c-textarea"
        style={{ minHeight: 150 }}
        placeholder="One message to the agent, as its user."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <span style={{ color: shaped.length ? 'var(--danger)' : 'var(--ink-3)' }}>
          {shaped.length ? `Canary-shaped: ${shaped.slice(0, 3).join(', ')}. This would be rejected.` : 'No canary-shaped strings'}
        </span>
        <span className="mono" style={{ color: tooLong ? 'var(--danger)' : 'var(--ink-3)' }}>
          {text.trim().length} / {MAX_ATTACK}
        </span>
      </div>
      {isBuilder ? (
        <p className="c-note">You posted this target, so you cannot attack it.</p>
      ) : (
        <WalletGate action="send an attack">
          <button
            className="c-btn solid wide"
            disabled={busy || !text.trim() || shaped.length > 0 || tooLong}
            onClick={async () => {
              const done = await run('attack', [target.id, text], BigInt(target.entry_fee));
              const id = typeof done.returned === 'number' || typeof done.returned === 'string' ? Number(done.returned) : 0;
              if (done.phase === 'done' && id) router.push(`/a/${id}`);
            }}
          >
            Attack for {gen(target.entry_fee)}
          </button>
        </WalletGate>
      )}
      <p className="c-faint text-[12.5px]">
        The fee joins the bounty if the agent holds. A rejected or void attack&apos;s fee is refunded through Claim. After
        sending, anyone can ask the validators to run it.
      </p>
      <TxProgress state={state} waiting="Recording your attack" />
    </div>
  );
}

/** Run a queued attack: every validator runs the agent and checks the rules. */
export function JudgeButton({ attack, targetOpen }: { attack: Attack; targetOpen: boolean }) {
  const { state, busy, run } = useWrite([`attack:${attack.id}`, `target:${attack.target_id}`]);
  if (attack.status !== 'QUEUED') return null;
  return (
    <WalletGate action="run this attack">
      <div className="flex flex-col gap-2">
        <button className="c-btn solid wide" disabled={busy} onClick={() => run('judge', [attack.id])}>
          {targetOpen ? 'Run it on the validators' : 'Mark it void'}
        </button>
        <p className="c-faint text-[13px]">
          {targetOpen
            ? 'Anyone can send this. Every validator runs the agent on its own model and checks the rules; it takes a minute or two. A break pays only when they agree.'
            : 'The target closed before this attack ran, so it is not run: it becomes void and its fee is refunded through Claim.'}
        </p>
        <TxProgress state={state} waiting={targetOpen ? 'Validators are running the agent' : 'Recording the void attack'} />
      </div>
    </WalletGate>
  );
}

/** What the connected account is owed on this target, and the claim button. */
export function ClaimBox({ target }: { target: Target }) {
  const { w, state, busy, run } = useWrite([`target:${target.id}`]);
  const [attacks, setAttacks] = useState<Attack[] | null>(null);
  useEffect(() => {
    let live = true;
    attacksOf(target.id)
      .then((a) => live && setAttacks(a))
      .catch(() => live && setAttacks([]));
    return () => {
      live = false;
    };
  }, [target.id, state.phase]);
  if (!w.account || attacks === null) return null;
  const due = owedTo(target, attacks, w.account);
  const winner = target.status === 'BROKEN' && target.winner.toLowerCase() === w.account.toLowerCase();
  if (due === 0n && state.phase === 'idle') return null;
  return (
    <div className="flex flex-col gap-2">
      {due > 0n && (
        <WalletGate action="claim">
          <button className="c-btn solid wide" disabled={busy} onClick={() => run('claim', [target.id])}>
            Claim {gen(due)}
          </button>
        </WalletGate>
      )}
      <p className="c-faint text-[13px]">
        {winner && !target.paid ? 'Your attack broke this target: the bounty is yours, with your own fee back. ' : ''}
        Claims pay the bounty to the hunter whose break reproduced, and refund the fees of rejected and void attacks.
      </p>
      <TxProgress state={state} waiting="Validators are sending what you are owed" />
      {state.phase === 'done' && <p className="c-faint text-[13px]">The GEN lands in your wallet when the transaction is final, a few minutes after this.</p>}
    </div>
  );
}

/** The builder's own controls: top up while open, reclaim an unbroken bounty after the lock. */
export function BuilderBox({ target }: { target: Target }) {
  const { w, state, busy, run } = useWrite([`target:${target.id}`]);
  const [amount, setAmount] = useState('');
  const wei = toWei(amount);
  if (!w.account || w.account.toLowerCase() !== target.builder.toLowerCase()) return null;
  const unlocked = target.lock_until * 1000 <= Date.now();
  return (
    <div className="flex flex-col gap-3">
      <p className="c-eyebrow">You posted this target</p>
      {target.status === 'OPEN' && (
        <WalletGate action="top up the bounty">
          <div className="flex gap-2">
            <input className="c-input mono" placeholder="GEN, e.g. 50" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <button className="c-btn" disabled={busy || !wei || wei <= 0n} onClick={async () => (await run('top_up', [target.id], wei ?? 0n)).phase === 'done' && setAmount('')}>
              Top up
            </button>
          </div>
        </WalletGate>
      )}
      {target.status === 'OPEN' &&
        (unlocked ? (
          <WalletGate action="reclaim the bounty">
            <button className="c-btn solid wide" disabled={busy} onClick={() => run('reclaim', [target.id])}>
              Reclaim {gen(target.bounty)}
            </button>
          </WalletGate>
        ) : (
          <p className="c-note">The bounty is locked until {dayTime(target.lock_until)}. If nobody breaks it by then, you can reclaim it here, held fees included.</p>
        ))}
      {target.status === 'OPEN' && (
        <p className="c-faint text-[13px]">
          Patched your prompt? <Link className="c-link" href="/new">Post version 2</Link> as a new target.
        </p>
      )}
      <TxProgress state={state} waiting="Validators are recording it" />
    </div>
  );
}
