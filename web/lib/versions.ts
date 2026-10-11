import type { Attack, Target } from './types';

/**
 * Versions of a target. The contract has no notion of a version, so the site
 * reads one from what is on chain: targets posted by the same builder whose
 * names differ only by a trailing " v2", " v3" are versions of one agent, in
 * order. Nothing here is stored; a different builder using the same name starts
 * their own line.
 */

const SUFFIX = / v(\d{1,3})$/;

export function baseName(name: string): string {
  return name.replace(SUFFIX, '');
}

export function versionOf(name: string): number {
  const m = SUFFIX.exec(name);
  return m ? Number(m[1]) : 1;
}

/** The name for the next version: "Quill support bot" -> "Quill support bot v2". */
export function nextName(name: string, latest = versionOf(name)): string {
  return `${baseName(name)} v${latest + 1}`;
}

/** Every version of this target's agent, oldest first, including the target itself. */
export function lineage(t: Target, all: Target[]): Target[] {
  const base = baseName(t.name);
  return all
    .filter((o) => o.builder.toLowerCase() === t.builder.toLowerCase() && baseName(o.name) === base)
    .sort((a, b) => versionOf(a.name) - versionOf(b.name) || a.id - b.id);
}

export type Replay = {
  /** The break on an earlier version. */
  from: Attack;
  fromTarget: Target;
  /** The same text sent to this version, if anyone has; the newest such attempt. */
  here?: Attack;
};

/** Breaks of earlier versions, and what happened when the same attack was sent to this one. */
export function replays(t: Target, line: Target[], attacksByTarget: Map<number, Attack[]>): Replay[] {
  const mine = attacksByTarget.get(t.id) ?? [];
  const out: Replay[] = [];
  for (const earlier of line) {
    if (versionOf(earlier.name) >= versionOf(t.name) || earlier.id === t.id) continue;
    for (const a of attacksByTarget.get(earlier.id) ?? []) {
      if (a.status !== 'BROKEN') continue;
      const norm = a.text.trim();
      const here = mine.filter((m) => m.text.trim() === norm).sort((x, y) => y.id - x.id)[0];
      out.push({ from: a, fromTarget: earlier, here });
    }
  }
  return out;
}
