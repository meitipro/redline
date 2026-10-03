import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClaimBox, JudgeButton } from '@/components/Actions';
import { AttackText } from '@/components/AttackText';
import { CopyLink } from '@/components/CopyLink';
import { Addr, ReadError, Tx, VerdictBadge } from '@/components/ui';
import { attackTxs, latest } from '@/lib/explorer';
import { dayTime, gen } from '@/lib/format';
import { getAttack, getTarget, readError } from '@/lib/read';
import { KIND_NAMES, LESSONS } from '@/lib/target';
import type { Attack, Rule, Target } from '@/lib/types';

export const revalidate = 20;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  try {
    const a = await getAttack(id);
    if (a.found) return { title: `Attack #${id} on ${a.target_name}`, description: `${a.status === 'BROKEN' ? `Broken on rule ${a.rule}` : a.status.toLowerCase()}.` };
  } catch {
    /* fall through */
  }
  return { title: `Attack #${id}` };
}

/**
 * The leader's reply with what broke the rule highlighted: the canary slot for
 * a secret rule; for an action rule, amounts above the limit and recipients off
 * the allowlist inside the reply's JSON.
 */
function Reply({ text, rule }: { text: string; rule?: Rule }) {
  const marks: { start: number; end: number }[] = [];
  const add = (re: RegExp, keep: (m: RegExpExecArray) => boolean, group = 0) => {
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (!keep(m)) continue;
      const start = m.index + m[0].indexOf(m[group]);
      marks.push({ start, end: start + m[group].length });
    }
  };
  add(/\{CANARY\}/g, () => true);
  if (rule?.kind === 'action') {
    const limit = Number(rule.max_amount);
    const allow = (rule.allowlist ?? []).map((a) => a.toLowerCase());
    add(/"amount"\s*:\s*"?([0-9][0-9.,]*)/g, (m) => Number(m[1].replace(/,/g, '')) > limit, 1);
    if (allow.length) add(/"to"\s*:\s*"([^"]*)"/g, (m) => !allow.includes(m[1].trim().toLowerCase()), 1);
  }
  marks.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const { start, end } of marks) {
    if (start < at) continue;
    out.push(text.slice(at, start));
    out.push(
      <mark key={start} className="c-hit">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  out.push(text.slice(at));
  return <div className="c-pre">{out}</div>;
}

export default async function AttackPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  let a: Attack | null = null;
  let t: Target | null = null;
  let error = '';
  try {
    const got = await getAttack(id);
    if (!got.found) notFound();
    a = got;
    const target = await getTarget(got.target_id);
    t = target.found ? target : null;
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    error = readError(e);
  }
  if (!a || !t) {
    return (
      <div className="c-wrap py-14">
        <ReadError message={error || 'The target of this attack could not be read.'} />
      </div>
    );
  }
  const txs = await attackTxs(id);
  const sent = latest(txs, 'attack');
  const judged = latest(txs, 'judge');
  const rule = a.rule ? t.rules.find((r) => r.number === a.rule) : undefined;
  const winner = t.status === 'BROKEN' && t.winning_attack === a.id;

  return (
    <div className="c-wrap py-12">
      <p className="c-faint text-[13px]">
        <Link href="/#targets" className="hover:underline">
          Targets
        </Link>{' '}
        /{' '}
        <Link href={`/t/${t.id}`} className="hover:underline">
          {t.name}
        </Link>{' '}
        / Attack #{a.id}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <VerdictBadge attack={a} />
        <span className="c-muted text-[14px]">
          {a.status === 'QUEUED'
            ? `sent ${dayTime(a.submitted_at)}, waiting for a run`
            : a.status === 'REJECTED'
              ? `rejected ${dayTime(a.judged_at)} by the exact checks, before any model ran`
              : a.status === 'VOID'
                ? `void since ${dayTime(a.judged_at)}`
                : `judged ${dayTime(a.judged_at)} · consensus reached`}
        </span>
        <span className="ml-auto">
          <CopyLink />
        </span>
      </div>
      {rule && <p className="c-h3 mt-4">Rule {rule.number}: {rule.text}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <p className="c-eyebrow">Attack</p>
            <div className="c-card pad mt-3">
              <AttackText text={a.text} />
            </div>
            <p className="c-faint mt-2 text-[13px]">
              Attack #{a.number} on this target, sent by <Addr address={a.hunter} /> for {gen(a.fee)}.
            </p>
          </section>

          {a.reply && (
            <section>
              <p className="c-eyebrow">Reply, from the leader&apos;s run</p>
              <div className="mt-3">
                <Reply text={a.reply} rule={rule} />
              </div>
              <p className="c-faint mt-2 text-[13px]">
                Cut to 400 characters by the contract. Each validator ran the agent on its own model and produced its own reply;
                only the leader&apos;s is stored. Where the canary appeared it is stored as the slot, never as itself.
              </p>
            </section>
          )}

          {a.reason && (
            <section>
              <p className="c-eyebrow">Why</p>
              <p className="mt-3 text-[16px] leading-relaxed">{a.reason}</p>
              {a.status === 'BROKEN' && rule && rule.kind !== 'scope' && (
                <p className="c-faint mt-2 text-[13px]">Every validator&apos;s run broke this rule, checked by exact code on each run.</p>
              )}
            </section>
          )}

          {a.status === 'QUEUED' && <JudgeButton attack={a} targetOpen={t.status === 'OPEN'} />}

          <section className="flex flex-wrap gap-x-6 gap-y-2">
            {sent && <Tx hash={sent.hash} label="Attack tx" />}
            {judged && <Tx hash={judged.hash} label="Judged tx" />}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {a.status === 'BROKEN' && (
            <div className="c-card pad flex flex-col gap-3">
              <p className="c-eyebrow">Payout</p>
              <p className="mono text-[32px] font-medium" style={{ color: 'var(--accent)' }}>
                {gen(t.bounty)}
              </p>
              <p className="c-muted text-[14px]">
                to <Addr address={a.hunter} />, the hunter{winner && t.paid ? ', claimed' : ''}
              </p>
              <ClaimBox target={t} />
            </div>
          )}
          {a.status === 'BROKEN' && rule && (
            <div className="c-card pad">
              <p className="c-eyebrow">What the builder learns</p>
              <p className="mt-2 text-[14.5px] leading-relaxed">{LESSONS[rule.kind]}</p>
              <p className="c-faint mt-2 text-[12.5px]">General guidance for a {KIND_NAMES[rule.kind].toLowerCase()} rule; the attack and reply above are the specific lesson.</p>
            </div>
          )}
          {(a.status === 'REJECTED' || a.status === 'VOID') && (
            <div className="c-card pad flex flex-col gap-3">
              <p className="c-eyebrow">Entry fee</p>
              <p className="text-[14px]">{a.refunded ? `Refunded: ${gen(a.fee)}.` : `${gen(a.fee)} is refundable to the hunter through Claim.`}</p>
              {!a.refunded && <ClaimBox target={t} />}
            </div>
          )}
          <dl className="c-card pad grid grid-cols-2 gap-y-2 text-[14px]">
            <dt className="c-muted">Target status</dt>
            <dd className="text-right">{t.status === 'BROKEN' ? 'Broken, closed' : t.status === 'CLOSED' ? 'Reclaimed, closed' : 'Open'}</dd>
            <dt className="c-muted">Later attacks</dt>
            <dd className="text-right">{t.status === 'OPEN' ? 'Still judged' : 'Void, refunded'}</dd>
            <dt className="c-muted">Judged by</dt>
            <dd className="text-right">{a.judged_by ? <Addr address={a.judged_by} /> : '—'}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
