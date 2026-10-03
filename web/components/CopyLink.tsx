'use client';

import { useState } from 'react';

/** Copies a link to this site: the given path on the current origin, or the page itself. */
export function CopyLink({ path, label = 'Copy link' }: { path?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="c-btn small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(path ? window.location.origin + path : window.location.href);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked; the address bar still has it */
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}
