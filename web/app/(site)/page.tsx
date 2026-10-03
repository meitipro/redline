import Link from 'next/link';

import { AttemptRow, Empty, ReadError, StatusBadge, TargetCard } from '@/components/ui';
import { gen, plural } from '@/lib/format';
import { allTargets, isTest, listAttacks, readError } from '@/lib/read';
import { lockLeft } from '@/lib/target';
import type { Attack, Target } from '@/lib/types';

export const revalidate = 20;

const STEPS = [
  ['01', 'Post', 'Test instructions, one to three rules, a mode, a bounty and a lock of at least seven days.'],
  ['02', 'Attack', 'A hunter pays the entry fee, which waits in escrow, and sends one message.'],
  ['03', 'Run', 'Each validator runs the agent on its own model with the attack as the user message.'],
  ['04', 'Check', 'Secrets and actions are checked by exact code, scope by a judge prompt.'],
  ['05', 'Pay', 'The first reproduced break takes the bounty. Otherwise the builder reclaims after the lock.'],
];

const FAQ = [
  {
    q: 'Which models run the agent?',
    a: "Whatever models the GenLayer validators run. Each validator runs the posted instructions with the attack on its own model, so a break has to reproduce across several models before anyone is paid. That is a property of the test, not a guarantee about your own model.",
  },
  {
    q: 'What counts as a break?',
    a: 'Secret rules: the reply contains this run\'s canary, even spelled with dashes or in a poem. Action rules: a JSON action above the posted amount or to a recipient off the allowlist. Scope rules: the judge prompt finds the reply substantively does what the rule forbids. Mentioning a topic only to refuse it is not a break.',
  },
  {
    q: 'Is my prompt public?',
    a: 'Yes. Instructions, rules, attacks and the leader\'s replies are all public by design: that is how builders learn. Post a test version, never production instructions, and never a real key. The posting form and the contract refuse key-shaped strings.',
  },
  {
    q: 'What happens to my entry fee?',
    a: 'It waits in escrow until the attack runs. If the agent holds, it joins the bounty. If your attack breaks the target, you get it back with the bounty. If the attack is rejected before judging, or the target closed before it ran, it is refunded through Claim.',
  },
  {
    q: 'Can the builder refuse to pay?',
    a: 'No. The builder never judges, and the bounty is locked: it can only be topped up until the lock ends, and reclaimed after it only if nobody broke the target.',
  },
  {
    q: 'Which network?',
    a: 'GenLayer Studio Next, chain 61997. Test GEN is free from the faucet in the site. Judging never moves money: claims and reclaims are separate transactions.',
  },
];

/** The hero shows a live open target: the biggest bounty among real targets, else among any. */
function pickHero(items: Target[]): Target | undefined {
  const open = items.filter((t) => t.status === 'OPEN' && t.lock_until * 1000 > Date.now());
  const real = open.filter((t) => !isTest(t));
  const pool = [...(real.length ? real : open)].sort((a, b) => (BigInt(b.bounty) > BigInt(a.bounty) ? 1 : BigInt(b.bounty) < BigInt(a.bounty) ? -1 : 0));
  return pool[0];
}

