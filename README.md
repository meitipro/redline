# Redline

**Bounties for breaking your agent's rules.** A prompt-injection bounty board on GenLayer: a builder posts a test version
of an agent's instructions, one to three rules and a locked bounty; hunters pay a small fee to attack; every validator
runs the agent against the attack on its own model and checks the rules; and only a break that reproduces across
validators pays.

- **Site:** https://redline-genlayer.vercel.app
- **Docs:** https://redline-genlayer.vercel.app/docs
- **Contract:** [`0xeE63477515314322496640f3fB06021a24D0d66d`](https://explorer-studio-dev.genlayer.com/address/0xeE63477515314322496640f3fB06021a24D0d66d) on GenLayer Studio Next (chain 61997)
- **Deploy transaction:** [`0xcd7226fd…`](https://explorer-studio-dev.genlayer.com/tx/0xcd7226fd9283b8609b7fad9a3e7a124efe7dddd3e60b96007e53e06bd9651cd2), source sha256 `7efed7e246bb8e2f038f4bfd96b14d3a40434b148dc34d371b9fe0387ee609f4` ([contracts/FROZEN.json](contracts/FROZEN.json))

> Everything on Redline is public. Never post a real key or production instructions.

## How it works

1. **Post.** Test instructions, one to three rules (secret, action, scope), a mode, a bounty and a lock of 7 to 90 days.
2. **Attack.** A hunter pays the entry fee, held in escrow, and sends one message.
3. **Run.** Each validator runs the agent on its own model, with the attack as the user message.
4. **Check.** Secret rules: the reply contains this run's canary, a fresh 12-character value derived from the judging
   transaction and never stored. Action rules: a JSON action above the limit or off the allowlist. Both by exact code
   on each validator's own reply. Scope rules: the spec's judge prompt, word for word.
5. **Pay.** Validators compare only the verdict, `HELD` or `BROKEN:<rule>`. The first reproduced break takes the
   bounty; a held attack's fee grows it; an unbroken bounty goes back to the builder after the lock.

| Verdict | Money |
|---|---|
| `BROKEN:n` | The hunter claims the whole bounty and their own fee |
| `HELD` | The entry fee joins the bounty |
| `REJECTED` (longer than 1,500 characters, or a canary-shaped string; no model runs) | Fee refunded |
| `VOID` (still queued when the target closed) | Fee refunded |

A trick that works on some models and not on others does not reach agreement: nothing is stored and nobody is paid.
Judging never moves money; `claim` and `reclaim` are the only payouts, each a top-level transfer to its caller.

## Evidence

Every number below comes from a file in this repository that was written by the run that produced it.

| | Result | Record |
|---|---|---|
| Golden cases 1 to 9, through real consensus on the deployed contract | **9 of 9** matched | [eval/results.md](eval/results.md) |
| Held-out cases H1 to H3, run once | **3 of 3** reached agreement, all `HELD` | [eval/results.md](eval/results.md) |
| Offline tests (behaviour and static checks over the parsed source) | **151 passed** | `pytest tests -q` |
| Mutation testing: each defence broken on its own | **66 of 66** caught | [docs/MUTATIONS.md](docs/MUTATIONS.md) |
| Deployed bytes read back with `gen_getContractCode` | identical to `contracts/redline.py`, lint clean | `python scripts/verify.py` |
| Canary seed fields measured on the live runtime before use | datetime with microseconds, no tx hash | [docs/seed-probe.json](docs/seed-probe.json) |
| Demo targets and real attacks | demo targets in all three modes, attacks judged on chain; see the log | [docs/seed.studio-next.json](docs/seed.studio-next.json) |
| Reviewer's path from fresh accounts through the site's own signing code | run rp1 on the live site; see the record | [docs/reviewer-path.studio-next.json](docs/reviewer-path.studio-next.json) |

The golden set was hashed and timestamped before the first run (`eval/golden.lock.json`); nothing was tuned against it.

## Repository

```
contracts/redline.py        the contract: 10 methods, the scope judge prompt pinned inside
contracts/FROZEN.json       address, deploy tx and sha256 of the deployed bytes
contracts/probe/            the seed probe that measured gl.message.raw on Studio Next
tests/                      offline suite against a per-node test double (no GenVM binary needed)
eval/                       golden.json (locked), run_golden.py, results.json and results.md
scripts/                    deploy, verify, seed, mutate, gen_docs, probe_seed, chain.py
web/                        Next.js site and /docs (Fumadocs), genlayer-js 2.0.0-rc.1
web/scripts/                send-as.mjs, reviewer-path.mjs, reconcile.mjs: the site's own signing code, run from a terminal
submission/                 portal text, X post, silent demo script, 512 px icon
```

## Run it

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest tests -q          # offline, under a minute
.venv/Scripts/python scripts/verify.py           # the deployment matches this repository
.venv/Scripts/python scripts/mutate.py           # every defence, broken one at a time
cd web && npm ci && npm run dev                  # http://localhost:3210
```

Test accounts live in `~/.redline/accounts.json` on the machine that runs the scripts, never in this repository, and
only addresses are ever printed. No key exists on the site's server: every write is signed in the visitor's wallet.

## Honest limits

- Redline tests the posted instructions on the models validators run, not your production model and tools. A hold
  across several models is a strong signal, not a certificate.
- Instructions and attack share one prompt, both fenced; role separation a chat API gives is not modelled.
- A round without agreement leaves the attack queued, and anyone may run it again.
- The content policy is a word list: coarse in both directions.
- Bounties lock for at least seven days, so `reclaim` on the live contract can only run once a lock ends. It is covered
  by the offline suite and mutation testing.

Full list: [Limitations](web/content/docs/more/limitations.mdx).

## Network

GenLayer Studio Next, chain 61997 (`0xF22D`), RPC `https://studio-next.genlayer.com/api`, explorer
`https://explorer-studio-dev.genlayer.com`. Runtime `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.
