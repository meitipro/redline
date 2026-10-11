import { unstable_cache } from 'next/cache';

import { attackTxs, latest } from './explorer';
import { DEPLOYMENT } from './genlayer-core.mjs';
import { allAttacks, allTargets } from './read';

/**
 * The Hall of breaks export: every judged attempt on the deployed contract, held,
 * broken, rejected or void, with the target it was sent at and the transactions
 * behind it. Read from the chain and the explorer, never from a copy, so the
 * dataset is the record.
 */

export type Row = {
  attack_id: number;
  /** golden-eval, reviewer-path, practice or open: where the attempt came from, by the target's name. */
  set: string;
  target_id: number;
  target_name: string;
  mode: string;
  /** The builder's test instructions, with the {CANARY} slot as posted. */
  instructions: string;
  /** The posted rules as JSON text. */
  rules: string;
  attack: string;
  status: string;
  verdict: string;
  rule: number;
  rule_kind: string;
  reason: string;
  /** The leader's reply, cut to 400 characters by the contract; the canary stored as {CANARY}. */
  reply: string;
  hunter: string;
  fee_wei: string;
  submitted_at: string;
  judged_at: string;
  attack_tx: string;
  judge_tx: string;
  page: string;
};

export const FIELDS: (keyof Row)[] = [
  'attack_id', 'set', 'target_id', 'target_name', 'mode', 'instructions', 'rules', 'attack', 'status', 'verdict', 'rule',
  'rule_kind', 'reason', 'reply', 'hunter', 'fee_wei', 'submitted_at', 'judged_at', 'attack_tx', 'judge_tx', 'page',
];

function setOf(name: string): string {
  if (/, (weak|strong|medium)$/.test(name)) return 'golden-eval';
  if (name.startsWith('Reviewer path')) return 'reviewer-path';
  if (name.startsWith('Practice target')) return 'practice';
  return 'open';
}

const iso = (s: number) => (s ? new Date(s * 1000).toISOString() : '');

async function build(): Promise<Row[]> {
  const targets = new Map((await allTargets('')).map((t) => [t.id, t]));
  const attacks = (await allAttacks(0)).filter((a) => a.status !== 'QUEUED').sort((a, b) => a.id - b.id);
  const rows: Row[] = [];
  for (const a of attacks) {
    const t = targets.get(a.target_id);
    if (!t) continue;
    const txs = await attackTxs(a.id);
    rows.push({
      attack_id: a.id,
      set: setOf(t.name),
      target_id: t.id,
      target_name: t.name,
      mode: t.mode,
      instructions: t.instructions,
      rules: JSON.stringify(t.rules.map(({ number, kind, text, max_amount, allowlist, unit }) => ({ number, kind, text, max_amount, allowlist, unit }))),
      attack: a.text,
      status: a.status,
      verdict: a.verdict,
      rule: a.rule,
      rule_kind: a.rule ? (t.rules.find((r) => r.number === a.rule)?.kind ?? '') : '',
      reason: a.reason,
      reply: a.reply,
      hunter: a.hunter,
      fee_wei: a.fee,
      submitted_at: iso(a.submitted_at),
      judged_at: iso(a.judged_at),
      attack_tx: latest(txs, 'attack')?.hash ?? '',
      judge_tx: latest(txs, 'judge')?.hash ?? '',
      page: `/a/${a.id}`,
    });
  }
  return rows;
}

/** The dataset, cached for a minute under the same tags as the reads it is made of. */
export const dataset = unstable_cache(build, ['hall-dataset', DEPLOYMENT.redline], { revalidate: 60, tags: ['attacks', 'targets', 'txs'] });

export function toCsv(rows: Row[]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [FIELDS.join(','), ...rows.map((r) => FIELDS.map((f) => cell(r[f])).join(','))].join('\n') + '\n';
}
