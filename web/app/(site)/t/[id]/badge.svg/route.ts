import { getTarget } from '@/lib/read';

/**
 * A README badge for one target, read from the chain: how many attacks its
 * instructions held, or which rule broke. Grey while it holds, red once broken,
 * the site's own two colours. Cached for five minutes.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Rough width of Geist-like text at 11 px; badges do not need exact metrics. */
const width = (s: string) => Math.round(s.length * 6.6 + 14);

function svg(left: string, right: string, broken: boolean): string {
  const lw = width(left);
  const rw = width(right);
  const bg = broken ? '#f87171' : '#34343f';
  const fg = broken ? '#1f0707' : '#ececf1';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
<title>${esc(left)}: ${esc(right)}</title>
<rect width="${lw}" height="20" rx="4" fill="#0b0b0e"/>
<rect x="${lw - 4}" width="${rw + 4}" height="20" rx="4" fill="${bg}"/>
<rect x="${lw - 4}" width="4" height="20" fill="${bg}"/>
<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14" fill="#f87171" text-anchor="middle" font-weight="bold">${esc(left)}</text>
<text x="${lw + rw / 2}" y="14" fill="${fg}" text-anchor="middle">${esc(right)}</text>
</g>
</svg>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let body: string;
  try {
    const t = await getTarget(id);
    if (!t.found) body = svg('redline', 'no such target', false);
    else if (t.status === 'BROKEN') body = svg('redline', `broken · rule ${t.broken_rule}`, true);
    else body = svg('redline', `held ${t.held} attack${t.held === 1 ? '' : 's'} · unbroken`, false);
  } catch {
    body = svg('redline', 'chain unavailable', false);
  }
  return new Response(body, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
