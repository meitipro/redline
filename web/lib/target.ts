import type { Attack, Kind, Target } from './types';

/** "BROKEN · RULE 2", "HELD", "REJECTED", "VOID", "QUEUED". */
export function verdictLabel(a: Pick<Attack, 'status' | 'rule'>): string {
  if (a.status === 'BROKEN') return `Broken · rule ${a.rule}`;
  return a.status.charAt(0) + a.status.slice(1).toLowerCase();
}

export function statusLabel(t: Pick<Target, 'status' | 'broken_rule'>): string {
  if (t.status === 'BROKEN') return `Broken · rule ${t.broken_rule}`;
  if (t.status === 'CLOSED') return 'Closed';
  return 'Open';
}

export const KIND_NAMES: Record<Kind, string> = { secret: 'Secret', action: 'Action', scope: 'Scope' };

/** What a hunter is owed on one target: refundable fees of their attacks, and the bounty if their attack broke it. */
export function owedTo(target: Target, attacks: Attack[], account: string): bigint {
  if (!account) return 0n;
  const me = account.toLowerCase();
  let due = 0n;
  for (const a of attacks) {
    if (a.hunter.toLowerCase() === me && a.refundable) due += BigInt(a.fee);
  }
  if (target.status === 'BROKEN' && !target.paid && target.winner.toLowerCase() === me) due += BigInt(target.bounty);
  return due;
}

/** "4d", "11h", "ended", from the chain's lock and the reader's clock. */
export function lockLeft(lockUntil: number, now = Math.floor(Date.now() / 1000)): string {
  const left = lockUntil - now;
  if (left <= 0) return 'ended';
  if (left >= 86400) return `${Math.floor(left / 86400)}d`;
  if (left >= 3600) return `${Math.floor(left / 3600)}h`;
  return `${Math.max(1, Math.floor(left / 60))}m`;
}

/**
 * General guidance for each kind of break. Fixed text per rule kind, not a
 * reading of this attack: the attack and the reply are on the page to learn from.
 */
export const LESSONS: Record<Kind, string> = {
  secret:
    'A secret the model can see is a secret the model can be talked into repeating. Keep real secrets out of the prompt entirely, or check outputs for them in code before anything reaches a user.',
  action:
    'The model produced an action the posted limits forbid. Enforce amounts and recipients in code outside the model, and treat instructions about limits as hints, not controls.',
  scope:
    'The reply left the posted scope. Restate the scope at the end of the instructions, give the model a fixed refusal, and route off-topic requests away in code where you can.',
};

/** Words in attack text the site hides until a reader asks to see them. */
export function needsFilter(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
}
