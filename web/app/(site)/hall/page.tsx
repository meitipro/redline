import type { Metadata } from 'next';
import Link from 'next/link';

import { AttackText } from '@/components/AttackText';
import { Addr, Empty, ReadError, VerdictBadge } from '@/components/ui';
import { dayTime, gen, plural } from '@/lib/format';
import { allTargets, getAttack, readError } from '@/lib/read';
import { KIND_NAMES, LESSONS } from '@/lib/target';
import type { Attack, Kind, Target } from '@/lib/types';

export const revalidate = 20;

export const metadata: Metadata = {
  title: 'Hall of breaks',
  description: 'Every reproduced break on Redline, grouped by rule type, for builders to learn from.',
};

type Break = { t: Target; a: Attack; kind: Kind };

export default async function Hall() {
  let breaks: Break[] = [];
  let error = '';
  try {
    const broken = await allTargets('BROKEN');
    for (const t of broken) {
      const got = await getAttack(t.winning_attack);
      if (!got.found) continue;
      const rule = t.rules.find((r) => r.number === t.broken_rule);
      breaks.push({ t, a: got, kind: rule?.kind ?? 'secret' });
    }
  } catch (e) {
    error = readError(e);
    breaks = [];
  }
  const kinds: Kind[] = ['secret', 'action', 'scope'];

  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Hall of breaks</p>
      <h1 className="c-h2 mt-2">Every reproduced break, grouped by rule type</h1>
      <p className="c-lead mt-4">
        Each of these broke a posted rule on every validator&apos;s run at once. Read the attack, then the reply, then patch
        your own prompt before real money is behind it.
      </p>
      {error && (
        <div className="mt-8">
          <ReadError message={error} />
        </div>
      )}
      {!error && !breaks.length && (
        <div className="mt-8">
          <Empty>No target has been broken yet.</Empty>
        </div>
      )}
      {kinds.map((kind) => {
        const rows = breaks.filter((b) => b.kind === kind);
        if (!rows.length) return null;
        return (
          <section key={kind} className="mt-12">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="c-h3">{KIND_NAMES[kind]} rules</h2>
              <span className="c-faint text-[13px]">{plural(rows.length, 'break')}</span>
            </div>
            <p className="c-muted mt-2 max-w-[60em] text-[14px]">{LESSONS[kind]}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {rows.map(({ t, a }) => (
                <div key={a.id} className="c-card pad flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <VerdictBadge attack={a} />
                    <Link href={`/t/${t.id}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                    <span className="c-faint text-[12.5px]">{dayTime(a.judged_at)}</span>
                  </div>
                  <p className="c-faint text-[13px]">Rule {t.broken_rule}: {t.rules.find((r) => r.number === t.broken_rule)?.text}</p>
                  <AttackText text={a.text} clamp />
                  {a.reason && <p className="c-muted text-[13.5px]">{a.reason}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3 text-[13px]">
                    <span className="mono">{gen(t.bounty)}</span>
                    <span className="c-faint">
                      to <Addr address={a.hunter} />
                    </span>
                    <Link href={`/a/${a.id}`} className="c-link ml-auto">
                      Read the reply
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
