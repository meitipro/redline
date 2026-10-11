import { NextResponse } from 'next/server';

import { dataset } from '@/lib/dataset';
import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';

/** Every judged attempt, as JSON: the Hall of breaks export. */
export async function GET() {
  const rows = await dataset();
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return NextResponse.json(
    {
      contract: DEPLOYMENT.redline,
      network: 'GenLayer Studio Next, chain 61997',
      explorer: DEPLOYMENT.explorer,
      generated_at: new Date().toISOString(),
      note: 'Every judged attempt on the deployed contract, read from the chain. Replies are the leader run, cut to 400 characters; a canary is stored as {CANARY}.',
      counts,
      attempts: rows,
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
