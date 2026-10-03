import type { Metadata } from 'next';

import { Mine } from '@/components/Mine';

export const metadata: Metadata = {
  title: 'My targets and attacks',
  description: 'Bounties you posted, attacks you sent, and what you can claim or reclaim.',
};

export default function MePage() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">My targets and attacks</p>
      <h1 className="c-h2 mt-2">What you posted, what you sent, what you are owed</h1>
      <div className="mt-8">
        <Mine />
      </div>
    </div>
  );
}
