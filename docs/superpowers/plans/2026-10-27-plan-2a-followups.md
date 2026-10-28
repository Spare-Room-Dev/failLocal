# Plan 2a follow-ups

Plan 2a (the site's shell, logic and chrome) passed its per-task reviews and a whole-branch review on 27 Oct 2026. These items were deliberately left out of it.

## Before release (fix these before the repo goes public or the site is deployed)

- **D-079 contradicts the site.** `docs/decisions.md` D-079 says the S1 projection's revenue at risk "comes entirely from the assumed 24-hour hold". The site's caveat correctly names two assumed numbers: the phone-and-email workaround's `holdsFor` (3 days) and the purchasing hold's `holdFor` (24 h). Engine check: a 0-day workaround gives about $25.65M, and 9 days or more gives $0. Amend D-079 to name both.
- **The tablet breakpoint stops short.** The ≤ 1100 px tier leaves the timeline axis under 200 px between 1101 and about 1180 px. Move the breakpoint to about 1200 px, or tighten the strip columns there.
- **A refused editor value stays in the field.** A rejected value (e.g. `-1`) is shown with no issue next to it after "Reset all". `fieldIssues` is not cleared or re-tried on scenario, variant or cut changes. Clear or remount the draft on reset.

## Plan 2b (the diorama), seam items

- **Cable anchors become part of the contract.** Card positions currently assume the scene draws cable *i* at `cableFraction(i)` of its width. Zoom and pan (D-100) will break that. Either the scene reports its anchors, or cables are pinned to those fractions.
- **Add `SceneState.cables`.** The scene reads `SERVICE_GROUPS` and `groupState` directly today.
- **Drive the honesty plinth from the register.** Render it from `register.site.fictional` rather than hard-coding it inside the implementation, and keep the plinth test independent of the implementation.
- **Give the canvas an accessible DOM layer.** e2e and unit tests select SVG DOM (`.scene-plinth`, cable lines, the `Haulage: Stopped` buttons). The PixiJS canvas needs an accessible DOM layer with the same roles, or those tests need rewriting.
- **Make the `sceneState` `??` fallbacks throw.**
- **Phone scene.** Crop to the working area and hide the cables (DESIGN.md:271).
- **Legibility pass.**
  - Compact cards at 1024–1280 px ("Host…", "V.").
  - The large blank band under the plinth.
  - Plinth text is 7–11 px tall.
  - A vendor card hides about 63 px of its cable head at 1024 px when all services are cut.
  - A ringed timeline marker sits near day 1.8; confirm it isn't read as the playhead.
- **Re-record DESIGN.md.** It should cover five service groups, compact cards, the board size and zoom (D-100), the tablet tier and token drift.
- **Bundle.** Consider parsing and validating the register at build time and shipping JSON, which drops the `yaml` parser before PixiJS is added. Revisit the build guard's URL scope if chunks split.

## Smaller items (2b or later)

- **Accessibility.**
  - The assumed-value reasoning is reachable only through `title`, so phone and keyboard users can't get to it.
  - The sourced tooltip can't be hovered and doesn't close on Escape.
  - Two hairline labels can show at once (one from focus, one from hover).
  - `untaggedNumbers` doesn't scan `aria-label`, `title` or input values.
- **Test hardening.**
  - LRU eviction.
  - The playback teardown assertion.
  - The s4 removal and compromise-exclusion discrimination.
  - LastRestoreTest through `<Qty>`.
  - A 15 s timeout on the guided "skip from any step" test, which flaked once on a cold cache.
- **Engine.**
  - Move `z.config({ jitless: true })` into an `engine/src/zod.ts` that is imported first.
  - Expose active post-restore holds on `Sample`.
- **Chrome.**
  - Badge line glyphs.
  - Tokens in place of the hard-coded colours in `chrome.css`.
  - A draft marker on the Limitations caveat.
  - `img-src data:` tightening and COOP/CORP headers.

## Owner gates (nothing done; each one needs the owner)

1. **Domain or subdomain** for Cloudflare Pages.
2. **Cloudflare access**, or the owner deploys `site/dist` (with `_headers`) themselves after `npm run build -w site`.
3. **Byline name** at `site/src/ui/pages/WelcomePage.tsx`, the `[Your name]` placeholder.
4. **Approve or edit the drafts.**
   - `site/src/ui/pages/BuiltPage.tsx`: the banner, the body, and the placeholders for the whole-branch review and "what I learned".
   - The guided captions in `site/src/model/guided.ts` (`CAPTIONS`).
   - The "Draft copy" badge in `GuidedRun.tsx`.
   - The shared assumption caveat.
5. **Make the GitHub repo public** after Plan 2b. Replace the `[owner]` decision-log URL in `LimitsPage.tsx`, and the matching temporary allow-list entry in `site/scripts/check-build.mjs`.
6. **The walkthrough video** (controller ruling R-w). The welcome page has no walkthrough button until the video exists: a disabled "coming soon" button would be a dead control. Record the two-minute walkthrough, then add the comp's ghost button (DESIGN.md "Landing Buttons").
7. **Approve the finish-round-1 and round-2 drafts** (Batch B and the final batch): the stockpile and rate lines in the revenue section and the low-mark working line, the "12×" speed labels, "Based on", "Restored day N", "Cut from day N" and "Remove cut" on the service cards, the "Why it is running" / "Why it is degraded" headings, "Modelled on" in the top bar, and the network-view line on the Limitations page (D-110).
