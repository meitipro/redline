import { unstable_cache } from 'next/cache';

import { CONTRACT, readClient, retried } from './genlayer-core.mjs';
import type { Attack, AttackPage, NotFound, Target, TargetPage } from './types';

/**
 * Reads happen on the server, cached for a short while under tags.
 *
 * Studio Next rate-limits each IP, and every visitor's page view would
 * otherwise spend the server's budget. Shared reads are cached for 20 seconds;
 * after a decided write the page POSTs /api/refresh, which expires the tags it
 * touched, so the person who wrote sees their own result at once.
 */

const client = readClient();
const REVALIDATE = 20;

async function view<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => client.readContract({ address: CONTRACT, functionName: method, args }), 3);
  return JSON.parse(String(raw)) as T;
}

export const tags = {
  targets: 'targets',
  attacks: 'attacks',
  target: (id: number) => `target:${id}`,
  attack: (id: number) => `attack:${id}`,
};

export function getTarget(id: number): Promise<(Target & { found: true }) | NotFound> {
  return unstable_cache(() => view<(Target & { found: true }) | NotFound>('get_target', [id]), ['get_target', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.targets, tags.target(id)],
  })();
}

export function getAttack(id: number): Promise<(Attack & { found: true }) | NotFound> {
  return unstable_cache(() => view<(Attack & { found: true }) | NotFound>('get_attack', [id]), ['get_attack', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.attacks, tags.attack(id)],
  })();
}

export function listTargets(status = '', offset = 0, limit = 50): Promise<TargetPage> {
  return unstable_cache(() => view<TargetPage>('list_targets', [status, offset, limit]), ['list_targets', status, String(offset), String(limit)], {
    revalidate: REVALIDATE,
    tags: [tags.targets],
  })();
}

/** One target's attempt record, or every attack on every target when target is 0. */
export function listAttacks(target = 0, offset = 0, limit = 50): Promise<AttackPage> {
  return unstable_cache(() => view<AttackPage>('list_attacks', [target, offset, limit]), ['list_attacks', String(target), String(offset), String(limit)], {
    revalidate: REVALIDATE,
    tags: [tags.attacks, tags.targets],
  })();
}

/** Every target with one status ('' for all), newest first, in pages of fifty. */
export async function allTargets(status = ''): Promise<Target[]> {
  const first = await listTargets(status, 0, 50);
  const items = [...first.items];
  for (let offset = 50; offset < first.total; offset += 50) items.push(...(await listTargets(status, offset, 50)).items);
  return items;
}

/** Every attack on one target (or on all, for 0), newest first. */
export async function allAttacks(target = 0): Promise<Attack[]> {
  const first = await listAttacks(target, 0, 50);
  const items = [...first.items];
  for (let offset = 50; offset < first.total; offset += 50) items.push(...(await listAttacks(target, offset, 50)).items);
  return items;
}

/** Targets posted by the golden set in eval/ and by the site's own tests, which the front page leaves out of the hero. */
export function isTest(t: { name: string }): boolean {
  return /, (weak|strong|medium)$/.test(t.name) || /^(Reviewer path|Docs example)/.test(t.name);
}

/** A read failed: say so in one sentence rather than failing the page. */
export function readError(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (/-32029|rate limit/i.test(text)) return 'Studio Next is rate limiting reads right now. Wait a minute and reload.';
  return 'Studio Next did not answer this read. Reload in a moment.';
}
