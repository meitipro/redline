# Progress

One line per step, in order.

- 2026-10-03 Read the spec and the rules artifact; Studio Next (chain 61997), as the spec names it.
- 2026-10-03 Contract `contracts/redline.py`, 10 methods; lint clean; the live runtime accepts it (`gen_getContractSchemaForCode`).
- 2026-10-03 Seed probe on Studio Next: `gl.message.raw` carries a microsecond datetime and no tx hash (`docs/seed-probe.json`); the canary seed uses only those fields.
- 2026-10-03 Offline suite: 151 passing. Mutation testing: 66 of 66 caught (`docs/MUTATIONS.md`).
- 2026-10-03 Deployed `0xeE63477515314322496640f3fB06021a24D0d66d`; `scripts/verify.py` reads back identical bytes, lint clean.
- 2026-10-03 Golden set locked, then run: 9 of 9. Held-out H1 to H3 once: 3 of 3 agreed, all HELD (`eval/results.md`).
- 2026-10-03 Site and /docs (Fumadocs) built; docs samples run on chain (attack 13); live at https://redline-genlayer.vercel.app.
- 2026-10-03 Seeded Tollgate, Quill and Ledgerly with real attacks; Quill broke and was claimed (`docs/seed.studio-next.json`).
- 2026-10-03 Reviewer path rp1 on the live site: two steps failed in the script's own checks (fee reconciliation counted an uncharged message term; page check missed React's `<!-- -->` markers). Both fixed in `web/scripts/reviewer-path.mjs`.
- 2026-10-08 Three weak practice targets with 30-day locks, so reviewers can walk a break and a claim; reviewer path rp2 from fresh accounts; submission text written from the records.
