---
name: FailLocal
description: A playable scale model of a fictional Pilbara iron ore mine. Cut the outside services and watch what stops.
colors:
  ink: "#1d1a17"
  ink-2: "#554e47"
  ink-3: "#6c645c"
  paper: "#faf8f4"
  paper-2: "#f3efe8"
  gallery-floor: "#ebe6de"
  line: "#d8d0c4"
  line-2: "#c4bbad"
  computed-fill: "#efe9df"
  state-wash: "#fbf6ea"
  cut-wash: "#f6f1ea"
  meter-track: "#e4ddd2"
  stop-red: "#b3261e"
  stop-red-text: "#9d1f18"
  degraded-amber: "#d4940a"
  hivis: "#f2b01e"
  hivis-pressed: "#e09d0c"
  hivis-parked: "#bfae86"
  oxide-low: "#9a3f24"
  oxide-high: "#bf6a36"
  ironstone-low: "#57302a"
  ironstone-high: "#7d4630"
  spinifex-low: "#8e9a6c"
  spinifex-high: "#a9ad7d"
  galvanised: "#d9d5cc"
  roof-steel: "#a6abae"
  haul-road: "#c79c74"
  ore-load: "#9a4224"
  wagon-dark: "#3d3532"
  plinth: "#3b3632"
  plate-engraving: "#cfc6bb"
  shade-dark: "#2a1a20"
  shade-lite: "#fff4e0"
  cast-shadow: "#3b160b"
  hatch-ink: "#1c1916"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 760
    lineHeight: 1.03
    letterSpacing: "-0.027em"
    fontVariation: "'wdth' 86"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 740
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 94"
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 720
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 90"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 680
    lineHeight: 1.15
    fontVariation: "'wdth' 88"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 100"
  body-long:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 94"
  tag:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 92"
rounded:
  tag: "3px"
  control: "5px"
  card: "6px"
  button: "7px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  gutter: "20px"
  page: "64px"
components:
  service-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0 8px 0 9px"
    width: "240px"
    height: "58px"
  service-card-cut:
    backgroundColor: "{colors.cut-wash}"
    textColor: "{colors.stop-red}"
    rounded: "{rounded.card}"
  cut-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "28px"
  restore-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "28px"
  button-primary:
    backgroundColor: "{colors.hivis}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 20px 0 22px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.hivis-pressed}"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "26px"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  tag-computed:
    backgroundColor: "{colors.computed-fill}"
    textColor: "{colors.ink-2}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    height: "16px"
  tag-assumed:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    height: "16px"
  detail-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "16px 20px 18px"
    width: "372px"
  state-box:
    backgroundColor: "{colors.state-wash}"
    rounded: "{rounded.card}"
    padding: "11px 12px"
  plaque:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    height: "31px"
  plaque-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.tag}"
    height: "31px"
---

# Design System: FailLocal

## Overview

**Creative North Star: "The Living Diorama"**

FailLocal is the scale model of the mine that stands in a head-office foyer, switched on. An engineering-true dimetric slab of Pilbara ground, cut away at the edges to show the strata, sits on a dark plinth on a pale gallery floor. The outside services (Hosted ERP, Cloud login, Perth IROC link, Vendor remote access) are physical cables that run down from the top edge and plug into posts on the board's northern rim. Cutting one breaks the cable, and the consequence spreads across the land: trucks park at the fuel bay, ground is hatched, survey flags go up. The world refuses the flat map-plus-sidebar dashboard.

Two materials share the screen and must never blur into each other. The **scene** is lit, faceted and earthy: iron-oxide reds and ochres, dark ironstone, grey-green spinifex, galvanised plant, hi-vis yellow trucks, dark ore wagons, all drawn as flat-shaded polygons under one light. The **chrome** is paper and ink: warm off-white panels, near-black type in Archivo with the width axis doing the work of hierarchy, hairline rules, and small boxed provenance tags on every number. Chrome is quiet so the model can be loud; the only saturated colours in the chrome are the state colours and the hi-vis call to action.

Density is that of an operations tool, not a marketing page: 14 px body, 12 px labels, tabular numerals everywhere, a docked 372 px detail panel and a 92 px timeline strip. The landing page is the one place the type opens up (52 px display, 17 px prose) and the model is cropped full-bleed behind it.

