# Handoff

What only the owner can do. Everything else is done and recorded in PROGRESS.md.

1. **Send the portal entry.** Every field is in `submission/portal.md`, character counts checked by code. The icon is
   `submission/redline-icon-512.png`.
2. **Record the silent demo** following `submission/demo-script.md`, upload it, and paste the link into the portal's
   optional video field.
3. **Post on X** with `submission/x-post.md`.
4. **Delete three leftover folders by hand** (the safety check would not let the agent delete them):
   `D:\redline\_leftover-fairshare-web-copy`, `D:\redline\_empty-web-shell` (an interrupted copy of the Fairshare site
   shell) and `D:\.source` (written by a dev server started from the wrong folder). None is part of the project.
5. **After 2026-10-10**, the first locks end: reclaim an unbroken golden target (for example target 2) to put a reclaim
   on chain: from `D:\redline\web`, run `node scripts/send-as.mjs golden_builder reclaim "[2]" 0 --final`.

The contract is frozen at `0xeE63477515314322496640f3fB06021a24D0d66d`; do not redeploy without deciding to.
