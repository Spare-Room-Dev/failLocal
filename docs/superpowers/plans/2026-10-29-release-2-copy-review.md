# FailLocal release 2: copy review sheet

This sheet lists every piece of wording on the site that you need to approve before the public release. It is taken from the code on branch `feat/release-2` as of 2026-10-29.

**How to answer.** For each item, either approve it or write the replacement, quoting its number, for example "C7: approve" or "C12: change to …". Anything you leave unanswered stays as drafted.

**How to read it.**

- **Current text** is what a visitor sees, word for word. Line breaks in the code are joined into single spaces.
- Where a number is filled in while the site runs, the template comes first with the number shown as `{…}`, then "→" and today's value, for example "Cut from day {n}" → "Cut from day 3".
- Most numbers on screen are followed by a small grey tag saying where the number comes from: *computed*, *assumed* or *sourced*. Such tags are noted after the example, for example "(tag: assumed)".
- "Read aloud only" means screen-reader text. It is not shown on screen.
- **Source** gives file and line number, so whoever applies your answers can find the exact place.

---

## 1. Guided-run captions

The guided run is the narrated tour that starts with "Show me the site". It shows its captions one at a time in the order below. A grey "Draft copy" tag sits above every caption (see C66).

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C1 | Guided run, small label above the title during steps 1–2 (the "honesty" section: what really happened) | "What really happened" | site/src/ui/GuidedRun.tsx:126 |
| C2 | Guided run, title during steps 1–2 (the scenario's name, from the register) | "Hosted ERP lost (as reported)" | register/pilbara-model-site.yaml:661 |
| C3 | Guided run, title during steps 3–12 (the scenario's name, from the register) | "Hosted ERP lost: what if the workarounds ran out" | register/pilbara-model-site.yaml:692 |
| C4 | Guided run, step 1 caption | "May 2026: Scope Systems' hosted ERP goes down. Purchasing moves to phone and email. This is the record, on a fictional model site." | site/src/model/guided.ts:80–81 |
| C5 | Guided run, step 2 caption | "The ERP is back after {days}. The trucks never stopped." → "The ERP is back after 12.0 days. The trucks never stopped." (tag: sourced) | site/src/model/guided.ts:87–89 |
| C6 | Guided run, step 3 caption (start of the projection: intro sentence followed by the step's own caption) | "Projection: what if the workarounds ran out? Fuel orders stop." | site/src/model/guided.ts:93–94 (joined at :127) |
| C7 | Guided run, step 4 caption | "The fuel farm runs dry. The fleet parks." | site/src/model/guided.ts:95 |
| C8 | Guided run, step 5 caption | "The ERP returns, but orders are held while transactions are reconciled." | site/src/model/guided.ts:96 |
| C9 | Guided run, step 6 caption | "The stockpile runs low. Trains slow." | site/src/model/guided.ts:97 |
| C10 | Guided run, step 7 caption (end of the unprepared projection) | "By the end of the projection: {amount} of revenue at risk." → "By the end of the projection: US$6.0 M of revenue at risk." (tag: computed) | site/src/model/guided.ts:98 (wording at :71–75) |
| C11 | Guided run, step 8 caption (start of the prepared run: intro sentence followed by the step's own caption) | "Same outage, prepared site: offline ordering and an independent restore keep fuel coming. The ERP is back, restored independently." | site/src/model/guided.ts:101 and :104 (joined at :127) |
| C12 | Guided run, step 9 caption | "Fuel orders keep going." | site/src/model/guided.ts:102 |
| C13 | Guided run, step 10 caption | "The fleet keeps running." | site/src/model/guided.ts:103 |
| C14 | Guided run, step 11 caption | "The trains keep running." | site/src/model/guided.ts:105 |
| C15 | Guided run, step 12 caption (end of the prepared run) | "By the end, prepared: {amount} of revenue at risk." → "By the end, prepared: US$0 of revenue at risk." (tag: computed) | site/src/model/guided.ts:106 (wording at :71–75) |

Notes:

- Steps 8–12 are ordered by when each moment happens. In the prepared run the ERP comes back on day 2, so the intro sentence joins "The ERP is back, restored independently." and not "Fuel orders keep going."
- If a later change to the model made fuel stop, the fleet park or the trains slow in the prepared run, that step would reuse the projection's caption (C6's second sentence, C7 or C9) instead of C12–C14 (site/src/model/guided.ts:111–117). That doesn't happen with today's numbers. There is no separate wording for it.
- C2 and C3 come from the model's register file, not from the guided-run code.

## 2. The assumption caveat

One sentence that appears in two places: on the guided run's closing card, and on the Limitations page (see C59). A test (site/test/caveat.test.tsx:55–79) checks that both places show the same words.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C16 | Guided run closing card, under the three totals; and Limitations page, third bullet | "This projection rests on two assumed numbers: phone-and-email ordering keeps going for {days} and new orders are held for {hours} after the ERP is back. Change either and the figure changes; see the decision log." → "…keeps going for 3.0 days and new orders are held for 24 hours after the ERP is back…" (both numbers tagged: assumed). "decision log" is a link. | site/src/ui/AssumptionCaveat.tsx:36–43 |

Notes:

- The "decision log" link points to a placeholder address (see C72).
- Clicking an "assumed" tag opens a popover with the reasoning, quoted from the register. For the two numbers here that is "How long suppliers keep delivering on emailed orders while invoices and payments cannot be processed (D-041)." and "Scope told customers to expect a gap of up to one to two days of transactions to reconcile by hand; that sizes the job, not its length. A day before new orders go out, so none duplicates an emailed one (D-094)."

## 3. Comparison-card labels

The closing card of the guided run. A grey "Draft copy" tag sits above it (see C67).

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C17 | Guided run closing card, first total | "Revenue at risk, unprepared" → shown with "US$6.0 M" (tag: computed) | site/src/ui/GuidedRun.tsx:182 |
| C18 | Guided run closing card, second total | "Revenue at risk, prepared" → shown with "US$0" (tag: computed) | site/src/ui/GuidedRun.tsx:188 |
| C19 | Guided run closing card, third total | "Being prepared protected" → shown with "US$6.0 M" (tag: computed) | site/src/ui/GuidedRun.tsx:194 |
| C20 | Guided run closing card, button at the bottom (outside the "Draft copy" area) | "Explore it yourself" | site/src/ui/GuidedRun.tsx:203 |

## 4. Stockpile and rate lines

**Nearest match.** The service cards and site cards carry no stockpile or rate lines. These lines are in the "Production and revenue" section at the top of the detail panel beside the model, which the 2a follow-ups list calls "the stockpile and rate lines in the revenue section and the low-mark working line" (docs/superpowers/plans/2026-10-27-plan-2a-followups.md:64). The only place "Stockpile" appears on a card-like element is the stock meter under the timeline (C24). C25–C28 are the rest of the same section, listed so you can see it whole.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C21 | Detail panel, under "Production deferred so far", only while the stockpile is covering for a stopped site | "Stockpile feeding rail: loadings are cut back in {time}" → "Stockpile feeding rail: loadings are cut back in 1.9 days" (under a day it shows hours, e.g. "…in 16 hours"; tag: computed). It has no full stop. | site/src/ui/RevenueSection.tsx:43–44 |
| C22 | Detail panel, under the revenue-at-risk figure, shown at the same times as C21 | "Revenue at risk once loadings are cut back ≈ {amount} per day, {amount} once the stockpile is empty" → "Revenue at risk once loadings are cut back ≈ US$3.3 M per day, US$6.7 M once the stockpile is empty" (tags: computed). It has no full stop. | site/src/ui/RevenueSection.tsx:54–55 |
| C23 | Detail panel, "How revenue at risk is worked out" box, third line, shown at the same times as C21 (the low-mark working line) | "A day’s shipping is a day’s share of that year. Loadings are cut back below {days} of stockpile." → "…Loadings are cut back below 1 day of stockpile." (tag: assumed) | site/src/ui/RevenueSection.tsx:70–71 |
| C24 | Stock meters under the timeline, row names | "Diesel", "ROM pad", "Stockpile" | site/src/ui/StockMeters.tsx:13–15 |
| C25 | Detail panel, the two section headings (same section, not on the original list) | "Production deferred so far"; "Revenue at risk" | site/src/ui/RevenueSection.tsx:37, :48 |
| C26 | Detail panel, working box, first line (same section, not on the original list) | "{tonnes} × {price} × the share of the year's shipping deferred so far." → "25 Mt/a × US$97.7/t × the share of the year's shipping deferred so far." (tags: assumed, sourced) | site/src/ui/RevenueSection.tsx:60–62 |
| C27 | Detail panel, working box, second line (same section, not on the original list) | "Shipping falls to {share} when {process} is degraded, and stops when it is stopped." → "Shipping falls to 50% when rail loading and haul to port is degraded, and stops when it is stopped." (tag: assumed) | site/src/ui/RevenueSection.tsx:65–66 |
| C28 | Detail panel, working box, last line (same section, not on the original list) | "Revenue at risk, not written off: shipments can recover once the stockpile refills." | site/src/ui/RevenueSection.tsx:74 |

## 5. The "12×" speed labels

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C29 | Timeline, playback speed buttons | "{N}×" → "12×", "24×", "48×", "96×" | site/src/ui/Timeline.tsx:204 (speeds at site/src/model/clock.ts:7) |
| C30 | Timeline, each speed button, read aloud only | "({N} hours per second)" → "(12 hours per second)" | site/src/ui/Timeline.tsx:204 |
| C31 | Timeline, name of the speed button group, read aloud only | "Playback speed" | site/src/ui/Timeline.tsx:195 |

## 6. "Based on" / "Modelled on"

The line under the scenario title in the top bar. "Modelled on" is used only when the scenario reproduces the public record and isn't a projection. Otherwise it reads "Based on" (rule explained at site/src/ui/TopBar.tsx:50–53). Free play has no source, so the line is not shown.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C32 | Top bar, under the title, for a scenario that reproduces the record | "Modelled on {source title}" → "Modelled on Scope Systems, Cyber incident updates (May 2026)" (as-reported scenario; tag: sourced) | site/src/ui/TopBar.tsx:69 (tag at :71) |
| C33 | Top bar, under the title, for any other scenario | "Based on {source title}" → "Based on Scope Systems, Cyber incident updates (May 2026)" (projection scenario; tag: sourced) | site/src/ui/TopBar.tsx:69 (tag at :71) |
| C34 | Top bar, badge (related, not on the original list) | "Fictional model site" | site/src/ui/TopBar.tsx:79 |
| C35 | Top bar, badge shown on projections (related, not on the original list) | "Projection" | site/src/ui/TopBar.tsx:85 |
| C36 | Top bar, title in free play (related, not on the original list) | "Your scenario" | site/src/ui/TopBar.tsx:14 |

## 7. Service-card status lines and Cut / Restore / Remove cut

Each outside service has a card with a status line and a button. "Day N" is the whole day number (hours ÷ 24, rounded down), counting from day 0 (site/src/ui/ServiceCard.tsx:41). The lines around ServiceCard.tsx:99–107 are the code's explanation. The words are at the lines given below.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C37 | Service card status, after a cut of that service has ended | "Restored day {n}" → "Restored day 12" (Hosted ERP, as-reported scenario) | site/src/ui/ServiceCard.tsx:67 |
| C38 | Service card status, before a planned cut has started | "Cut from day {n}" → "Cut from day 3" | site/src/ui/ServiceCard.tsx:69 |
| C39 | Service card status, while its own cut holds it down (related, not on the original list) | "Cut since day {n}" → "Cut since day 0" | site/src/ui/ServiceCard.tsx:60 |
| C40 | Service card status, when it is down because another service went down (related, not on the original list) | "Down via {card name}" → "Down via Corporate network" | site/src/ui/ServiceCard.tsx:59 |
| C41 | Service card status, vendor access revoked (related, not on the original list) | "Access revoked" | site/src/ui/ServiceCard.tsx:54 |
| C42 | Service card status, normal (related, not on the original list) | "Up" | site/src/ui/ServiceCard.tsx:71, :172 |
| C43 | Service card button, visible text | "Cut" (no cut planned); "Restore" (its cut is holding it down now); "Remove cut" (its cut hasn't started yet, or has ended) | site/src/ui/ServiceCard.tsx:107 (shown at :129) |
| C44 | Service card button, read aloud only: the "Restore <service>" variant | "{action} {service}" → "Restore Hosted ERP" (also "Cut Hosted ERP") | site/src/ui/ServiceCard.tsx:123 |
| C45 | Service card button, read aloud only, Remove cut variant | "Remove cut: {service}" → "Remove cut: Hosted ERP" | site/src/ui/ServiceCard.tsx:123 |

Notes:

- The Vendor remote access card has two small buttons. Each shows only a letter, "A" or "B" (site/src/model/serviceGroups.ts:44), and is read aloud as, for example, "Restore Vendor A remote access".
- After a cut that starts on day 0, the button reads "Restore", not "Remove cut". "Remove cut" shows only for a cut that hasn't started yet or has ended (2a follow-ups, line 65).

## 8. The "Why…" titles

The detail panel for an area of the mine (open it by clicking a flag on the model). Its first heading changes with the area's state.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C46 | Area panel heading, area running normally | "Why it is running" | site/src/ui/AreaPanel.tsx:24 |
| C47 | Area panel heading, area degraded | "Why it is degraded" | site/src/ui/AreaPanel.tsx:24 |
| C48 | Area panel heading, area stopped | "Why this stops" | site/src/ui/AreaPanel.tsx:24 |
| C49 | Area panel, under the "Why…" heading, when nothing it depends on is down (same block, not on the original list) | "Nothing on this process's dependencies is down at this hour." | site/src/ui/AreaPanel.tsx:183 |
| C50 | Area panel, under the "Why…" heading, when a service is back but orders are still held (same block, not on the original list) | "{service}: Back up — {reason}. Held for {hours} after each restore." → "Hosted ERP: Back up — New purchase orders held while transactions are reconciled by hand, to avoid duplicate orders. Held for 24 hours after each restore." (tag: assumed; the reason comes from the register) | site/src/ui/AreaPanel.tsx:174–176 |
| C51 | Area panel, the next two headings (same panel, not on the original list) | "Depends on"; "Continuity" | site/src/ui/AreaPanel.tsx:187, :199 |

## 9. The scroll hint

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C52 | Phone only: the strip of service cards above the model | **No wording.** The hint is visual only: the next card peeks 40 px in at the right edge and fades out, so the strip looks scrollable. Approve the visual hint as it is, or ask for wording. | site/src/styles/base.css:441–458 |

## 10. The camera hint and the "Fit" control

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C53 | The model, read aloud only when it has keyboard focus (the camera hint) | "Press plus or minus to zoom, and zero to fit the whole model in view." | site/src/ui/scene/DioramaScene.tsx:28 (placed at :166) |
| C54 | The model, the button in its corner, visible text | "Fit" | site/src/ui/scene/DioramaScene.tsx:205 |
| C55 | The same Fit button, read aloud only | "Fit the whole model in view" | site/src/ui/scene/DioramaScene.tsx:30 |
| C56 | The model, its name, read aloud only (related, not on the original list) | "Model site" | site/src/ui/scene/DioramaScene.tsx:163 |

## 11. Limitations page

There is one scenario line (C59), not several. The other bullets are listed so the page can be read whole.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C57 | Limitations page, first bullet | "This is a fictional site with synthetic data." | site/src/ui/pages/LimitsPage.tsx:17 |
| C58 | Limitations page, second bullet | "Lab timings are not comparable with timings on a real site." | site/src/ui/pages/LimitsPage.tsx:18 |
| C59 | Limitations page, third bullet: the scenario line, then a "Draft copy" tag, then the caveat (C16) | "{scenario title}." → "Hosted ERP lost: what if the workarounds ran out." followed by the C16 sentence | site/src/ui/pages/LimitsPage.tsx:20–21 |
| C60 | Limitations page, fourth bullet | "Lead times model delivery delay, not delivery rate; there is no delivery-rate modelling." | site/src/ui/pages/LimitsPage.tsx:23 |
| C61 | Limitations page, fifth bullet: the network line (after a "Draft copy" tag) | "The network view is not built yet. The cables and entry posts show which outside services the site depends on, but not how each service’s network runs across the site." | site/src/ui/pages/LimitsPage.tsx:25–26 |
| C62 | Limitations page, closing paragraph ("decision log" is a link) | "Every modelling choice, and why it was made, is in the decision log (placeholder until the repo is public)." | site/src/ui/pages/LimitsPage.tsx:30–31 |

## 12. Page metadata (site/index.html)

What browsers and link previews show: the browser tab title, search-result text, and the link-preview card.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C63 | Browser tab title; also the link-preview title (og:title, line 11, same words) | "FailLocal: what stops a mine when the systems outside it go down?" | site/index.html:6 (and :11) |
| C64 | Search-result and link-preview description (og:description, line 12, same words) | "A playable model of a fictional Pilbara iron ore mine. Cut the outside services it relies on, watch what stops and what it costs, then see what a prepared site does differently." | site/index.html:7 (and :12) |
| C65 | Link-preview image, text description for screen readers (og:image:alt) | "An isometric scale model of a fictional iron ore mine, with five outside services cabled into it. Fictional model site." | site/index.html:17 |

## 13. Everything currently marked as draft or placeholder

Each marker below must be gone before release. The release check fails the build while any remains.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C66 | Guided run, grey tag above every caption (marks C4–C15) | "Draft copy" | site/src/ui/GuidedRun.tsx:134 |
| C67 | Guided run closing card, grey tag (marks C17–C19 and C16) | "Draft copy" | site/src/ui/GuidedRun.tsx:179 |
| C68 | Limitations page, grey tag on the scenario line (marks C59 and C16) | "Draft copy" | site/src/ui/pages/LimitsPage.tsx:20 |
| C69 | Limitations page, grey tag on the network line (marks C61) | "Draft copy" | site/src/ui/pages/LimitsPage.tsx:25 |
| C70 | Limitations page, closing paragraph | "(placeholder until the repo is public)" | site/src/ui/pages/LimitsPage.tsx:31 |
| C71 | Welcome page byline | "[Your name]" | site/src/ui/pages/WelcomePage.tsx:71 |
| C72 | Address of every "decision log" link (Limitations page, caveat) | "https://github.com/[owner]/faillocal/blob/main/docs/decisions.md" | site/src/ui/decisionLog.ts:2 |

Code comments also call some text draft: site/src/model/guided.ts:77, site/src/ui/AssumptionCaveat.tsx:27 and site/src/ui/pages/BuiltPage.tsx:1. Visitors never see these comments.

### "How I built this" page, in full

Every visible line of site/src/ui/pages/BuiltPage.tsx, top to bottom. Rows marked **PLACEHOLDER** or **DRAFT BANNER** are markers, not finished text.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C73 | How I built this, banner at the top (**DRAFT BANNER**) | "Draft — awaiting owner review" | site/src/ui/pages/BuiltPage.tsx:5–6 |
| C74 | How I built this, page heading | "How I built this" | site/src/ui/pages/BuiltPage.tsx:8 |
| C75 | How I built this, paragraph 1 | "I set the goals for FailLocal and the honesty rules it follows, and I approved the design before it was built." | site/src/ui/pages/BuiltPage.tsx:10 |
| C76 | How I built this, paragraph 2 | "Claude Code, Anthropic’s coding agent, wrote the code and drafted the copy under that direction. Where it had to choose, it asked, or wrote the choice down for me to accept or change." | site/src/ui/pages/BuiltPage.tsx:13–14 |
| C77 | How I built this, paragraph 3 (contains the sentence you must check) | "Claude Code proposed every modelling judgement and recorded it in the decision log; I reviewed each one and accepted or changed it." | site/src/ui/pages/BuiltPage.tsx:17–18 |
| C78 | How I built this, second heading | "How it was checked" | site/src/ui/pages/BuiltPage.tsx:20 |
| C79 | How I built this, checks, bullet 1 | "Automated tests on the simulation engine and on this site, including the wording and provenance rules." | site/src/ui/pages/BuiltPage.tsx:22 |
| C80 | How I built this, checks, bullet 2 | "An independent reviewer read every task’s changes before it was accepted." | site/src/ui/pages/BuiltPage.tsx:23 |
| C81 | How I built this, checks, bullet 3 (**PLACEHOLDER**) | "[Placeholder: whole-branch review — confirm once done]" | site/src/ui/pages/BuiltPage.tsx:24 |
| C82 | How I built this, checks, bullet 4 ("docs/decisions.md" is shown in code type) | "A decision log, docs/decisions.md, records each modelling choice, the reasoning behind it and where its numbers come from." | site/src/ui/pages/BuiltPage.tsx:26–27 |
| C83 | How I built this, third heading | "What I learned" | site/src/ui/pages/BuiltPage.tsx:30 |
| C84 | How I built this, What I learned, bullet 1 (**PLACEHOLDER**, for you to write) | "[Placeholder for the owner: what building this taught you about how a mine depends on services outside its fence.]" | site/src/ui/pages/BuiltPage.tsx:33–34 |
| C85 | How I built this, What I learned, bullet 2 (**PLACEHOLDER**, for you to write) | "[Placeholder for the owner: what you learned about directing an AI coding agent and checking its work.]" | site/src/ui/pages/BuiltPage.tsx:37 |

**The sentence to check.** The words "I reviewed each one and accepted or changed it" are on the page now, at site/src/ui/pages/BuiltPage.tsx:17–18. They are not a sentence of their own. They are the clause after the semicolon in C77: "Claude Code proposed every modelling judgement and recorded it in the decision log; I reviewed each one and accepted or changed it." The release plan says this is true only once you have walked the decision log (docs/superpowers/plans/2026-10-28-faillocal-release-2.md, owner gate item 5).

## 14. Welcome page (also the link-preview image)

The link-preview image (site/public/og.png) is a 1200 × 630 screenshot of this page, taken by site/scripts/og-image.mjs:2–3. It shows the headline, the model on its plinth and the plinth's plate. Change any wording here and the image must be taken again.

| # | Where it shows | Current text | Source |
|---|---|---|---|
| C86 | Welcome page, site name at the top left | "FailLocal" | site/src/ui/Brand.tsx:18 |
| C87 | Welcome page, headline | "What stops a mine when the systems outside it go down?" | site/src/ui/pages/WelcomePage.tsx:44 |
| C88 | Welcome page, first paragraph (the last two sentences are in bold) | "In May 2026, a ransomware attack on Scope Systems, a Perth company that hosts finance and maintenance software for miners, took it offline for about twelve days. **The plants were fine. Purchasing, maintenance and payroll were not.**" | site/src/ui/pages/WelcomePage.tsx:46–48 |
| C89 | Welcome page, second paragraph | "This is a fictional model iron ore site. Cut the outside services it relies on, watch what stops and what it costs, then see what a prepared site does differently." | site/src/ui/pages/WelcomePage.tsx:51–52 |
| C90 | Welcome page, main button (starts the guided run) | "Show me the site" | site/src/ui/pages/WelcomePage.tsx:56 |
| C91 | Welcome page, second button (starts free play) | "Explore freely" | site/src/ui/pages/WelcomePage.tsx:62 |
| C92 | Welcome page, small print ("Sources →" is a link) | "Built from public sources: Scope Systems incident updates, the MM-ISAC Mining OT Reference Architecture (2026), Rio Tinto’s Western Australia operations and the World Bank Pink Sheet. Sources →" | site/src/ui/pages/WelcomePage.tsx:66–68 |
| C93 | Welcome page, byline ("How I built this →" is a link; "[Your name]" is C71) | "Built by [Your name], cyber security graduate, Perth · How I built this →" | site/src/ui/pages/WelcomePage.tsx:71–72 |
| C94 | The plate on the front of the model's plinth (in the preview image and on the site page). DESIGN.md calls this fixed engraved wording. | "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA" | site/src/model/sceneState.ts:21 |
