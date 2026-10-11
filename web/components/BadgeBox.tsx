'use client';

import { useState } from 'react';

import { SITE_URL } from '@/lib/shared';
import type { Target } from '@/lib/types';

/** The target's README badge and the Markdown to paste, with a copy button. */
export function BadgeBox({ target }: { target: Target }) {
  const [done, setDone] = useState(false);
  // The public address, the same on the server and in the browser: a badge is pasted elsewhere.
  const origin = SITE_URL;
  const markdown = `[![Redline](${origin}/t/${target.id}/badge.svg)](${origin}/t/${target.id})`;
  return (
    <div className="c-card pad flex flex-col gap-3">
      <p className="c-eyebrow">Badge for your README</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/t/${target.id}/badge.svg`} alt="Redline badge for this target" height={20} style={{ height: 20, width: 'auto', alignSelf: 'flex-start' }} />
      <p className="c-faint text-[13px]">Read from the chain: the attacks this test version held, or the rule that broke.</p>
      <code className="mono break-all text-[12px] c-muted">{markdown}</code>
      <button
        className="c-btn small self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          } catch {
            /* clipboard blocked; the text is on the page */
          }
        }}
      >
        {done ? 'Copied' : 'Copy Markdown'}
      </button>
    </div>
  );
}
