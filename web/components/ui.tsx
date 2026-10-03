import Link from 'next/link';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { dayTime, gen, initials, plural, short, shortHash } from '@/lib/format';
import { lockLeft, statusLabel, verdictLabel } from '@/lib/target';
import type { Attack, Rule, Target } from '@/lib/types';

import { AttackText } from './AttackText';

export const EXPLORER = DEPLOYMENT.explorer as string;
export const CONTRACT = DEPLOYMENT.redline as string;
export const SLOT = '{CANARY}';

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function Tx({ hash, label }: { hash: string; label?: string }) {
  if (!hash) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label ? `${label} ` : ''}
      {shortHash(hash)} ↗
    </a>
  );
}

export function Addr({ address }: { address: string }) {
  if (!address) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={addressUrl(address)} target="_blank" rel="noreferrer" title={address}>
      {short(address)}
    </a>
  );
}

/** Red for a break, grey for everything else. */
export function VerdictBadge({ attack }: { attack: Pick<Attack, 'status' | 'rule'> }) {
  const cls = attack.status === 'BROKEN' ? 'broken' : attack.status === 'HELD' ? 'held' : 'quiet';
  return <span className={`c-verdict ${cls}`}>{verdictLabel(attack)}</span>;
}

export function StatusBadge({ target }: { target: Pick<Target, 'status' | 'broken_rule'> }) {
  return <span className={`c-verdict ${target.status === 'BROKEN' ? 'broken' : target.status === 'OPEN' ? 'held' : 'quiet'}`}>{statusLabel(target)}</span>;
}

export function Monogram({ title, size = 36 }: { title: string; size?: number }) {
  return (
    <span
      className="mono inline-grid shrink-0 place-items-center font-semibold"
      style={{ width: size, height: size, borderRadius: 'var(--radius)', background: 'var(--surface-3)', border: '1px solid var(--line-strong)', fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(title)}
    </span>
  );
}

/** Text with every {CANARY} slot drawn as a highlighted chip. */
export function WithSlots({ text, label = 'CANARY' }: { text: string; label?: string }) {
  const parts = text.split(SLOT);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="c-slot">{`{${label}}`}</span>}
        </span>
      ))}
    </>
  );
}

/** One rule as the site shows it: what it says, and how it is checked. */
export function ruleDetail(rule: Rule): string {
  if (rule.kind === 'action') {
    const unit = rule.unit ? ` ${rule.unit}` : '';
    const allow = rule.allowlist?.length ? `, recipients: ${rule.allowlist.map((a) => (a.startsWith('0x') && a.length === 42 ? short(a) : a)).join(', ')}` : ', any recipient';
    return `at most ${rule.max_amount}${unit} per action${allow}`;
  }
  if (rule.kind === 'secret') return 'the run fails if the reply contains this run\'s canary';
  return 'the scope judge decides, word for word from the spec';
}

/** The live target card on the landing page: bounty, held count and lock, the three things a hunter decides on. */
export function TargetCard({ t, recent }: { t: Target; recent: Attack[] }) {
  return (
    <Link href={`/t/${t.id}`} className="c-card block p-5 transition-colors hover:border-[var(--line-strong)]">
      <div className="flex items-start gap-3">
        <Monogram title={t.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{t.name}</p>
          <p className="c-faint text-[13px]">
            target #{t.id} · {t.mode.toLowerCase()} mode · {plural(t.rules.length, 'rule')}
          </p>
        </div>
        <StatusBadge target={t} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="mono text-[24px] font-medium">{gen(t.bounty, false)}</p>
          <p className="c-eyebrow mt-1">Bounty, GEN</p>
        </div>
        <div>
          <p className="mono text-[24px] font-medium">{t.held}</p>
          <p className="c-eyebrow mt-1">Held</p>
        </div>
        <div>
          <p className="mono text-[24px] font-medium">{t.status === 'OPEN' ? lockLeft(t.lock_until) : '—'}</p>
          <p className="c-eyebrow mt-1">Lock left</p>
        </div>
      </div>
      <ol className="mt-5 flex flex-col gap-1.5 text-[14px]">
        {t.rules.map((r) => (
          <li key={r.number} className="c-muted">
            {r.number}. {r.text}
          </li>
        ))}
      </ol>
      {recent.length > 0 && (
        <div className="mt-5 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
          {recent.slice(0, 3).map((a) => (
            <div key={a.id} className="flex items-start gap-3 text-[13.5px]">
              <VerdictBadge attack={a} />
              <span className="c-muted min-w-0 flex-1 truncate">&ldquo;{a.text}&rdquo;</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

/** One attempt in a record: verdict, the attack behind a filter, when, and a link to the attack page. */
export function AttemptRow({ a, showTarget = false }: { a: Attack; showTarget?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerdictBadge attack={a} />
        {showTarget && (
          <Link href={`/t/${a.target_id}`} className="font-medium hover:underline">
            {a.target_name}
          </Link>
        )}
        <span className="c-faint text-[12.5px]">
          attack #{a.id} · {dayTime(a.judged_at || a.submitted_at)} · <Addr address={a.hunter} />
        </span>
        <Link href={`/a/${a.id}`} className="c-link ml-auto text-[13px]">
          Open
        </Link>
      </div>
      <AttackText text={a.text} clamp />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="c-note">{children}</div>;
}

export function ReadError({ message }: { message: string }) {
  return (
    <div className="c-card pad">
      <p className="font-medium">The chain did not answer.</p>
      <p className="c-muted mt-1 text-[14px]">{message}</p>
    </div>
  );
}
