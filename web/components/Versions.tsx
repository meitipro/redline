'use client';

import Link from 'next/link';

import type { Target } from '@/lib/types';
import type { Replay } from '@/lib/versions';

import { AttackText } from './AttackText';

/** Fill the attack box on this page with a text, and bring it into view. */
function prefill(text: string) {
  window.dispatchEvent(new CustomEvent('redline:prefill', { detail: text }));
}

const label = (status: string, rule: number) => (status === 'BROKEN' ? `Broken · rule ${rule}` : status.charAt(0) + status.slice(1).toLowerCase());

/**
 * The version line of a target, and the breaks of earlier versions replayed
 * against this one. A patch is only as good as the attacks it now holds.
 */
export function VersionPanel({ t, line, replays, version }: { t: Target; line: Target[]; replays: Replay[]; version: number }) {
  if (line.length < 2) return null;
  const later = line.filter((o) => o.id !== t.id && o.id > t.id);
  return (
    <section>
      <p className="c-eyebrow">Versions</p>
      <div className="c-card mt-3 flex flex-col gap-4 p-4">
        <ol className="flex flex-wrap gap-2 text-[13.5px]">
          {line.map((o, i) => (
            <li key={o.id}>
              <Link
                href={`/t/${o.id}`}
                className={`c-pill ${o.id === t.id ? 'text-[var(--ink)]' : ''}`}
                style={o.id === t.id ? { borderColor: 'var(--ink-3)' } : undefined}
              >
                v{i + 1} · #{o.id} · {o.status === 'BROKEN' ? `broken on rule ${o.broken_rule}` : o.status === 'CLOSED' ? 'closed' : `${o.held} held`}
              </Link>
            </li>
          ))}
        </ol>
        {later.length > 0 && (
          <p className="c-muted text-[14px]">
            The builder patched this agent and posted{' '}
            {later.map((o, i) => (
              <span key={o.id}>
                {i ? ', ' : ''}
                <Link className="c-link" href={`/t/${o.id}`}>
                  {o.name}
                </Link>
              </span>
            ))}
            . Its page replays the breaks found here.
          </p>
        )}
        {version > 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-[14.5px] font-medium">Breaks of earlier versions, replayed here</p>
            {replays.length === 0 && <p className="c-muted text-[14px]">No earlier version was broken.</p>}
            {replays.map((r) => (
              <div key={r.from.id} className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
                <p className="c-faint text-[12.5px]">
                  Broke{' '}
                  <Link className="c-link" href={`/a/${r.from.id}`}>
                    {r.fromTarget.name} (attack #{r.from.id})
                  </Link>{' '}
                  on rule {r.from.rule}
                </p>
                <AttackText text={r.from.text} clamp />
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  {r.here ? (
                    <>
                      <span className={`c-verdict ${r.here.status === 'BROKEN' ? 'broken' : r.here.status === 'HELD' ? 'held' : 'quiet'}`}>
                        Here: {label(r.here.status, r.here.rule)}
                      </span>
                      <Link className="c-link" href={`/a/${r.here.id}`}>
                        attack #{r.here.id}
                      </Link>
                    </>
                  ) : (
                    <span className="c-faint">Not tried on this version yet.</span>
                  )}
                  {t.status === 'OPEN' && (
                    <button className="c-btn small ml-auto" onClick={() => prefill(r.from.text)}>
                      Replay this attack
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
