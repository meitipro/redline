/**
 * Fail the docs build on a broken internal link.
 *
 *   node scripts/check-links.mjs
 *
 * Reads every page under content/docs, collects Markdown links and href
 * attributes that point inside the site, and checks each one: /docs/... must
 * be a page (or the folder index), and site routes must be routes this app
 * serves. A #fragment on a docs link must match a heading on that page.
 * Runs before `next build`, so a broken link stops the deploy.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const docs = path.join(root, 'content', 'docs');

/** Routes outside /docs that the site serves. Dynamic ones are prefixes. */
const SITE = ['/', '/hall', '/new', '/me', '/llms.txt', '/llms-full.txt'];
const SITE_PREFIXES = ['/t/', '/a/', '/#'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.mdx') ? [p] : [];
  });
}

function slugOf(file) {
  const rel = path.relative(docs, file).replace(/\\/g, '/').replace(/\.mdx$/, '');
  return rel === 'index' ? '' : rel.replace(/\/index$/, '');
}

function headings(text) {
  const ids = new Set();
  for (const line of text.split('\n')) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (!m) continue;
    const id = m[1]
      .toLowerCase()
      .replace(/[`*_]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    ids.add(id);
  }
  return ids;
}

const pages = new Map(walk(docs).map((f) => [slugOf(f), fs.readFileSync(f, 'utf8')]));
const problems = [];

for (const [slug, text] of pages) {
  const withoutCode = text.replace(/```[\s\S]*?```/g, '');
  const links = [
    ...[...withoutCode.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]),
    ...[...withoutCode.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]),
  ];
  for (const link of links) {
    const [pathname, fragment] = link.split('#');
    if (pathname.startsWith('/docs')) {
      const target = pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '');
      if (!pages.has(target)) {
        problems.push(`${slug || 'index'}: ${link} is not a docs page`);
      } else if (fragment && !headings(pages.get(target)).has(fragment)) {
        problems.push(`${slug || 'index'}: ${link} has no heading #${fragment}`);
      }
      continue;
    }
    const ok = SITE.includes(pathname) || SITE_PREFIXES.some((p) => link.startsWith(p));
    if (!ok) problems.push(`${slug || 'index'}: ${link} is not a route of this site`);
  }
}

if (problems.length) {
  console.error(`broken internal links:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`internal links ok across ${pages.size} docs pages`);
