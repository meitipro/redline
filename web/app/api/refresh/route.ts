import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * After a decided write the page posts the tags that write touched, and they
 * expire now, so the writer sees their own result on the next render instead
 * of a read up to 20 seconds old. Only the site's own tag shapes are accepted.
 */
const ALLOWED = /^(targets|attacks|txs|target:\d{1,9}|attack:\d{1,9})$/;

export async function POST(request: Request) {
  let tags: unknown = [];
  try {
    tags = (await request.json())?.tags ?? [];
  } catch {
    /* empty */
  }
  const list = (Array.isArray(tags) ? tags : []).map(String).filter((t) => ALLOWED.test(t)).slice(0, 20);
  for (const tag of new Set([...list, 'txs'])) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ refreshed: [...new Set([...list, 'txs'])] });
}
