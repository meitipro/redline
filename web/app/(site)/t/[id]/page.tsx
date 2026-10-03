import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AttackBox, BuilderBox, ClaimBox, JudgeButton } from '@/components/Actions';
import { CopyLink } from '@/components/CopyLink';
import { Addr, AttemptRow, Empty, Monogram, ReadError, StatusBadge, Tx, WithSlots, ruleDetail } from '@/components/ui';
import { latest, targetTxs } from '@/lib/explorer';
import { day, dayTime, gen, plural } from '@/lib/format';
import { allAttacks, getTarget, readError } from '@/lib/read';
import { lockLeft } from '@/lib/target';
import type { Attack, Target } from '@/lib/types';

export const revalidate = 20;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  try {
    const t = await getTarget(id);
    if (t.found) return { title: `${t.name}, target #${id}`, description: `${t.mode.toLowerCase()} mode, ${gen(t.bounty)} bounty, ${t.held} held attempts.` };
  } catch {
    /* fall through */
  }
  return { title: `Target #${id}` };
}

export default async function TargetPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  let t: Target | null = null;
  let attacks: Attack[] = [];
  let error = '';
  try {
    const got = await getTarget(id);
    if (!got.found) notFound();
    t = got;
    attacks = await allAttacks(id);
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    error = readError(e);
  }
  if (!t) {
    return (
      <div className="c-wrap py-14">
        <ReadError message={error} />
      </div>
    );
  }
  const txs = await targetTxs(id);
  const posted = latest(txs, 'create_target');
  const queued = attacks.filter((a) => a.status === 'QUEUED');
  const record = attacks.filter((a) => a.status !== 'QUEUED');

  return (
    <div className="c-wrap py-12">
      <p className="c-faint text-[13px]">
        <Link href="/#targets" className="hover:underline">
          Targets
        </Link>{' '}
        / {t.name}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <Monogram title={t.name} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="c-h2">{t.name}</h1>
          <p className="c-muted mt-1 text-[14px]">
            target #{t.id} · {t.mode.toLowerCase()} mode · posted {day(t.created_at)} by <Addr address={t.builder} />
            {posted && (
              <>
                {' '}
                · <Tx hash={posted.hash} label="post" />
              </>
            )}
          </p>
        </div>
        <StatusBadge target={t} />
        <CopyLink />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <section>
            <p className="c-eyebrow">Instructions (test version)</p>
            <div className="c-pre mt-3">
              <WithSlots text={t.instructions} />
            </div>
            {t.instructions.includes('{CANARY}') && (
              <p className="c-faint mt-2 text-[13px]">The canary slot is filled with a fresh 12-character value on every run, derived from the judging transaction and never stored.</p>
            )}
          </section>

          <section>
            <p className="c-eyebrow">Rules, and how they are checked</p>
            <div className="c-card mt-3 overflow-x-auto">
              <table className="c-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Rule</th>
                    <th>Check</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rules.map((r) => (
                    <tr key={r.number}>
                      <td className="mono">{r.number}</td>
                      <td>
                        <p>{r.text}</p>
                        <p className="c-faint mt-1 text-[12.5px]">{ruleDetail(r)}</p>
                      </td>
                      <td className="mono whitespace-nowrap text-[13px]">{r.check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {queued.length > 0 && (
            <section>
              <p className="c-eyebrow">Queued, waiting for a run</p>
              <div className="c-card mt-3 divide-y divide-[var(--line)]">
                {queued.map((a) => (
                  <div key={a.id}>
                    <AttemptRow a={a} />
                    <div className="px-4 pb-4">
                      <JudgeButton attack={a} targetOpen={t.status === 'OPEN'} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="c-eyebrow">Attempts, newest first</p>
            <div className="c-card mt-3 divide-y divide-[var(--line)]">
              {record.length ? record.map((a) => <AttemptRow key={a.id} a={a} />) : <div className="p-4"><Empty>No attempt has been judged yet.</Empty></div>}
            </div>
            <p className="c-faint mt-2 text-[12.5px]">
              An attack whose break did not reproduce across the validators&apos; models never reaches the record: the round
              ends without agreement, nothing is stored, and the attack stays queued.
            </p>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <div className="c-card pad flex flex-col gap-4">
            <div>
              <p className="c-eyebrow">Bounty</p>
              <p className="mono mt-1 text-[34px] font-medium">{gen(t.bounty)}</p>
              <p className="c-faint text-[13px]">
                {gen(t.posted)} posted{t.topups ? ` (${plural(t.topups, 'top-up')})` : ''} · {gen(t.fees_in)} from {plural(t.held, 'held attempt')}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-[14px]">
              <dt className="c-muted">Entry fee</dt>
              <dd className="mono text-right">{gen(t.entry_fee)}</dd>
              <dt className="c-muted">Locked until</dt>
              <dd className="mono text-right">{dayTime(t.lock_until)}</dd>
              <dt className="c-muted">Lock left</dt>
              <dd className="mono text-right">{t.status === 'OPEN' ? lockLeft(t.lock_until) : '—'}</dd>
              <dt className="c-muted">Held / rejected / void</dt>
              <dd className="mono text-right">
                {t.held} / {t.rejected} / {t.void}
              </dd>
              <dt className="c-muted">Queued, fees in escrow</dt>
              <dd className="mono text-right">
                {t.queued} · {gen(t.escrow)}
              </dd>
            </dl>
            {t.status === 'BROKEN' && (
              <div className="c-note accent">
                Broken on rule {t.broken_rule} by <Link href={`/a/${t.winning_attack}`} className="underline">attack #{t.winning_attack}</Link> on{' '}
                {dayTime(t.broken_at)}. {t.paid ? 'The hunter has claimed the bounty.' : 'The hunter can claim the bounty.'}
              </div>
            )}
            {t.status === 'CLOSED' && <div className="c-note">The builder reclaimed the unbroken bounty on {dayTime(t.paid_at)}.</div>}
          </div>

          <div className="c-card pad">
            <AttackBox target={t} />
          </div>
          <ClaimBox target={t} />
          <BuilderBox target={t} />
        </aside>
      </div>
    </div>
  );
}
