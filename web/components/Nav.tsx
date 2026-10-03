import Link from 'next/link';

import { WalletButton } from './Wallet';

/** The site's mark, the same drawing as docs/brand/redline-icon.svg without its ground: a page of rules with one line broken in red. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="106 106 300 300" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="106" y="106" width="300" height="300" rx="46" fill="#17171e" stroke="#34343f" strokeWidth="8" />
      <rect x="156" y="171" width="200" height="26" rx="6" fill="#74747f" />
      <rect x="156" y="243" width="82" height="26" rx="6" fill="#f87171" />
      <rect x="262" y="243" width="94" height="26" rx="6" fill="#f87171" />
      <rect x="156" y="315" width="150" height="26" rx="6" fill="#74747f" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="c-nav">
      <div className="c-wrap c-nav-row">
        <Link href="/" className="c-brand" aria-label="Redline home">
          <Mark />
          <span className="c-word">Redline</span>
        </Link>
        <nav className="c-links" aria-label="Main">
          <Link href="/#targets">Targets</Link>
          <Link href="/hall">Hall of breaks</Link>
          <Link href="/docs/post-a-target">For builders</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div className="c-nav-right">
          <span className="c-pill hidden sm:inline-flex" title="GenLayer Studio Next, chain 61997">
            <span className="dot" />
            Studio Next
          </span>
          <WalletButton />
          <Link href="/new" className="c-btn small solid hidden sm:inline-flex">
            Post a target
          </Link>
        </div>
      </div>
    </header>
  );
}
