const GEN = 10n ** 18n;

/** Wei as GEN: 1,200 GEN, 0.5 GEN. Never through a float. */
export function gen(wei: string | bigint | number, unit = true): string {
  const value = BigInt(wei);
  const whole = value / GEN;
  const frac = value % GEN;
  let text = whole.toLocaleString('en-US');
  if (frac !== 0n) {
    const digits = frac.toString().padStart(18, '0').replace(/0+$/, '');
    text += '.' + digits.slice(0, 6);
  }
  return unit ? `${text} GEN` : text;
}

/** GEN typed by a person ("40", "0.5") to wei; null when it is not a number. */
export function toWei(text: string): bigint | null {
  const clean = text.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return BigInt(whole) * GEN + BigInt((frac + '0'.repeat(18)).slice(0, 18));
}

/** A member's cut of a funded amount: the contract's own integer arithmetic. */
export function shareOf(funded: string | bigint, pct: number): bigint {
  return (BigInt(funded) * BigInt(pct)) / 100n;
}

export function short(address: string, head = 6, tail = 4): string {
  if (!address) return '';
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function shortHash(hash: string): string {
  return hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Chain seconds as "Sep 24, 2026", in UTC so server and browser agree. */
export function day(seconds: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Sep 22, 18:04 UTC". */
export function dayTime(seconds: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

export function firstWords(text: string, count = 9): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= count ? text : words.slice(0, count).join(' ') + '…';
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** "TK" from "Team Kiln, hackathon prize". */
export function initials(title: string): string {
  const words = title.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || 'P';
}
