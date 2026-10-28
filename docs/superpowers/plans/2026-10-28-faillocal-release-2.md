# Release 2 (first playable) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get FailLocal to a public, deployed first playable release that meets the spec's anti-goal bar ("nothing half-working goes public"): fix the known phone gaps, tighten the security headers, add a link preview for LinkedIn, and add a release gate that a deploy with placeholder or draft copy cannot pass.

**Architecture:** Tasks 1–4 are code and need nothing from the owner. They end with a release build that fails, on purpose, until the owner's answers are in. The **Owner gate** section is one checklist for the owner. Task 5 applies the owner's answers. Task 6 is the deploy, done by the owner or by Claude with explicit consent at that moment.

**Tech Stack:** Vite 8, React 19, PixiJS 8.22, Vitest 5, Playwright, Cloudflare Pages (static, `_headers`).

**Spec:** `docs/superpowers/specs/2026-10-22-faillocal-design.md` (§3 anti-goals, §4.5 mobile, §5.1 honesty, §6 web-security hygiene, §7 step 2). Also `DESIGN.md`, `docs/superpowers/plans/2026-10-27-plan-2a-followups.md` (Owner gates, Open after 2b), `docs/superpowers/plans/2026-10-27-site-2b-rulings.md`.

## Global Constraints

- The site is a **fictional model mine**, and says so wherever it is shown, including in a shared preview image.
- Every number shown carries a provenance tag (`sourced`, `measured`, `assumed`, `computed`). "Revenue at risk" and "production deferred", never "lost".
- Strict CSP: no inline script or style in `index.html`; no third-party requests, trackers or fonts; every URL in the build is on the allow-list in `site/scripts/check-build.mjs`.
- Gzipped JS budget 450 KB (D-104); today 321.2 KB.
- Port 4173 belongs to an unrelated process of the owner's. Never stop it. Run e2e with `E2E_PORT=4183 npm run e2e -w site`.
- **No push, deploy, DNS change or repo-visibility change** without the owner's explicit consent given at that moment.
- Every new judgement goes into `docs/decisions.md`, numbered from **D-113**.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on a branch, `feat/release-2`, cut from `main`.

## Review Focus

1. **A phone visitor taps a half-visible control.** At 390 px the second service card's Cut button shows as a sliver at the strip's right edge. A visitor expects every control they can see to be whole. → Task 2, `phone card strip never shows a partial control`.
2. **The real headers block something at runtime**, leaving a blank canvas or a missing font. A visitor expects the same page they would get with no CSP. → Task 1, `no CSP violation through welcome, guided run and free play`.
3. **A phone is rotated mid-run.** The layout switches at 760 px and remounts the page. The visitor expects the scenario, the day and the cuts to stay as they were and the scene to redraw. → Task 2, `rotating a phone keeps the run`.
4. **A shared link shows no card, a broken image, or an image without the fictional label.** LinkedIn is the main way visitors arrive (spec §2). → Task 3, `index.html carries the link-preview tags` and the og.png checks.
5. **A deploy goes out with `[Your name]`, `[owner]`, a placeholder or a "Draft copy" marker.** → Task 4, `release-check rejects placeholders and draft markers`; Cloudflare runs the release build, so the deploy itself fails.

---

### Task 1: Security headers

**Files:**
- Modify: `site/public/_headers`
- Modify: `site/test/headers.test.ts` (the `headers file carries the exact CSP` test)
- Modify: `site/e2e/site.spec.ts` (new test)
- Modify: `docs/decisions.md` (D-113), `README.md` (one line on the new headers)

**Interfaces:**
- Produces: the `_headers` file both `vite preview` (via `vite.config.ts`, rule `/*`) and Cloudflare serve.

- [ ] **Step 1: Update the exact-headers test to the new file.** The expected parse is:

```ts
{
  '/*': {
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  },
  '/assets/*': { 'Cache-Control': 'public, max-age=31536000, immutable' },
}
```

Rename the test `headers file carries the exact security headers`. `img-src` loses `data:` (no `data:image` appears in the build). Vite hashes every file under `/assets/`, so those files can be cached for good.