**Key Characteristics:**
- True 2:1 dimetric projection, every dimension in metres, one north-west light, computed facet tones.
- Paper-and-ink chrome; colour reserved for state and for the scene.
- State told by shape first (flag form, hatching, dashes, parked marker), colour second.
- Every number carries a provenance tag: sourced, measured, assumed or computed.
- Dashed always means "not solid": assumed, projected, cut or dead.
- The art is vector drawn in code. No bitmaps, no stock imagery.

## Colors

A warm paper-and-ink chrome around a lit iron-oxide scene, with exactly two signal hues (stop red, degraded amber) and one action hue (hi-vis yellow).

### Primary
- **Hi-Vis Haul Yellow** (`hivis`): the colour of a working haul truck and the one primary action on the landing page ("Show me the site"). It is also the selection highlight. Pressed/hover deepens to **Hi-Vis Pressed** (`hivis-pressed`). A parked truck is desaturated to **Parked Khaki** (`hivis-parked`), never left yellow.

### Secondary
- **Stop Red** (`stop-red`): stopped state only. The full survey flag, the slash across a cut service icon, the cut-link ring, "Link cut" text, the red stroke in the brand mark. **Stop Red Text** (`stop-red-text`) is the darker variant used when the word "Stopped" is set as small text on paper.
- **Degraded Amber** (`degraded-amber`): the half flag's triangle and nothing else.

### Tertiary (the scene)
- **Oxide Ground** (`oxide-low` to `oxide-high`): the faceted ground is a noise blend between these two, darkened toward the western ridge and lightened toward the creek.
- **Ironstone Ridge** (`ironstone-low` to `ironstone-high`): the western range, blended by height.
- **Spinifex** (`spinifex-low` to `spinifex-high`): grey-green tussocks scattered over open ground, each with a low red-brown ground shadow.
- **Galvanised Plant** (`galvanised`) and **Roof Steel** (`roof-steel`): sheds, tanks, crusher, conveyors, camp.
- **Haul Road** (`haul-road`): haul roads and the pit ramp, edged by a darker windrow band.
- **Ore Load** (`ore-load`): ore in a truck tray, a loaded wagon, the conveyor ore dashes.
- **Ore Wagon** (`wagon-dark`): dark wagons on the balloon loop.
- **Plinth** (`plinth`) with **Plate Engraving** (`plate-engraving`): the model's base and its engraved plate.

### Neutral
- **Ink** (`ink`): all text, all outlines in chrome and on flags/cables, active control fills.
- **Ink 2** (`ink-2`): secondary text, labels, tag text. **Ink 3** (`ink-3`): fine print, timeline axis numerals, event hairlines.
- **Paper** (`paper`): panels, cards, plaques, timeline strip. **Paper 2** (`paper-2`): control hover wash.
- **Gallery Floor** (`gallery-floor`): page background; the stage is a radial gradient around it (about `#f1ede6` centre to `#e1dad0` edge).
- **Line** (`line`) and **Line 2** (`line-2`): hairline dividers and control borders respectively.
- **Computed Fill** (`computed-fill`), **State Wash** (`state-wash`), **Cut Wash** (`cut-wash`), **Meter Track** (`meter-track`): the four tinted fills chrome is allowed.
- **Shade Dark** (`shade-dark`) and **Shade Lite** (`shade-lite`): not used directly; they are the two poles every facet tone is mixed toward (see Elevation & Depth).
- **Cast Shadow** (`cast-shadow`) and **Hatch Ink** (`hatch-ink`): scene shadow and the stopped-ground hatching.

### Named Rules
**The No Green Rule.** Normal is a white open pennant, not a green anything. The scene owns the earth palette; the chrome has only two signal hues, and "fine" is the absence of signal.

