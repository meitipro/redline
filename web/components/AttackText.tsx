'use client';

import { useState } from 'react';

import { HARMFUL_WORDS } from '@/lib/policy.generated';
import { needsFilter } from '@/lib/target';

/**
 * Attack text under the content filter. Text that names a refused topic is
 * blurred until the reader asks to see it; long text is clamped with a click
 * to expand. The full text is always on chain and on the attack page.
 */
export function AttackText({ text, clamp = false }: { text: string; clamp?: boolean }) {
  const filtered = needsFilter(text, HARMFUL_WORDS);
  const long = clamp && text.length > 220;
  const [open, setOpen] = useState(!filtered && !long);
  const shown = open || !long ? text : text.slice(0, 220) + '…';
  return (
    <div className="flex flex-col items-start gap-1">
      <p className={`text-[14px] leading-relaxed whitespace-pre-wrap break-words ${filtered && !open ? 'c-blur' : ''}`}>&ldquo;{shown}&rdquo;</p>
      {!open && (
        <button className="c-link text-[12.5px]" onClick={() => setOpen(true)}>
          {filtered ? 'Filtered under the content policy. Show anyway' : 'Show all'}
        </button>
      )}
    </div>
  );
}