- [ ] **Step 2: Write the e2e test `no CSP violation through welcome, guided run and free play`.** It runs on the `desktop` and `phone` projects. Use `page.addInitScript` to collect `securitypolicyviolation` events into `window.__csp`. Then: load `/?e2e#/`, start the guided run and skip to its end, enter free play, cut Hosted ERP, toggle Prepared, open one provenance popover. Expect `window.__csp` to be `[]`, and no console error to contain `Content Security Policy`. Also assert the response headers of `/` include `cross-origin-opener-policy: same-origin`.

- [ ] **Step 3: Run both tests and see them fail.** Run `npm test -w site -- headers` and `E2E_PORT=4183 npm run e2e -w site -- -g "no CSP violation"`. Expected: the unit test FAILS on the header diff. The e2e test may pass before the change; it is the regression net for Step 4.

- [ ] **Step 4: Write the new `_headers`.** Keep the `/*` block first. Add the `/assets/*` block after it.

- [ ] **Step 5: Run the unit suite and the full e2e suite.** Both must pass. If an e2e violation appears for `img-src`, put `data:` back, and record in D-113 which code needs it.

- [ ] **Step 6: Add D-113 to the decision log.** Name: "Release headers: no data: images, isolated opener and resources, immutable assets". In plain English, say what each header does for a visitor and why it is safe here. Add one line to README's Website section naming the two cross-origin headers and the asset caching.

- [ ] **Step 7: Commit** (`feat(site): tighten release headers (D-113)`).

---

### Task 2: Phone fixes

**Files:**
- Modify: `site/src/styles/base.css` (the phone block, `.site-cards` / `.site-card-slot`)
- Modify: `site/src/ui/ProvenanceTag.tsx`
- Modify: `site/src/ui/guided.css` (`.guided-kicker`)
- Test: `site/test/qty.test.tsx`, `site/e2e/site.spec.ts`

**Interfaces:**
- Consumes: the phone layout in `SitePage.tsx` (`PHONE = '(max-width: 760px)'`) and the card markup (`.site-cards > .site-card-slot > .service-card`, buttons `.service-button`).

- [ ] **Step 1: Write the e2e test `phone card strip never shows a partial control`.** It runs on the `phone` project. Set the viewport to each of 360, 390, 430, 600 and 760 px wide (844 tall), open `#/site` in free play, and leave the strip scrolled to its start. Cut Hosted ERP, so card 1 shows "Remove cut". For every `.site-cards .service-button`, take its box and the strip's box. Expect each button to be fully inside the strip (`left ≥ strip.left` and `right ≤ strip.right − 48`, the fade width) or fully outside it (`left ≥ strip.right`).

- [ ] **Step 2: Write the e2e test `rotating a phone keeps the run`.** It runs on the `phone` project. Open `#/site`, enter free play, select the hosted-ERP projection scenario, cut Hosted ERP, toggle Prepared, and seek to day 5 with the e2e hook. Resize to 844×390, then back to 390×844. After each resize, expect the following unchanged: the scenario title, the Prepared toggle, the Hosted ERP card's cut state, and the day figure. Also expect the scene to show a canvas with a non-zero size (or `.scene--schematic` where WebGL is absent).

- [ ] **Step 3: Write the unit test `a tap outside closes a pinned popover` in `qty.test.tsx`.** Pin a tag's popover with a touch press (`pointerType: 'touch'`). Then `fireEvent.pointerDown(document.body)`, with no blur fired (iOS Safari does not focus a tapped button, so blur never comes). Expect the popover to be gone. A second test, `a tap inside a pinned popover keeps it open`, presses on the popover itself and expects it still shown.

- [ ] **Step 4: Run the three tests and see them fail.** Expected: the strip test fails at 390. The unit test fails, because nothing listens for pointerdown. The rotation test may already pass; it stays as the net.

- [ ] **Step 5: Size the phone cards so the peek never holds a control.** Below 480 px, show one card plus a 40 px peek; from 480 to 760 px, show two cards plus the peek. Use `calc()` on `flex-basis` with a container or media query. The peek must stay narrower than the space between a card's left edge and its first button. Keep the existing fade and scroll snapping.

- [ ] **Step 6: Make the popover close on a tap outside.** While a popover is pinned, `ProvenanceTag` listens for `pointerdown` on `document`, and dismisses when the event target is outside the tag's root. Remove the listener on unpin and on unmount. Update the doc comment that says a blur closes it.

