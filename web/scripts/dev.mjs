/**
 * `next dev` with Node's fetch routed through the machine's HTTPS proxy.
 *
 * On the build machine Node's fetch ignores HTTPS_PROXY unless
 * NODE_USE_ENV_PROXY=1 is set, and next/font then times out fetching Google
 * Fonts. Vercel needs none of this; it only changes local development.
 */
import { spawn } from 'node:child_process';

const args = ['next', process.argv[2] ?? 'dev', '--port', '3210'];
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
