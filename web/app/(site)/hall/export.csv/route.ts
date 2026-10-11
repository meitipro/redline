import { dataset, toCsv } from '@/lib/dataset';

/** Every judged attempt, as CSV with a header row: the Hall of breaks export. */
export async function GET() {
  return new Response(toCsv(await dataset()), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="redline-hall-of-breaks.csv"',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