- [ ] **Step 7: Restyle `.guided-kicker` so it isn't an eyebrow.** Use sentence case, without `text-transform` or the condensed width: 13 px, weight 600, `var(--ink-2)`. The text "What really happened" is unchanged. It is the §5.1 honesty label.

- [ ] **Step 8: Run `npm test -w site`, typecheck, and the full e2e suite.** All pass.

- [ ] **Step 9: Mark the three open items done** in `docs/superpowers/plans/2026-10-27-plan-2a-followups.md` ("At 390 px the card band clips…", "iOS: a tap outside…", "`.guided-kicker` eyebrow…"). Mark "Phone tree remounts" checked by the rotation test. Commit (`fix(site): phone card peek, tap-outside popover close, kicker style`).

---

### Task 3: Link preview, favicon and page metadata

**Files:**
- Modify: `site/index.html`
- Create: `site/public/favicon.svg`, `site/public/og.png`, `site/scripts/og-image.mjs`
- Modify: `site/scripts/check-build.mjs` (allow the site origin), `site/package.json` (`og-image` script)
- Test: `site/test/headers.test.ts` (new `describe('index.html')`)
- Modify: `docs/decisions.md` (D-114)

**Interfaces:**
- Produces: `VITE_SITE_ORIGIN`, the deployed origin with no trailing slash (e.g. `https://faillocal.example.com`). Vite replaces `%VITE_SITE_ORIGIN%` in `index.html` at build time. When it is unset, the literal stays, and Task 4's release check rejects it.
- Produces: `allowedUrls(registerYaml, origin?: string)`. With an origin, it adds `${origin}/` and `${origin}/og.png` to the set.

- [ ] **Step 1: Write the tests.**
  - `index.html carries the link-preview tags`: read `site/index.html` and expect each of these:
    - `<meta name="description" …>`;
    - `og:type` = `website`;
    - `og:title`, `og:description`;
    - `og:url` = `%VITE_SITE_ORIGIN%/`;
    - `og:image` = `%VITE_SITE_ORIGIN%/og.png`, with `og:image:width` 1200, `og:image:height` 630 and an `og:image:alt`;
    - `twitter:card` = `summary_large_image`;
    - `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;
    - `<meta name="theme-color">`.
  - `og.png is 1200 × 630 and under 400 KB`: read the PNG header (width and height are bytes 16–23).
  - `the site origin's preview URLs are allowed only when an origin is given`: `allowedUrls(REGISTER, 'https://x.example')` has `https://x.example/og.png`, and `allowedUrls(REGISTER)` does not.

- [ ] **Step 2: Run them and see them fail.**

- [ ] **Step 3: Write the metadata in `index.html`.** All text here is **draft copy** for the owner gate:
  - title: `FailLocal: what stops a mine when the systems outside it go down?`;
  - description and `og:description`: `A playable model of a fictional Pilbara iron ore mine. Cut the outside services it relies on, watch what stops and what it costs, then see what a prepared site does differently.`;
  - `og:image:alt`: `An isometric scale model of a fictional iron ore mine, with five outside services cabled into it. Fictional model site.`;
  - `theme-color`: the `--paper` token's hex value.

  No inline script or style; the build guard checks this.

- [ ] **Step 4: Create `favicon.svg` from `BrandMark` in `Brand.tsx`.** Use the same paths, with the token values written in as hex, since a favicon can't read CSS variables.

- [ ] **Step 5: Write `site/scripts/og-image.mjs <baseUrl>` and the `og-image` npm script.**
  - Use `chromium` from `@playwright/test`, with the SwiftShader flags from `playwright.config.ts`.
  - Viewport 1200×630, `deviceScaleFactor: 1`, `reducedMotion: 'reduce'` (a still frame).
  - Open `${baseUrl}/#/`, wait for the hero canvas, and screenshot the viewport to `site/public/og.png`.
  - Document the run in the script's header comment: build, preview on 4183, then run.
  - Generate the image and commit it. **It must show the headline, the board and the legible "FICTIONAL MODEL SITE" plate.** If the plate isn't legible at 1200×630, add an `?og` query flag. The welcome page reads it to draw the hero with the phone framing, which keeps the plate in view. Record which one you used in D-114.

