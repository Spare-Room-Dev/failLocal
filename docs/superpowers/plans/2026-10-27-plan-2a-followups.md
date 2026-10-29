# Plan 2a follow-ups

Plan 2a (the site's shell, logic and chrome) passed its per-task reviews and a whole-branch review on 27 Oct 2026. These items were deliberately left out of it.

Status updated 28 Oct 2026 at the end of Plan 2b (branch `feat/site-2b`). Items marked **done in 2b** name the commit or decision that closed them; unmarked items are still open.

## Before release (fix these before the repo goes public or the site is deployed)

- **D-079 contradicts the site.** `docs/decisions.md` D-079 says the S1 projection's revenue at risk "comes entirely from the assumed 24-hour hold". The site's caveat correctly names two assumed numbers: the phone-and-email workaround's `holdsFor` (3 days) and the purchasing hold's `holdFor` (24 h). Engine check: a 0-day workaround gives about $25.65M, and 9 days or more gives $0. Amend D-079 to name both. — **done in 2b** (b4fbb3d).
- **The tablet breakpoint stops short.** The ≤ 1100 px tier leaves the timeline axis under 200 px between 1101 and about 1180 px. Move the breakpoint to about 1200 px, or tighten the strip columns there. — **done in 2b** (b4fbb3d: tablet tier to 1200 px).
- **A refused editor value stays in the field.** A rejected value (e.g. `-1`) is shown with no issue next to it after "Reset all". `fieldIssues` is not cleared or re-tried on scenario, variant or cut changes. Clear or remount the draft on reset. — **done in 2b** (b4fbb3d).

## Plan 2b (the diorama), seam items

- **Cable anchors become part of the contract.** Card positions currently assume the scene draws cable *i* at `cableFraction(i)` of its width. Zoom and pan (D-100) will break that. Either the scene reports its anchors, or cables are pinned to those fractions. — **done in 2b** (a6b070a, 5ec4234; D-109).
- **Add `SceneState.cables`.** The scene reads `SERVICE_GROUPS` and `groupState` directly today. — **done in 2b** (a6b070a: scene contract v2).
- **Drive the honesty plinth from the register.** Render it from `register.site.fictional` rather than hard-coding it inside the implementation, and keep the plinth test independent of the implementation. — **done in 2b** (a6b070a: `sceneState` throws on a register not marked fictional; D-111 plate as engraved DOM text).
- **Give the canvas an accessible DOM layer.** e2e and unit tests select SVG DOM (`.scene-plinth`, cable lines, the `Haulage: Stopped` buttons). The PixiJS canvas needs an accessible DOM layer with the same roles, or those tests need rewriting. — **done in 2b** (a6b070a, 5ec4234).
- **Make the `sceneState` `??` fallbacks throw.** — **done in 2b** (a6b070a).
- **Phone scene.** Crop to the working area and hide the cables (DESIGN.md:271). — **done in 2b** (5ec4234; D-109).
- **Legibility pass.**
  - Compact cards at 1024–1280 px ("Host…", "V."). — **done in 2b** (806725f, 8d6d819, 15c0c47).
  - The large blank band under the plinth. — **done in 2b** (670cbf3, 27a8b5e; D-111: the model opens as an object on its plinth).
  - Plinth text is 7–11 px tall. — **done in 2b** (D-111: the plate is DOM text, never under 9 px).
  - A vendor card hides about 63 px of its cable head at 1024 px when all services are cut. — **done in 2b** (superseded: one vendor card of fixed height, 8d6d819, 0f4be37; posts in the default view, D-109).
  - A ringed timeline marker sits near day 1.8; confirm it isn't read as the playhead. (Still open: not explicitly checked; the timeline was relabelled in lanes, D-112.)
- **Re-record DESIGN.md.** It should cover five service groups, compact cards, the board size and zoom (D-100), the tablet tier and token drift. — **done in 2b** (d394e6d).
- **Bundle.** Consider parsing and validating the register at build time and shipping JSON, which drops the `yaml` parser before PixiJS is added. Revisit the build guard's URL scope if chunks split. — **done in 2b** (93787ca, D-107; the guard passes with PixiJS split into chunks: 321.0 KB of 450 KB gzipped, D-104).

## Smaller items (2b or later)

- **Accessibility.**
  - The assumed-value reasoning is reachable only through `title`, so phone and keyboard users can't get to it. — **done in 2b** (806725f, c09971b).
  - The sourced tooltip can't be hovered and doesn't close on Escape. — **done in 2b** (806725f; e2e "provenance tags").
  - Two hairline labels can show at once (one from focus, one from hover). — **done in 2b** (806725f).
  - `untaggedNumbers` doesn't scan `aria-label`, `title` or input values. — **done in 2b** (806725f, c09971b).
- **Test hardening.**
  - LRU eviction.
  - The playback teardown assertion.
  - The s4 removal and compromise-exclusion discrimination.
  - LastRestoreTest through `<Qty>`.
  - A 15 s timeout on the guided "skip from any step" test, which flaked once on a cold cache. — **done in 2b** (806725f).
- **Engine.**
  - Move `z.config({ jitless: true })` into an `engine/src/zod.ts` that is imported first.
  - Expose active post-restore holds on `Sample`.
- **Chrome.**
  - Badge line glyphs. — **done in 2b** (806725f).
  - Tokens in place of the hard-coded colours in `chrome.css`. — **done in 2b** (806725f; a scan test keeps raw colours out).
  - A draft marker on the Limitations caveat. — **done in 2b** (806725f).
  - `img-src data:` tightening and COOP/CORP headers.

## Owner gates (each one needs the owner)

1. **Domain or subdomain**: the owner chose `faillocal.spareroomdev.com`, on Vercel instead of Cloudflare Pages (D-116). Still open (Release 2 Task 6): adding the domain to the Vercel project and its DNS.
2. **Deploy.** The host is now Vercel (D-116); the README's "Deploy" section lists the settings. Still open (Release 2 Task 6): the owner imports the repository into Vercel, or deploys with `npx vercel deploy --prod`.
3. **Byline name** at `site/src/ui/pages/WelcomePage.tsx`, the `[Your name]` placeholder. — **done in Release 2** (29 Oct 2026, Release 2 Task 5): "Rob Porter"; `og.png` made again.
4. **Approve or edit the drafts.** — **done in Release 2** (29 Oct 2026, Release 2 Task 5): all 94 items of the copy review approved as drafted, the markers removed, and the three "How I built this" placeholders written by the owner.
   - `site/src/ui/pages/BuiltPage.tsx`: the banner, the body, and the placeholders for the whole-branch review and "what I learned".
   - The guided captions in `site/src/model/guided.ts` (`CAPTIONS`).
   - The "Draft copy" badge in `GuidedRun.tsx`.
   - The shared assumption caveat.
5. **Make the GitHub repo public** after Plan 2b. Replace the `[owner]` decision-log URL in `LimitsPage.tsx`, and the matching temporary allow-list entry in `site/scripts/check-build.mjs`. The decision-log link is **done in Release 2** (29 Oct 2026, Release 2 Task 5): it points to `https://github.com/Spare-Room-Dev/failLocal/blob/main/docs/decisions.md`. Still open (Release 2 Task 6): making the repository public.
6. **The walkthrough video** (controller ruling R-w). The welcome page has no walkthrough button until the video exists: a disabled "coming soon" button would be a dead control. Record the two-minute walkthrough, then add the comp's ghost button (DESIGN.md "Landing Buttons").
7. **Approve the finish-round-1 and round-2 drafts** — **done in Release 2** (29 Oct 2026, Release 2 Task 5): approved as drafted in the copy review, which lists every visible line (Batch B and the final batch): the stockpile and rate lines in the revenue section and the low-mark working line, the "12×" speed labels, "Based on", "Restored day N", "Cut from day N" and "Remove cut" on the service cards, the "Why it is running" / "Why it is degraded" headings, "Modelled on" in the top bar, and the network-view line on the Limitations page (D-110).
   - Note: after a day-0 cut the card button reads "Restore Hosted ERP" (for example), not "Remove cut"; "Remove cut" shows only for a cut that has not started yet or has ended.
   - Also approve: the per-state "Why…" titles in `AreaPanel.tsx` (including "Why this stops"), and the phone card strip's scroll hint (it peeks its next card and fades at the right edge).
   - **Subline wording.** The top bar reads "Modelled on <source>" or "Based on <source>" (ruling R-aa, `TopBar.tsx`). A fuller line such as "Modelled on Scope Systems, Perth, May 2026" would need a new owner-supplied register field (place and date of the source); the register has no such field today.

## Open after 2b (known gaps)

- **Network overlay** is not built (D-110); the Limitations page says so, in a line the owner approved on 29 Oct 2026.
- **Phone tree remounts** when the window crosses 760 px. — **checked in Release 2** (task 2): the run lives in the store, so the e2e test `rotating a phone keeps the run` (390×844 → 844×390 → back) keeps the scenario, Prepared, the Hosted ERP cut and the day; no fix needed.
- **Two-line-status cards are taller** in s3 and s4.
- **At 390 px the card band clips** the second card's Cut button. — **done in Release 2** (task 2): phone cards sized to the stage, one across below 480 px and two from 480 to 760 px, with a 40 px peek; e2e `phone card strip never shows a partial control`.
- **iOS: a tap outside doesn't close** a pinned provenance popover. — **done in Release 2** (task 2): a pinned popover closes on a `pointerdown` outside its tag.
- **`.guided-kicker` eyebrow** breaks the craft-floor ban on eyebrows. — **done in Release 2** (task 2): sentence case, 13 px, weight 600, `--ink-2`.
- **Snapshot RenderTextures may allocate MSAA per layer**; measure GPU memory before changing anything.
