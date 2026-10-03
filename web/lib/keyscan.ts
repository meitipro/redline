import { CANARY_LENGTH, HARMFUL_WORDS, KEY_PATTERNS, MAX_ATTACK } from './policy.generated';

/**
 * The checks the contract runs, run first in the browser so nobody pays for a
 * refused post or a rejected attack. The lists come from contracts/redline.py
 * through scripts/gen_docs.py; the contract runs them again on chain.
 */

/** Strings in the text shaped like real credentials, as found. */
export function keysIn(text: string): string[] {
  const found: string[] = [];
  for (const pattern of KEY_PATTERNS) {
    const match = text.match(pattern);
    if (match) found.push(match[0].length > 18 ? match[0].slice(0, 10) + '…' : match[0]);
  }
  return found;
}

/** The first refused topic word in the text, or ''. */
export function harmfulWord(text: string): string {
  const lower = text.toLowerCase();
  for (const word of HARMFUL_WORDS) {
    if (new RegExp(`\\b${word.replace(/[-]/g, '\\-')}\\b`).test(lower)) return word;
  }
  return '';
}

/** Runs of exactly twelve ASCII letters and digits with at least one of each, the shape of every canary. */
export function canaryShaped(text: string): string[] {
  return (text.match(/[A-Za-z0-9]+/g) ?? []).filter((t) => t.length === CANARY_LENGTH && /\d/.test(t) && /[A-Za-z]/.test(t));
}

export { HARMFUL_WORDS, MAX_ATTACK };