- [ ] **Step 6: Extend `allowedUrls` and `main()` in `check-build.mjs`.** `main()` passes `process.env.VITE_SITE_ORIGIN`.

- [ ] **Step 7: Run the unit tests, `npm run build -w site`, and `VITE_SITE_ORIGIN=https://x.example npm run build -w site`.** All pass. In the second build, `dist/index.html` names `https://x.example/og.png`.

- [ ] **Step 8: Add D-114 and commit.** D-114 is "The link preview is a still of the model itself, labelled fictional". It says the preview is our own render (not a bought or generated image, spec §8) and that the plate stays in the image. Commit message: `feat(site): link preview, favicon and page metadata (D-114)`.

---

### Task 4: Release gate and deploy settings

**Files:**
- Create: `site/scripts/release-check.mjs`, `.node-version` (contents `22`)
- Modify: `site/package.json` (`"release": "npm run build && node scripts/release-check.mjs"`)
- Modify: `site/playwright.config.ts` (`E2E_BASE_URL`)
- Test: `site/test/releaseCheck.test.ts`
- Modify: `README.md` (a "Deploy" section), `docs/decisions.md` (D-115)

**Interfaces:**
- Consumes: Task 3's `%VITE_SITE_ORIGIN%` tags.
- Produces: `RELEASE_BLOCKERS: readonly string[]` = `['[Your name]', '[owner]', '[Placeholder', 'draft-marker', 'draft-banner', 'Draft copy', 'awaiting owner review']`.
- Produces: `checkNoBlockers(distDir: string): string[]`, which scans `.js` and `.html` files only.
- Produces: `checkPreviewTags(html: string): string[]`: `og:url` and `og:image` must be absolute `https://` URLs, and no `%VITE_` may remain.
- Produces: `checkHeadersShipped(distDir: string): string[]`: `dist/_headers` must exist.

- [ ] **Step 1: Write the tests in `releaseCheck.test.ts`.** Use fixture dists, in the style of `headers.test.ts`.
  - `release-check rejects placeholders and draft markers`: for each blocker, a JS file containing it gives exactly one problem naming the file and the string. A `.css` file containing `draft-marker` gives none.
  - `release-check requires absolute preview URLs`: the HTML with `%VITE_SITE_ORIGIN%/og.png` fails, and `https://x.example/og.png` passes.
  - `release-check requires the headers file`.

- [ ] **Step 2: Run them and see them fail.** Then implement `release-check.mjs`, whose `main()` runs all three checks on `site/dist`. Run the tests again: they pass.

- [ ] **Step 3: Run `npm run release -w site` and confirm it FAILS today.** It should list the byline, the decision-log URL, the BuiltPage placeholders, the draft markers and the unset origin. That failure is the gate working. Paste the list into the task report.

- [ ] **Step 4: Make `E2E_BASE_URL` run the suite against a live URL.** When `E2E_BASE_URL` is set, `playwright.config.ts` uses it as `baseURL` and drops `webServer`. Test it with `E2E_BASE_URL=http://localhost:4183 npx playwright test -g "no CSP violation"` against a preview you start by hand.

- [ ] **Step 5: Add a "Deploy" section to README.** Cloudflare Pages, Git integration:
  - build command `npm run release -w site`;
  - output directory `site/dist`;
  - root directory: the repo root;
  - environment variable `VITE_SITE_ORIGIN`;
  - Node from `.node-version`.

  Also give the direct-upload alternative: `VITE_SITE_ORIGIN=… npm run release -w site`, then `npx wrangler pages deploy site/dist --project-name faillocal`. And the post-deploy check: `E2E_BASE_URL=https://… npm run e2e -w site`, plus `curl -sI` for the CSP header.

- [ ] **Step 6: Add D-115 and commit.** D-115 is "A release build fails while any placeholder or draft copy remains". Commit message: `feat(site): release gate and deploy settings (D-115)`.

---

## Owner gate (the owner's part; nothing past here starts without it)

Claude collects these in one round of questions, with a recommendation on each, and records the answers in the ledger.

