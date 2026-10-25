# Art-direction mockup brief: shared by all three directions

Read first: `/Users/rob/Documents/FailLocal/PRODUCT.md` (product truth) and `/Users/rob/.claude/plugins/cache/impeccable/impeccable/4.1.0/skills/impeccable/reference/craft-floor.md` (quality floor and bans). The spec is at `/Users/rob/Documents/FailLocal/docs/superpowers/specs/2026-10-22-faillocal-design.md` if you need detail.

## What you are making

Two self-contained, static HTML files in your direction's folder. Inline CSS and JS only; Google Fonts are allowed; no other network assets, and no bitmap images. **All art is vector drawn in code (inline SVG and/or canvas).** These are art-direction mockups that will be screenshotted at **1440×900** and also opened live. They are not production code, but they must be at production visual fidelity. The owner chooses a world from them.

1. `welcome.html`: the landing page a recruiter sees first.
2. `site.html`: the living site view, animated, frozen at one moment of the hero scenario, with one side panel open.

Both must render fully within 1440×900 with nothing important below the fold. They must also be sane at 390×844 (phone), but the screenshot is desktop.

## Audience and bar

In-house mining recruiters (they know mining, not security), operations leaders, and security interviewers. It must look like a **real, serious industry product**. The owner's anti-goals: **toy-like / cartoonish**, **generic cyber dashboard (dark + neon)**, **corporate bland SaaS**, **inaccurate mining details**. The owner liked Mini Metro / Mini Motorways (calm, beautiful motion along clean lines) and city-builders (lively, detailed worlds).

## Mining accuracy (a mining person must not wince)

A fictional Pilbara iron ore open-pit site, flowing pit → ROM pad → primary crusher → overland conveyor → stockpile yard → train loadout → rail to Port Hedland.

- **Pit:** terraced benches (concentric stepped walls) with a spiral haul ramp. Red-brown ochre and banded-iron hues; a small sump of water at the pit floor is fine.
- **Haul trucks:** ultra-class rear-dump trucks (CAT 793 / Komatsu 930E class), yellow, at a consistent scale. They are about 7 m wide; the ramp is about 3 truck widths wide.
- **ROM pad:** next to the primary crusher (gyratory), with a dump pocket.
- **Conveyor:** a long overland conveyor to the stockpile yard (windrow stockpiles built by a stacker), then a reclaimer to the train loadout bin over a rail balloon loop.
- **Ore train:** very long, with many dark ore wagons and two or three locomotives at the head. It moves slowly.
- **Supporting infrastructure:** a fuel farm (bunded diesel tanks) with a fuel bay, an explosives magazine set well away from everything, a heavy-vehicle workshop, an administration area and a camp/village off to one side.
- **Landscape:** Pilbara red earth, spinifex (grey-green tussock), dry creek lines (a pale braided channel), and a ridge or two.
- No smiley faces, no bouncy cartoon physics. Proportions stay consistent.

## The frozen moment (use this content; numbers are illustrative but labelled honestly)

Scenario: **"Hosted ERP lost"**, modelled on the Scope Systems outage (Perth, May 2026: about 12 days to full restore). Variant: **unprepared site**. Mode: **projection: "what if the workarounds ran out"**. Time: **Day 6 of 12**.

- **Outside services strip:** Hosted ERP (**cut**), Cloud login (up), Perth IROC link (up), Vendor remote access (up). Each has a cut control.
- **Process states:**
  - Diesel ordering: **STOPPED** ("Purchase orders by email ran out of road")
  - Explosives ordering: **STOPPED**
  - Work orders: **DEGRADED** (paper work orders)
  - Payroll: **DEGRADED** (pay run delayed)
  - Haulage: **DEGRADED** (diesel rationed: 3 of 8 trucks parked at the fuel bay)
  - Drill & blast: **DEGRADED** (no new blasts)
  - Crushing: **DEGRADED** (ROM pad running low)
  - Rail: **NORMAL** (stockpile buffering)
- **Stocks:** diesel 1.4 days, ROM pad 0.6 days, stockpile 2.1 days.
- **Revenue counter** (labelled "computed"): Production deferred so far **0 t**, with the note "stockpile still buffering rail". **Revenue at risk once the stockpile runs dry: ≈ US$11 M per day**, with working shown as "40 Mt/a (assumed) × US$100/t (assumed)".
- **Labels:** every number carries a small provenance label: **sourced**, **assumed**, **measured** or **computed**. "Production deferred" and "revenue at risk", never "lost".
- **Persistent badges:** "Fictional model site" and "Projection".
- **Controls:** an Unprepared / Prepared toggle, a day timeline or scrubber (0–12) at day 6, and a "Show the network" toggle (off).
- **Open side panel: Haulage.**
  - State: Degraded. Diesel rationed.
  - Depends on: diesel stock (1.4 d, computed); broken-ore stock; Perth IROC supervision (autonomous haulage).
  - Maximum tolerable outage: 24 h (assumed). Recovery target: 12 h (assumed).
  - Independent copy: n/a. Last restore test: none. Owner: Mining Superintendent.
  - Small line: "Why this stops: diesel is ordered through the hosted ERP."
- **Animation in `site.html`:**
  - 5 trucks moving on the ramp and haul roads; 3 parked and greyed at the fuel bay
  - the conveyor running slowly
  - the train moving along the rail loop
  - one subtle "stopped" signal on the ERP link
  - Respect `prefers-reduced-motion` (render static).

`welcome.html` copy (adapt tone to your world, keep the facts):
- Headline: "What stops a mine when the systems outside it go down?" (or an equally plain variant).
- Short paragraph: in May 2026, a ransomware attack on Scope Systems, a Perth company that hosts finance and maintenance software for miners, took it offline for about twelve days. The plants were fine. Purchasing, maintenance and payroll were not.
- Short paragraph: this is a fictional model iron ore site. Cut the outside services it relies on, watch what stops and what it costs, then see what a prepared site does differently.
- Primary action: "Show me the site". Secondary action: "Watch the 2-minute walkthrough".
- Small print: "Built from public sources: Scope Systems incident updates, MM-ISAC Mining OT Reference Architecture (2026), BHP and Rio Tinto annual reports. Sources →"
- Byline: "Built by [Your name], cyber security graduate, Perth · How I built this →"
- The welcome page should preview the world (e.g. a slice of the site art), not be a blank text page.

## Rules

- Obey craft-floor bans: no eyebrow/kicker labels above headings, no gradient text, no glass decoration, no emoji or Unicode glyphs as icons (draw SVG icons in the world's stroke), no monospace costume, no same-size card grids, no coloured thick left borders. Theme selection, focus rings and scrollbars.
- Status must be readable **without colour** (marks, patterns, words), as well as with it.
- Mining vocabulary on the front; no security jargon on the front.
- When done: open each file in headless Chrome at 1440×900 to check it renders. Use `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=3000 --screenshot=<out.png> file://<path>`. Save `welcome.png` and `site.png` in your folder, look at them, fix what is broken, and re-screenshot **once**. Two rounds maximum.
- Report back in under 150 words: file paths, a three-line summary of the world (palette, type, signature move) and any honest risk.