**The Parked Is Desaturated Rule.** Anything not working loses its colour (parked trucks go khaki, a cut service's entry post goes from galvanised to `#8a817a`). Colour on the board means activity.

## Typography

**Display Font:** Archivo (with system-ui, sans-serif)
**Body Font:** Archivo, the same family
**Label/Mono Font:** none; Archivo with tabular numerals stands in for a mono face

**Character:** One grotesque driven along its width axis (`wdth` 62 to 125 loaded). Condensed widths read as engineering signage and let long mining names fit in narrow plaques and cards; full width is reserved for reading.

### Hierarchy
- **Display** (760, 52 px, 1.03, `wdth` 86, -0.027em, balanced wrap): the landing question only. 34 px on phone.
- **Headline** (740, 23 px, 1.1, `wdth` 94): detail panel heading (the process area name).
- **Figure** (720, 24 to 25 px, 1, `wdth` 90 to 92, -0.02em): the day number and revenue-at-risk value; units follow at 13 to 14 px, weight 550 to 600, in ink-2.
- **Title** (680, 13 to 15 px, `wdth` 88 to 96): service card names, scenario name in the top bar, plaque names (11 px in the scene), the brand word (760, 17 to 19 px, `wdth` 96).
- **Body** (400, 14 px, 1.4, `wdth` 100) in the app; **Body Long** (400, 17 px, 1.55, max 31em, pretty wrap) on the landing page.
- **Label** (600 to 650, 11.5 to 12.5 px, `wdth` 92 to 94): status lines, legend, controls, stock names, dt/dd rows.
- **Tag** (600, 10 px, `wdth` 92, +0.02em): provenance tags only.

### Named Rules
**The Width Before Size Rule.** Hierarchy comes from width and weight before size: display at 86%, figures at 90%, titles at 88 to 96%, labels at 92 to 94%, prose at 100%. Do not add a second typeface to get contrast.

**The Tabular Everything Rule.** `font-variant-numeric: tabular-nums` is set at the body. Counters, stocks, days and money must not jitter as engine output changes.

## Layout

**Projection.** The scene is a true 2:1 dimetric projection in metres. A world point maps to screen as `screenX = originX + (x − y)·k`, `screenY = originY + (x + y)·k/2 − z·k·1.2247`, where `k` is pixels per metre (0.83 in the app, 1.18 on the landing hero) and 1.2247 is the vertical factor for a 30° camera. World +x runs to screen lower-right, +y to screen lower-left, z is up, north is the top corner. The board is 720 × 480 m. Depth order is by `x + y` (plus small biases for height), painter's algorithm. In the production build this is the PixiJS scene's single projection function; nothing is placed in screen space except chrome.

**App frame (desktop).** A three-row grid: a 60 px top bar, the stage, and a 92 px timeline, with a 372 px detail column docked right across all three rows (minimum height 640 px). The stage holds the model at about 70% of the viewport, the four service cards pinned along its top edge at their cable positions (they scale with the letterboxed scene, never above 1×), and the legend bottom-right. The timeline strip splits 186 px (day + play) / flexible track / 250 px (stocks). Panel gutters are 20 px; inner rhythm runs 4 / 8 / 12 / 16 px.

**Landing.** The model is a fixed full-bleed layer cropped to the right; copy sits in a 590 px column with a 64 px left margin over the open gallery floor. The services appear as small boxed labels cabled into the board. The landing mock also applies a CSS perspective and rotation (`rotateX(9deg) rotateZ(-1.6deg)`) to the whole hero layer; that is a presentational one-off the mock carries, not part of the projection, and it skews the cabled labels. The production scene renders the dimetric board untilted.

**Phone (≤ 760 px).** The grid collapses to a single column. Service cards become a horizontally scrolling strip of 210 px cards above the scene; the cables are hidden; the scene's view box crops to the working area of the board; legend wraps; timeline and stocks stack. The network overlay, assets tab and assumptions editor stay desktop-only.

**Cables.** Service cables are octilinear: straight vertical and horizontal runs joined by 9 px 45° chamfers, dropping from the card to a horizontal bus, then to an entry post on the board's northern rim at (entry, 0, 0). Buses sit at two heights so neighbours do not cross.

## Elevation & Depth

A hybrid with a hard boundary. **The chrome is flat**: depth comes from hairlines and tinted fills; the only shadows are a whisper under floating service cards and a coloured lift under the hi-vis button. **The scene is lit**: every surface takes a computed tone from one directional light, and every object casts a soft ground shadow.

**Light.** One light from the north-west, low sun: `L = normalize(−1, 0.1, 1.05)`. For a face normal `n`, `b = dot(n̂, L)·0.8 − 0.12`. The face tone is the base colour mixed toward `shade-dark` by `0.6·|b|` when `b < 0`, or toward `shade-lite` by `0.5·b` when `b > 0`. This gives three canonical faces for axis-aligned boxes: top `b ≈ +0.46` (lightest), the +y face (screen lower-left) `b ≈ −0.07` (near base), the +x face (screen lower-right) `b ≈ −0.67` (darkest). Worked check: galvanised `#d9d5cc` gives top `#e2dcd1`, left face `#d2cec5`, right face `#938a87`; hi-vis `#f2b01e` gives `#f5c04a` / `#eaaa1e` / `#a2741f`. Curved solids (tanks, cones, windrows) are faceted (12 to 24 sides) and toned per facet by the same function, with back faces culled. Ground triangles sit at `b ≈ top − 0.42 ± 0.045` so the land reads as matte against lit plant.

**Cast shadows.** Each object projects its footprint by `(1.5, −0.15)` metres per metre of height, takes the convex hull of footprint plus offset footprint, and fills it with `cast-shadow` at 34% opacity, softly blurred (about 1.6·k px). The whole model also sits on a large blurred plinth shadow on the gallery floor.

**Cut-away slab.** The two visible board edges show strata bands (alternating oxide reds, ochres and dark ironstone, top 0 to −30 m), then the plinth (two tones: lower-left face `#3b3632`, lower-right `#25221f`), with a pale lit lip along the top edge.

### Shadow Vocabulary
- **Card float** (`box-shadow: 0 1px 0 rgba(29,26,23,.04), 0 6px 14px -8px rgba(60,40,25,.25)`): service cards over the stage only.
- **Hi-vis lift** (`box-shadow: 0 1px 0 rgba(29,26,23,.25), 0 10px 22px -12px rgba(150,95,10,.55)`): the primary landing button.
- **Toggle knob** (`box-shadow: 0 1px 2px rgba(29,26,23,.3)`): the switch thumb.

### Named Rules
**The One Sun Rule.** Every facet in the scene is toned by the same light vector and the same two shade poles. No hand-picked side colours, no second light, no gradients on solids.

**The Flat Chrome Rule.** Panels, the timeline and the top bar have no shadow. If chrome needs separation, it gets a hairline in `line`.

## Shapes

Small, consistent radii on chrome: 3 px for tags, plaques and odometer cells; 5 px for controls; 6 px for cards, the state box and the legend; 7 px for the segmented control and the landing button; full pills only for the scenario badges; circles for play buttons. Borders are 1 px hairlines; 1.5 to 2 px is reserved for ink outlines that must read at a distance (focus ring 2 px, play button 1.5 px on landing, timeline elapsed line 3 px).

In the scene, everything is a polygon: boxes, oriented boxes, beams, faceted cylinders and convex solids, all drawn as flat fills with a 0.45 px same-colour stroke to close hairline seams. Organic forms (creek, roads, pit crests) are Chaikin-smoothed polylines. Trees and spinifex are the only round shapes: stacked ellipses in three greens.

The brand mark is a pit in section (four stacked bench lines narrowing upward) with a short Stop Red stroke cutting the top right.

## Components

### Service Card (signature)
The four outside services. Paper card (240 × 58 px, 6 px radius, `line-2` border, card float shadow), a 30 px line icon drawn in ink on paper, the name as Title (`wdth` 88), status below as Label ("Up"), and a Cut button at right.
- **Cut state:** border goes 1 px dashed ink, fill `cut-wash`, a Stop Red diagonal slashes the icon, the status line turns Stop Red at 650 with a break glyph ("Cut since day 0"), and the button becomes Restore.
- **Cut / Restore button:** 28 px high, 5 px radius. Cut is paper with `line-2` border and a scissors glyph; hover darkens the border to ink on white. Restore is ink-filled with paper text and a joined-cable glyph; hover lightens to `#3a3430`. The button carries `aria-pressed`.

### Cable and Entry Post
Ink, 1.5 px, octilinear. A live cable carries a small paper dot with an ink ring travelling along it (5 to 7 s per run, staggered). A **severed cable** stops at a break symbol: two short 10 px horizontal bars 16 px apart, a blinking Stop Red ring (r 3.2) between them, a boxed "Link cut" label in Stop Red, and the remaining run to the post dashed at 55% opacity. Each cable lands on a 3 × 3 × 5 m entry post; a cut service's post is desaturated.

### Survey Flags and Plaques (state grammar)
Each process area has a pole planted at its location in world space, with a small ground ellipse at its foot, a flag at the top, and a plaque beside it. Pole length is chosen per area so plaques do not collide.
- **Stopped:** full rectangular flag in Stop Red with a white X, plus **hatched ground** over the affected pad: a 7 px pattern rotated 26.565° (the board's x-axis slope, so hatches run with the land), `hatch-ink` lines at 62% over an 8% wash, and a dashed outline (5/3) around the area.
- **Degraded:** white rectangular flag with the lower-left triangle filled Degraded Amber.
- **Normal:** white open triangular pennant.
- **Parked:** a boxed pause glyph (11 px paper square, two ink bars) on a short post above each parked truck; the truck itself goes khaki.
- **Plaque:** paper box, 3 px radius, 0.8 px ink stroke at 96%, 31 px high. Line 1 is the area name (11 px, 680); line 2 is the state word in bold (Stop Red Text for stopped) and a short note ("Diesel rationed"). **Selected** plaque inverts to ink fill with paper text and a heavier 1.6 px pole.

### Legend
Bottom-right of the stage, a translucent paper strip (86%) with `line` border, 6 px radius. Each entry draws the actual glyph followed by the state word in ink at 650 and its shape description in ink-2 ("full flag, hatched ground"). It names shapes, not colours.

### Docked Detail Panel
The 372 px right column. On top, the **revenue section**: "Production deferred so far" with an odometer (21 × 30 px cells, 3 px radius, `computed-fill`, unlit digits `#a99f93`, lit digit in ink on `#e7e0d5`, grouped in threes with 5 px gaps, unit after), then a hairline, then "Revenue at risk" as a Figure with its working shown inline (each input followed by its tag). Below, the scrolling **area panel**: Headline name with a one-line description, a 30 px square close button, the **state box** (`state-wash`, `line-2` border) with flag, state word, note, the fleet row (eight small truck glyphs, parked ones khaki with the pause marker) and a computed count; then "Why this stops"; then **Depends on** and **Continuity** as ruled rows (hairline between, value right-aligned at 650 with its tag). Section headings are 12 px, 700.

### Day Timeline
A 12-day axis drawn at the real pixel width of its container (never stretched). Elapsed time is a solid 3 px ink line up to "now"; the projection beyond is a 1.5 px dashed line. Daily ticks, longer ticks every 6 days, numerals in ink-3. "Now" is a paper disc (r 8, 2 px ink ring, ink centre). Events are dashed `ink-3` hairlines with labels above or below, each label ending in a small tag word in ink-3. A 38 px circular play button and the "Day 6 of 12" Figure sit at left with a two-line projection note.

### Stock Meters
Three rows (Diesel, ROM pad, Stockpile): 64 px name in ink-2, a 6 px track (`meter-track`, 3 px radius) with an ink fill, the value in days at 680, and a computed tag.

### Provenance Tags
16 px high, 3 px radius, 10 px type in ink-2. The four kinds are told apart by border, not colour: **computed** filled `computed-fill` with no visible border; **assumed** dashed `line-2`; **sourced** solid `ink-3`; **measured** solid `ink-3` with a 2 px bottom edge. A tag always follows the number it qualifies.

### Top Bar Controls
- **Badges:** 24 px pills, 1 px ink border, 12 px label with a line glyph. "Fictional model site" is solid; "Projection" is dashed.
- **Segmented control** (Unprepared / Prepared): paper well with `line-2` border, 7 px radius, 2 px inset; the pressed segment is ink with paper text; hover on others washes `paper-2`.
- **Switch** ("Show the network"): 30 × 18 px track in `#cfc6b9`, paper knob, ink track when on, knob travels 12 px on `cubic-bezier(.2,.8,.2,1)` over 0.2 s.

### Landing Buttons
- **Primary:** hi-vis fill, ink text 16 px 700, 50 px high, 7 px radius, hi-vis lift; hover deepens to `hivis-pressed` and nudges the arrow 3 px right; active drops 1 px.
- **Ghost:** a 34 px ink-ringed circle with a play glyph and a 15 px 600 label; hover fills the circle ink and underlines the label.

### Network Overlay (on the ground)
Service networks drawn flat on the board in ink. Live runs are a 1.25 px ink line over a 3 px paper halo with filled ink nodes; dead runs are dashed (3.5/3) over the halo with hollow paper nodes.

### Motion
The animation renders engine output; nothing is hand-timed in the chrome. Trucks run a closed haul cycle (dump pocket, haul road, spiral ramp, pit floor, shovel, and back in the opposite lane, offset ±4.6 m), loaded on the way up. Trucks shed dust puffs every 0.22 s that drift and fade over 2.6 s. The ore train circles the balloon loop and wagons fill as they pass the loadout bin. Conveyor ore is a dashed stroke moving at a steady 9 s cycle. Live cables carry travelling dots; the cut-link ring pulses on a 2.4 s ease-in-out. Light vehicles loop the access road. Frame updates are throttled to about 30 ms. **Reduced motion** renders a single still frame of the same engine state (the scene is not hidden), replaces travelling dots with static dots at the bus corner, stops the pulse and belt, and drops UI transitions.

### Mining Accuracy (the model's invariants)
The art must stay true to a real open-pit iron ore operation, because recruiters will notice:
- Pit: five benches, 12 m high, 5 m batter run, 11 m berms; a spiral ramp about 25 m wide at roughly 11% grade, cut into the walls; a sump on the floor; a face shovel on the floor and a drill with a blast-hole pattern on the first bench.
- Haul trucks are ultra-class (CAT 793 / Komatsu 930E): 13 m long, 7.6 m wide, cab on the left, loaded trays carry a visible ore heap. Haul roads are 26 m with darker windrow edges.
- The workshop has four roller doors sized for ultra-class trucks. Diesel tanks sit in a bund; the fuel bay has a canopy.
- The explosives magazine is two magazines in earth bunds inside a fence, in the far corner away from everything else.
- Crushing: ROM pad with stocks feeding a primary gyratory crusher with a dump pocket; an overland conveyor on a raised gallery over the creek to the stockyard.
- Stockyard: windrows built by a rail-mounted stacker and recovered by a bucket-wheel reclaimer; a reclaim conveyor rises to a loadout bin over a balloon rail loop; three locomotives haul dark ore wagons, and the main line leaves for Port Hedland.
- Landscape: western ironstone ridge, braided creek with river red gums, spinifex everywhere the ground is open and nowhere on roads, pads or the pit.
- The plinth carries an engraved plate, "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA", and a 100 m scale bar, both set in the plane of the board's face.

**Open items carried from the mock (not system).** These are defects the art-direction mock carries; the production build fixes them rather than inheriting them.
- Distances are compressed to model scale: the rail balloon loop has a radius of about 82 m (real loops are far larger), and the explosives magazine sits closer to the haul road, workshop and fuel farm than a real separation distance allows. Real setbacks and a credible loop size win over the mock's placement.
- At the app scale (k = 0.83) a 13 m haul truck renders at about 11 to 12 px and only reads clearly in the landing crop (k = 1.18). Truck legibility at app scale is unresolved; do not treat the mock's truck size as settled.
- Chrome tokens drift between the two mocks: the landing page uses ink-2 `#4f4842` and line `#d3cabd` where the site view uses the values recorded above. The site view is normative.
- The mock declares a green `--norm` token it never uses; it is deliberately not recorded (see The No Green Rule).
- The automated design detector ran degraded (regex only) and returned no findings. That is not a clean bill of health; the build has not been through a full detector pass.

## Do's and Don'ts

### Do:
- **Do** project every scene object through the one dimetric function in metres, and depth-sort by `x + y`.
- **Do** tone every facet with the one-sun function (`L = normalize(−1, 0.1, 1.05)`, poles `shade-dark` / `shade-lite`) and cast its shadow with the `(1.5, −0.15)` per-metre vector.
- **Do** show state by shape first: full flag, half flag, open pennant, hatched ground, parked marker, severed cable. Colour reinforces; it never carries state alone.
- **Do** put a provenance tag after every number on screen, distinguished by border treatment.
- **Do** use dashes to mean "not solid": assumed tags, the Projection badge, the projected timeline, cut cards, dead network runs, the run beyond a cut.
- **Do** set every numeral tabular and get hierarchy from Archivo's width axis before adding size.
- **Do** desaturate whatever is not working: parked trucks to khaki, a cut service's entry post to grey.
- **Do** keep the plinth plate "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA" visible wherever the board's front edge is in frame.
- **Do** render reduced motion as a still frame of the live engine state, not a blank or a placeholder.

### Don't:
- **Don't** use green or any third signal hue for "normal"; normal is a white pennant.
- **Don't** put shadows, gradients or textures on chrome panels; the chrome is paper and hairline.
- **Don't** add a second light, hand-pick side colours, or shade solids with gradients.
- **Don't** apply a perspective or rotation transform to the scene; the projection is dimetric and the camera does not tilt.
- **Don't** draw cables as curves or free diagonals; they are octilinear with 9 px chamfers.
- **Don't** place bitmap, AI-generated or stock imagery in the scene or chrome; all art is drawn in code.
- **Don't** leave a stopped or parked thing in its working colour.
- **Don't** put mining equipment where a real site would not: roads through the pit wall, spinifex on pads, a magazine beside the camp.
