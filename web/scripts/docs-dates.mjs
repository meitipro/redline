/**
 * Write lib/docs-dates.json: the date each docs page last changed in git.
 *
 *   node scripts/docs-dates.mjs
 *
 * The docs show "last updated" from this file. It is written from the
 * repository's history before a deploy and committed, because a deploy
 * uploaded without .git has no history to read at build time. A page with
 * changes not yet committed gets today's date.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const docs = path.join(root, 'content', 'docs');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.mdx') ? [p] : [];
  });
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const today = new Date().toISOString();
const out = {};
for (const file of walk(docs).sort()) {
  const rel = path.relative(docs, file).replace(/\\/g, '/');
  const dirty = git(['status', '--porcelain', '--', file]) !== '';
  const committed = git(['log', '-1', '--format=%cI', '--', file]);
  out[rel] = dirty || !committed ? today : committed;
}
fs.writeFileSync(path.join(root, 'lib', 'docs-dates.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`dated ${Object.keys(out).length} docs pages`);