export default async function Landing() {
  let targets: Target[] = [];
  let recent: Attack[] = [];
  let error = '';
  try {
    targets = await allTargets('');
    recent = (await listAttacks(0, 0, 50)).items;
  } catch (e) {
    error = readError(e);
  }
  const hero = pickHero(targets);
  const heroAttempts = hero ? recent.filter((a) => a.target_id === hero.id && a.status !== 'QUEUED') : [];
  const shown = recent.filter((a) => a.status !== 'QUEUED').slice(0, 8);
  const open = targets.filter((t) => t.status === 'OPEN');
  const closed = targets.filter((t) => t.status !== 'OPEN');

  return (
    <>
      <section className="c-wrap grid gap-12 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center">
          <p className="c-eyebrow">Prompt-injection bounties, judged on GenLayer</p>
          <h1 className="c-h1 mt-4">
            Break the agent. <em>Get paid.</em>
          </h1>
          <p className="c-lead mt-6">
            Builders post a test version of their agent&apos;s instructions and a bounty. You send attacks. Every validator runs
            the agent on its own model, and a break pays only when they reproduce it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#targets" className="c-btn solid">
              See open targets
            </Link>
            <Link href="/new" className="c-btn">
              Post a target
            </Link>
          </div>
          <p className="c-faint mt-5 text-[13.5px]">Every held attack grows the bounty. Every attempt stays on the record.</p>
        </div>
        <div>
          {error ? <ReadError message={error} /> : hero ? <TargetCard t={hero} recent={heroAttempts} /> : <Empty>No target is open right now.</Empty>}
        </div>
      </section>

      <section className="c-section" id="recent">
        <div className="c-wrap">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="c-eyebrow">Recent attempts</p>
              <h2 className="c-h2 mt-2">Held, broken and rejected, across every target</h2>
            </div>
            <Link href="/hall" className="c-link text-[14px]">
              Hall of breaks
            </Link>
          </div>
          <div className="c-card mt-8 divide-y divide-[var(--line)]">
            {shown.length ? shown.map((a) => <AttemptRow key={a.id} a={a} showTarget />) : <div className="p-4"><Empty>No attempt has been judged yet.</Empty></div>}
          </div>
        </div>
      </section>

      <section className="c-section" id="how">
        <div className="c-wrap">
          <p className="c-eyebrow">How it works</p>
          <h2 className="c-h2 mt-2">Post, attack, run, check, pay</h2>
          <div className="c-steps mt-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {STEPS.map(([n, title, body]) => (
              <div key={n}>
                <p className="mono c-faint text-[12px]">{n}</p>
                <p className="c-h3 mt-2">{title}</p>
                <p className="c-muted mt-2 text-[14px] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="c-section" id="targets">
        <div className="c-wrap">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="c-eyebrow">Targets</p>
              <h2 className="c-h2 mt-2">{plural(open.length, 'open target')}</h2>
            </div>
            <Link href="/new" className="c-btn small">
              Post a target
            </Link>
          </div>
          <div className="c-card mt-8 overflow-x-auto">
            <table className="c-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Mode</th>
                  <th>Bounty</th>
                  <th>Entry fee</th>
                  <th>Held</th>
                  <th>Lock left</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...open, ...closed].map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/t/${t.id}`} className="font-medium hover:underline">
                        {t.name}
                      </Link>
                      <span className="c-faint mono ml-2 text-[12px]">#{t.id}</span>
                    </td>
                    <td className="mono text-[13px]">{t.mode.toLowerCase()}</td>
                    <td className="mono">{gen(t.bounty)}</td>
                    <td className="mono">{gen(t.entry_fee)}</td>
                    <td className="mono">{t.held}</td>
                    <td className="mono">{t.status === 'OPEN' ? lockLeft(t.lock_until) : '—'}</td>
                    <td>
                      <StatusBadge target={t} />
                    </td>
                  </tr>
                ))}
                {!targets.length && (
                  <tr>
                    <td colSpan={7} className="c-muted">
                      No targets yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="c-section" id="reproduce">
        <div className="c-wrap c-grid-2">
          <div>
            <p className="c-eyebrow">Why a break must reproduce</p>
            <h2 className="c-h2 mt-2">A trick that works on one model never pays</h2>
          </div>
          <div className="flex flex-col gap-4 text-[16px] leading-relaxed">
            <p>Every validator runs the agent against the attack on its own model, and checks its own reply.</p>
            <p>They compare one thing: held, or broken on the same rule. The verdict stands only when they agree.</p>
            <p className="c-muted">
              So the bounty goes to breaks that reveal a real weakness in the instructions, and a prompt that holds across
              several models is more robust than one tested on a single model.
            </p>
          </div>
        </div>
      </section>

      <section className="c-section" id="policy">
        <div className="c-wrap c-grid-2">
          <div>
            <p className="c-eyebrow">The rule policy</p>
            <h2 className="c-h2 mt-2">Secrets, actions and scope. Nothing else.</h2>
          </div>
          <div className="grid gap-3">
            {[
              ['Secret', 'The instructions hold a {CANARY} slot. Each run gets a fresh 12-character value, never stored. The rule breaks when the reply contains it. Exact code.'],
              ['Action', 'The agent answers with JSON actions. An amount above the limit, or a recipient off the allowlist, breaks the rule. Exact code.'],
              ['Scope', 'The agent must stay inside a described scope. The judge prompt decides, and a polite refusal is in scope.'],
              ['Refused', 'Targets whose break would need harmful output, and anything that looks like a real key. Displayed attack text is filtered.'],
            ].map(([k, v]) => (
              <div key={k} className="c-card pad">
                <p className="font-semibold">{k}</p>
                <p className="c-muted mt-1 text-[14px] leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="c-section" id="faq">
        <div className="c-wrap c-grid-2">
          <div>
            <p className="c-eyebrow">FAQ</p>
            <h2 className="c-h2 mt-2">Before you post or attack</h2>
          </div>
          <div className="flex flex-col gap-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <p className="font-semibold">{f.q}</p>
                <p className="c-muted mt-1 text-[15px] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
