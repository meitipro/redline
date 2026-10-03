import Link from 'next/link';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { REPO_URL } from '@/lib/shared';

import { Mark } from './Nav';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--line)]">
      <div className="c-wrap grid gap-8 py-10 text-[14px] md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="c-brand">
            <Mark size={22} />
            <span className="c-word">Redline</span>
          </p>
          <p className="c-muted mt-3 max-w-[34em] text-[13.5px] leading-relaxed">
            Bounties for breaking your agent&apos;s rules. Redline tests a posted version of an agent&apos;s instructions on
            the models GenLayer validators run, not on your own model and tools. A hold across several models is a strong
            signal, not a certificate. Everything here is public: never post a real secret.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="c-eyebrow">The contract</p>
          <a className="c-link mono break-all text-[12.5px]" href={`${DEPLOYMENT.explorer}/address/${DEPLOYMENT.redline}`} target="_blank" rel="noreferrer">
            {DEPLOYMENT.redline}
          </a>
          <span className="c-faint text-[13px]">GenLayer Studio Next · chain {DEPLOYMENT.chainId}</span>
        </div>
        <div className="flex flex-col gap-2">
          <p className="c-eyebrow">Links</p>
          <Link href="/docs" className="c-muted hover:text-[var(--ink)]">Docs</Link>
          <Link href="/docs/more/evaluation" className="c-muted hover:text-[var(--ink)]">Evaluation results</Link>
          <Link href="/hall" className="c-muted hover:text-[var(--ink)]">Hall of breaks</Link>
          <a href={REPO_URL} className="c-muted hover:text-[var(--ink)]" target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/llms.txt" className="c-muted hover:text-[var(--ink)]">llms.txt</Link>
        </div>
      </div>
    </footer>
  );
}