1. **Byline name.** Replaces `[Your name]` on the welcome page.
2. **Domain.** The subdomain for the site (spec §6: a subdomain of the owner's site). This becomes `VITE_SITE_ORIGIN`.
3. **GitHub repo.** The owner and repo name, which make the decision-log URL. Before the repo goes public with full history, the owner confirms they are happy with the commit identity: every commit is authored `Rob Porter` with a personal email address.
4. **Copy approval.** Approve or edit each item:
   - the guided captions (`site/src/model/guided.ts`);
   - the assumption caveat;
   - the comparison-card labels;
   - the stockpile and rate lines;
   - "12×" speed labels;
   - "Based on" / "Modelled on";
   - "Restored day N", "Cut from day N", "Remove cut";
   - the "Why…" titles;
   - the scroll hint;
   - the camera hint and the Fit name;
   - the Limitations network line and scenario lines;
   - Task 3's page title, description and image alt text.
5. **"How I built this" (`BuiltPage.tsx`).** The owner writes the two "What I learned" items in their own words. They also check one sentence before it ships: "I reviewed each one and accepted or changed it". It is true only once the owner has walked the decision log (spec §9b). Until then the page shouldn't claim it.
6. **Cloudflare.** Either the owner connects the repo to Cloudflare Pages themselves using the README settings, or they give Claude a go-ahead at that moment for a `wrangler` direct upload under their login.

---

### Task 5: Apply the owner's answers

**Files:**
- Modify: `site/src/ui/pages/WelcomePage.tsx`, `site/src/ui/decisionLog.ts`, `site/scripts/check-build.mjs` (swap the temporary `[owner]` allow-list entry for the real URL), `site/src/ui/pages/BuiltPage.tsx`
- Modify: every file holding approved draft copy, and the draft-marker CSS (`base.css`, `.draft-banner`)
- Modify: the tests that assert placeholders or markers exist (`test/pages.test.tsx` lines 51–55, 105, 109; `test/caveat.test.tsx` lines 81–98). Each one inverts to assert the approved text and the absence of the marker.
- Modify: `docs/superpowers/plans/2026-10-27-plan-2a-followups.md` (owner gates 3, 4, 5 and 7 done), `docs/decisions.md` (owner edits recorded as the owner's, spec §9c)

- [ ] **Step 1: Apply each answer verbatim.** Where the owner edited a line, the decision log records the change as theirs.
- [ ] **Step 2: Remove every "Draft copy" marker, the draft banner and the placeholder class,** with their CSS rules.
- [ ] **Step 3: Run `npm test`, `npm run typecheck` and `E2E_PORT=4183 npm run e2e -w site`.** Then run `VITE_SITE_ORIGIN=<the owner's origin> npm run release -w site`. All pass, and the release check reports no blockers.
- [ ] **Step 4: Commit** (`feat(site): owner-approved copy and identity for release 2`). Then merge `feat/release-2` to `main` locally, with the owner's consent.

---

### Task 6: Deploy (consent required at each step)

- [ ] **Step 1: Create the GitHub repo, add it as `origin`, and push `main`.** The owner does this, or Claude does it on an explicit "push now". The repo stays private until Step 4.
- [ ] **Step 2: Set up Cloudflare Pages** per README "Deploy", with `VITE_SITE_ORIGIN` set, and attach the custom domain.
- [ ] **Step 3: Smoke-check the live site.**
  - Run `E2E_BASE_URL=https://<domain> npm run e2e -w site`; it passes.
  - `curl -sI https://<domain>/` shows the CSP, COOP and CORP headers.
  - LinkedIn's Post Inspector shows the preview card, with the plate visible.
  - The owner opens the site on their own phone, including an iPhone if they have one, and runs the guided run once.
- [ ] **Step 4: Make the repo public.** The owner does this, or Claude does it on an explicit "make it public". Mark owner gates 1, 2 and 5 done in the follow-ups doc.

---

## Not in this plan

- The walkthrough video and its welcome-page button (R-w): full launch, spec §7 step 4.
- The welcome hero's clipped right corner at 820 and 1024 px. It matches DESIGN's "bleeds off the right edge"; it's a design follow-up, not a defect.
- Snapshot RenderTexture memory (MSAA per layer): measure first; no change without a measured problem.
- The two-line-status card height in s3/s4, and the network overlay (D-110): Plan 3.
- The release 2 LinkedIn post: the owner's, after Task 6.
