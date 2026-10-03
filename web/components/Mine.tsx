'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CONTRACT, readClient, retried } from '@/lib/genlayer-core.mjs';
import { dayTime, gen } from '@/lib/format';
import { lockLeft, owedTo, verdictLabel } from '@/lib/target';
import type { Attack, AttackPage, Target, TargetPage } from '@/lib/types';

import { StatusBadge } from './ui';
import { WalletGate, useWallet } from './Wallet';

async function fresh<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => readClient().readContract({ address: CONTRACT, functionName: method, args }), 4);
  return JSON.parse(String(raw)) as T;
}

async function everything(): Promise<{ targets: Target[]; attacks: Attack[] }> {
  const t0 = await fresh<TargetPage>('list_targets', ['', 0, 50]);
  const targets = [...t0.items];
  for (let o = 50; o < t0.total; o += 50) targets.push(...(await fresh<TargetPage>('list_targets', ['', o, 50])).items);
  const a0 = await fresh<AttackPage>('list_attacks', [0, 0, 50]);
  const attacks = [...a0.items];
  for (let o = 50; o < a0.total; o += 50) attacks.push(...(await fresh<AttackPage>('list_attacks', [0, o, 50])).items);
  return { targets, attacks };
}

/** The connected wallet's targets and attacks, read from the chain in the browser. */
export function Mine() {
  const w = useWallet();
  const [data, setData] = useState<{ targets: Target[]; attacks: Attack[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!w.account) return;
    let live = true;
    everything()
      .then((d) => live && setData(d))
      .catch(() => live && setError('Studio Next did not answer. Reload in a moment.'));
    return () => {
      live = false;
    };
  }, [w.account]);

  if (!w.account) {
    return (
      <WalletGate action="see your targets and attacks">
        <span />
      </WalletGate>
    );
  }
  if (error) return <p className="c-note">{error}</p>;
  if (!data) return <p className="c-note flex items-center gap-2"><span className="c-spin" /> Reading the chain…</p>;

  const me = w.account.toLowerCase();
  const posted = data.targets.filter((t) => t.builder.toLowerCase() === me);
  const sent = data.attacks.filter((a) => a.hunter.toLowerCase() === me);
  const owed = data.targets
    .map((t) => ({ t, due: owedTo(t, data.attacks.filter((a) => a.target_id === t.id), w.account) }))
    .filter((r) => r.due > 0n);
  const reclaimable = posted.filter((t) => t.status === 'OPEN' && t.lock_until * 1000 <= Date.now());

  return (
    <div className="flex flex-col gap-10">
      <section>
        <p className="c-eyebrow">To claim or reclaim</p>
        <div className="mt-3 flex flex-col gap-2">
          {owed.map(({ t, due }) => (
            <Link key={t.id} href={`/t/${t.id}`} className="c-card pad c-row-link flex flex-wrap items-center gap-3">
              <span className="font-medium">{t.name}</span>
              <span className="mono ml-auto">Claim {gen(due)}</span>
            </Link>
          ))}
          {reclaimable.map((t) => (
            <Link key={t.id} href={`/t/${t.id}`} className="c-card pad c-row-link flex flex-wrap items-center gap-3">
              <span className="font-medium">{t.name}</span>
              <span className="mono ml-auto">Reclaim {gen(t.bounty)}</span>
            </Link>
          ))}
          {!owed.length && !reclaimable.length && <p className="c-note">Nothing to claim or reclaim right now.</p>}
        </div>
      </section>

      <section>
        <p className="c-eyebrow">Bounties I posted</p>
        <div className="c-card mt-3 divide-y divide-[var(--line)]">
          {posted.map((t) => (
            <Link key={t.id} href={`/t/${t.id}`} className="c-row-link flex flex-wrap items-center gap-3 px-4 py-3">
              <StatusBadge target={t} />
              <span className="font-medium">{t.name}</span>
              <span className="c-faint text-[13px]">
                {gen(t.bounty)} · {t.held} held · {t.status === 'OPEN' ? `lock ${lockLeft(t.lock_until)}` : 'closed'}
              </span>
            </Link>
          ))}
          {!posted.length && (
            <div className="p-4">
              <p className="c-note">
                You have not posted a target. <Link href="/new" className="c-link">Post one</Link>.
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="c-eyebrow">Attacks I sent</p>
        <div className="c-card mt-3 divide-y divide-[var(--line)]">
          {sent.map((a) => (
            <Link key={a.id} href={`/a/${a.id}`} className="c-row-link flex flex-wrap items-center gap-3 px-4 py-3">
              <span className={`c-verdict ${a.status === 'BROKEN' ? 'broken' : a.status === 'HELD' ? 'held' : 'quiet'}`}>{verdictLabel(a)}</span>
              <span className="font-medium">{a.target_name}</span>
              <span className="c-faint min-w-0 flex-1 truncate text-[13px]">&ldquo;{a.text}&rdquo;</span>
              <span className="c-faint text-[12.5px]">{dayTime(a.submitted_at)}</span>
            </Link>
          ))}
          {!sent.length && (
            <div className="p-4">
              <p className="c-note">
                You have not sent an attack. <Link href="/#targets" className="c-link">Pick a target</Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
