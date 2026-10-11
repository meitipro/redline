# Milestone, 2026-10-11

Counts are checked by `submission/count.py`.

## Title

<!-- milestone-title -->
Every money path on chain, and the Hall of breaks as a dataset
<!-- end -->

## What changed

<!-- milestone -->
The first bounty locks ended, so the last payout path ran on chain: five unbroken targets reclaimed (33 GEN), and every bounty and refund the evaluation left owed claimed (20 GEN). Refusals for an attack after the lock, an early reclaim and a second reclaim are on chain too. 23 of 23 steps passed and all four wallets reconcile to 0 wei. New: the Hall of breaks export, every judged attempt as JSON and CSV with its transactions, for builders to test their own agents against.
<!-- end -->

## Links

- Export (JSON): https://redline-genlayer.vercel.app/hall/export.json
- Export (CSV): https://redline-genlayer.vercel.app/hall/export.csv
- Export format and example: https://redline-genlayer.vercel.app/docs/more/dataset
- A reclaimed target: https://redline-genlayer.vercel.app/t/2
- Reclaim transaction: https://explorer-studio-dev.genlayer.com/tx/0xd04eaef83eb54eda8151aa7050b0ba68869adb02be5e095b2cdfde5d1ec4317d
- Full record: https://github.com/meitipro/redline/blob/main/docs/closeout.studio-next.json
