---
name: FailLocal
description: A playable scale model of a fictional Pilbara iron ore mine. Cut the outside services and watch what stops.
colors:
  ink: "#1d1a17"
  ink-2: "#554e47"
  ink-3: "#6c645c"
  ink-hover: "#3a3430"
  white: "#ffffff"
  paper: "#faf8f4"
  paper-2: "#f3efe8"
  gallery-floor: "#ebe6de"
  line: "#d8d0c4"
  line-2: "#c4bbad"
  computed-fill: "#efe9df"
  state-wash: "#fbf6ea"
  cut-wash: "#f6f1ea"
  meter-track: "#e4ddd2"
  legend-wash: "rgba(250, 248, 244, 0.86)"
  odometer-unlit: "#a99f93"
  odometer-lit-fill: "#e7e0d5"
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
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 760
    lineHeight: 1.1
    fontVariation: "'wdth' 88"
  headline:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 760
    fontVariation: "'wdth' 92"
  figure:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 720
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 90"
  title:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 680
    lineHeight: 1.15
    fontVariation: "'wdth' 88"
  body:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
  body-long:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 94"
  small:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "11px"
    lineHeight: 1.2
  tag:
    fontFamily: "'Archivo Variable', system-ui, sans-serif"
    fontSize: "10px"
    lineHeight: 1
rounded:
  tag: "3px"
  button-plain: "4px"
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
    padding: "7px 8px"
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
  cut-button-hover:
    backgroundColor: "{colors.white}"
  restore-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 8px"
    height: "28px"
  restore-button-hover:
    backgroundColor: "{colors.ink-hover}"
  fit-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "28px"
  button-primary:
    backgroundColor: "{colors.hivis}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 20px 0 22px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.hivis-pressed}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button-plain}"
    padding: "0 20px"
    height: "44px"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "26px"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px 0 7px"
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
  tag-changed:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    height: "16px"
  provenance-popover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "4px 6px"
  odometer-cell:
    backgroundColor: "{colors.computed-fill}"
    textColor: "{colors.odometer-unlit}"
    rounded: "{rounded.tag}"
    width: "21px"
    height: "30px"
  odometer-cell-lit:
    backgroundColor: "{colors.odometer-lit-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
  detail-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "0 20px 20px"
    width: "372px"
  state-box:
    backgroundColor: "{colors.state-wash}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
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
  cable-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.stop-red}"
    rounded: "{rounded.tag}"
    height: "16px"
  plate-pinned:
    backgroundColor: "{colors.plinth}"
    textColor: "{colors.plate-engraving}"
    rounded: "{rounded.tag}"
    padding: "4px 10px"
---

# Design System: FailLocal

## Overview

**Creative North Star: "The Living Diorama"**

FailLocal is the scale model of the mine that stands in a head-office foyer, switched on. An engineering-true dimetric slab of Pilbara ground, 1,600 × 1,000 m, cut away at the edges to show the strata, sits on a dark plinth on a pale gallery floor. The five outside services (Hosted ERP, Cloud logins, Perth operations link, Corporate network, Vendor remote access) are physical cables that drop from cards along the top of the stage and plug into entry posts on the board. Cutting one breaks the cable, and the consequence spreads across the land: trucks park at the fuel bay, ground is hatched, survey flags go up. The world refuses the flat map-plus-sidebar dashboard.

Two materials share the screen and must never blur into each other. The **scene** is lit, faceted and earthy: iron-oxide reds and ochres, dark ironstone, grey-green spinifex, galvanised plant, hi-vis yellow trucks, dark ore wagons, all drawn as flat-shaded polygons under one light, rendered by PixiJS on a transparent WebGL canvas. The **chrome** is paper and ink: warm off-white panels, near-black type in Archivo with the width axis doing the work of hierarchy, hairline rules, and small boxed provenance tags on every number. Chrome is quiet so the model can be loud; the only saturated colours in the chrome are the state colours and the hi-vis call to action.

Density is that of an operations tool, not a marketing page: 14 px body, 12 px labels, tabular numerals everywhere, a docked 372 px detail panel and a 92 px timeline strip. The welcome page is the one place the type opens up (44 px display, 17 px prose) and the model bleeds off the right edge behind it.

**Key Characteristics:**
- True 2:1 dimetric projection, every dimension in metres, one north-west light, computed facet tones.
- Paper-and-ink chrome; colour reserved for state and for the scene.
- State told by shape first (flag form, hatching, dashes, parked marker, severed cable), colour second.
- Every number carries a provenance tag: sourced, measured, assumed, computed, or changed by you.
- Dashed always means "not solid": assumed, projected, cut, revoked or dead.
- The art is vector drawn in code. No bitmaps, no stock imagery.
- The scene moves only when the engine says the thing it depicts is working.

## Colors

A warm paper-and-ink chrome around a lit iron-oxide scene, with exactly two signal hues (stop red, degraded amber) and one action hue (hi-vis yellow). Every colour lives once, as a custom property in `site/src/styles/tokens.css`; the scene reads its colours from that file at runtime (`palette.ts`), so the canvas never carries its own copy.

### Primary
- **Hi-Vis Haul Yellow** (`hivis`): the colour of a working haul truck and the one primary action on the welcome page ("Show me the site"). It is also the text-selection highlight. Pressed/hover deepens to **Hi-Vis Pressed** (`hivis-pressed`). A parked truck is desaturated to **Parked Khaki** (`hivis-parked`), never left yellow.

### Secondary
- **Stop Red** (`stop-red`): stopped and cut only. The full survey flag, the slash across a cut service icon, the cut-link ring, the "Link cut" label, a cut card's status line, the red stroke in the brand mark. **Stop Red Text** (`stop-red-text`) is the darker variant for the word "Stopped" or a lost value set as small text on paper.
- **Degraded Amber** (`degraded-amber`): the half flag's triangle and nothing else.

### Tertiary (the scene)
- **Oxide Ground** (`oxide-low` to `oxide-high`): the faceted ground is a noise blend between these two, darkened toward the western ridge and lightened toward the creek.
- **Ironstone Ridge** (`ironstone-low` to `ironstone-high`): the western range, blended by height.
- **Spinifex** (`spinifex-low` to `spinifex-high`): grey-green tussocks scattered over open ground, each with a low ground shadow.
- **Galvanised Plant** (`galvanised`) and **Roof Steel** (`roof-steel`): sheds, tanks, crusher, conveyors, camp, entry posts.
- **Haul Road** (`haul-road`): haul roads and the pit ramp, edged by a darker windrow band.
- **Ore Load** (`ore-load`): ore in a truck tray, a loaded wagon, the conveyor ore dashes.
- **Ore Wagon** (`wagon-dark`): dark wagons on the balloon loop.
- **Plinth** (`plinth`) with **Plate Engraving** (`plate-engraving`): the model's base, its engraved plate and its 100 m scale bar.

### Neutral
- **Ink** (`ink`): all text, all outlines in chrome and on flags, cables and plaques, active control fills. **Ink Hover** (`ink-hover`): an ink-filled button under the pointer.
- **Ink 2** (`ink-2`): secondary text, labels, tag text. **Ink 3** (`ink-3`): fine print, timeline numerals and tag words, event hairlines.
- **Paper** (`paper`): panels, cards, plaques, the timeline strip, popovers. **Paper 2** (`paper-2`): segmented-control hover wash. **White** (`white`): an outlined control's hover fill (Cut, Fit).
- **Gallery Floor** (`gallery-floor`): page and stage background, flat. The canvas is transparent over it.
- **Line** (`line`) and **Line 2** (`line-2`): hairline dividers and control borders respectively.
- **Computed Fill** (`computed-fill`), **State Wash** (`state-wash`), **Cut Wash** (`cut-wash`), **Meter Track** (`meter-track`), **Legend Wash** (`legend-wash`, paper at 86 %): the tinted fills chrome is allowed. **Odometer Unlit** (`odometer-unlit`) and **Odometer Lit Fill** (`odometer-lit-fill`) belong to the odometer alone.
- **Shade Dark** (`shade-dark`) and **Shade Lite** (`shade-lite`): not used directly; they are the two poles every facet tone is mixed toward (see Elevation & Depth).
- **Cast Shadow** (`cast-shadow`) and **Hatch Ink** (`hatch-ink`): scene shadow and the stopped-ground hatching.

Derived scene greys are mixes of tokens, never new hexes: a cut service's entry post is galvanised mixed 61 % toward ink-2 (about `#88837b`); the plinth's lower-right face is plinth mixed 72 % toward hatch-ink (about `#25211e`).

### Named Rules
**The No Green Rule.** Normal is a white open pennant, not a green anything. The scene owns the earth palette; the chrome has only two signal hues, and "fine" is the absence of signal.

**The Parked Is Desaturated Rule.** Anything not working loses its colour: parked trucks go khaki, a cut service's entry post greys toward ink-2. Colour on the board means activity.

**The One Source Rule.** A colour exists in `tokens.css` or not at all. Chrome CSS uses `var(--…)`; the scene resolves the same names through `token()`; derived tones are computed mixes of tokens.

## Typography

**Display Font:** Archivo Variable (with system-ui, sans-serif)
**Body Font:** Archivo Variable, the same family
**Label/Mono Font:** none; Archivo with tabular numerals stands in for a mono face

**Character:** One grotesque driven along its width axis. Condensed widths read as engineering signage and let long mining names fit in narrow plaques and cards; full width is reserved for reading.

### Hierarchy
- **Display** (760, 44 px, 1.1, `wdth` 88): the welcome question only. 32 px on phone. Supporting pages set their h1 at 32 px with the same weight and width.
- **Headline** (760, 20 px, `wdth` 92): the detail panel's process-area name. The guided-run step title is the one heavier headline (740, 23 px, 1.1, `wdth` 94).
- **Figure** (720, 25 px, 1, `wdth` 90, −0.02em): the day number ("Day 3 of 14"). Revenue at risk is the panel figure (700, 24 px, `wdth` 88). Units follow at 14 px, 650.
- **Title** (680, 13 to 14 px, `wdth` 88 to 92): service card names, the scenario name in the top bar. The brand word is 760, 18 px (19 px on the welcome page), `wdth` 96.
- **Body** (400, 14 px, 1.4) in the app; panel prose at 13 px; **Body Long** (400, 17 px, 1.55, max 56ch) on the welcome page; supporting pages 16 px, 1.55, max 68ch.
- **Label** (600 to 650, 12 px, `wdth` 92 to 94): status lines, legend, controls, stock names, section headings (700), dt/dd rows.
- **Small** (11 to 11.5 px): plaque name (700) and state line, timeline event labels, the hero's boxed service labels (600), sub-values in panel rows. Cable labels are 10.5 px, 700.
- **Tag** (10 px, inherits weight): provenance tags only. The tag word at the end of a timeline label is 9.5 px.

**SVG units are not type steps.** The no-WebGL schematic (`site/src/ui/scene.css`) sets its text in the SVG's viewBox units (1,600 wide), not CSS pixels: plate 26, area name 20, state and cable label 18, note 16. They scale with the drawing and land near the Small step on screen. That is why the design hook ignores `scene.css` (`.impeccable/config.json`); the diorama rules in the same file use real pixels and follow this ramp.

### Named Rules
**The Width Before Size Rule.** Hierarchy comes from width and weight before size: display at 88 %, figures at 88 to 90 %, titles at 88 to 92 %, labels at 92 to 94 %, prose at 100 %. Do not add a second typeface to get contrast.

**The Tabular Everything Rule.** `font-variant-numeric: tabular-nums` is set at the body. Counters, stocks, days and money must not jitter as engine output changes.

## Layout

**Projection.** The scene is a true 2:1 dimetric projection in metres. A world point maps to screen as `screenX = originX + (x − y)·k`, `screenY = originY + (x + y)·k/2 − z·k·1.2247`, where `k` is pixels per metre and 1.2247 is the vertical factor for a 30° camera. World +x runs to screen lower-right, +y to screen lower-left, z is up, world (0, 0) is the back (north) corner. The board is 1,600 × 1,000 m (D-100). Depth order is by `x + y` (plus small biases for height), painter's algorithm. `project()` in `scene/iso.ts` is the one projection; nothing in the scene is placed in screen space except the cables, labels and plaques that hang off projected points.

**Camera.** k is clamped to 0.35 to 2.4 px/m. The visitor zooms with the wheel (about the pointer; at a limit the wheel scrolls the page), drags to pan, pinches on touch, and with the scene focused presses `+`, `−` and `0`. A **Fit** button (top right of the scene) and `0` return to the default view. The clamp keeps the ground point under the view centre inside the board, so the board can never be panned away. Focusing an area button whose flag is out of frame pans to that area.

**Default view (site).** The model opens as an object on its plinth (D-111): the camera fits the board's front-left corner and the first 500 m of its cut-away face, every area's flag and every entry post, with stage margins of 90 px above (for the cable buses), 28 right, 22 below and 16 left. At 1440, 1150, 1024 and 820 px this lands at about k 0.58, 0.57, 0.52 and 0.44. A phone instead crops to the working area (pit, crusher, edge of the stockyard).

**Entry posts.** Five 3 × 3 × 5 m posts stand in a row on open ground just north of the default framing (y = 285 m, x = 420 to 900 m, 120 m apart, in card order) (D-109), drawn at least 13 px tall at any zoom.

**App frame (desktop, > 1200 px).** A three-row grid: a 60 px top bar, the stage, and a 92 px timeline strip, with a 372 px detail column docked right across all three rows (minimum height 640 px). The stage is a size container in three bands: a 112 px card band, the scene, and a 56 px legend band (84 px when the stage is under 860 px wide). The diorama canvas spans the full stage width. The strip splits 186 px (play and day) / flexible axis / speed control / 250 px (stocks). Panel gutters are 20 px; inner rhythm runs 4 / 8 / 12 / 16 px.

**Card row.** Each of the five cards sits in a slot centred on its cable at `cableFraction(i) = (i + 1) / 6` of the scene width, as wide as the pitch allows (`min(240px, scene/6 − 8px)`), clamped 4 px inside the stage, its card aligned to the bottom of the band. Cards in the row are one height whichever names wrap. Below a 240 px slot the name keeps room for two lines and the status takes its own line with the buttons under it at right. Below a 150 px slot the card goes **compact**: no icon, name at `wdth` 80, 26 px buttons, and a lone Cut keeps only its scissors glyph (accessible name unchanged) while **Restore** and **Remove cut** keep their words, and keyed buttons keep their letter.

**Cables.** Service cables are octilinear: straight vertical and horizontal runs joined by 9 px 45° chamfers. Each enters at the stage top under its card, drops to a horizontal bus (30 px down, stepped 6 px so neighbours never cross), runs above its post and drops onto it. In the default framing every cable reaches its post. When the camera puts a post above the stage, or too close under its top for a bus, the cable is drawn only as a 26 px drop under its card, with its dot or break, until the post comes back into reach.

**Tablet (761 to 1200 px).** One column. The stage keeps a definite height (`max(420px, min(100dvh − 60px − 132px, 100vw/1.6 + 196px))`) so the top bar, stage and strip fill the first screen. The strip becomes a 132 px, two-row grid: play, day and note with the speed control at right; then the axis beside the stocks. The detail panel moves below, full width, and the page scrolls to it. Cards go compact at this width.

**Phone (≤ 760 px).** A single column in reading order: top bar (wrapped, title on its own row), a horizontally scrolling strip of 210 px cards that fades at the right edge so the next card peeks in, the scene (aspect 1.25, cables hidden, working-area crop), then a **money strip** (day figure, projection note, production deferred and revenue), the timeline (play and speeds, then a 92 px axis that labels only the latest event), the legend, the event list, the stocks, and finally the detail panel. The assumptions editor stays desktop-only.

**Welcome.** Full width. The FailLocal lockup sits top left; the copy runs in a column `min(100%, 610px, 50%)` wide with a 64 px left margin over the open gallery floor, vertically centred in a hero at least `max(560px, 100vh − 150px)` tall. The model is a decorative layer from `min(600px, 49%)` to the right edge, running off it, its bottom 96 px masked to transparent so the plinth's floor shadow fades rather than cuts. **Hero framing** fits the board from its back corner to its whole front-left face, the whole pit at its heart and every entry post, under the five services shown as a right-aligned row of boxed labels along the top (22 px, 14 px from the top, 14 px gaps shrinking to 6) cabled into their posts. On the 1,600 m board this composition lands near k 0.49 at 1440 px; the mock's 1.18 belonged to its 720 m board and is retired. At ≤ 1100 px the hero stacks under the copy (aspect 1.4; 1 on a phone, where labels and cables are hidden and the frame is the pit and the face below it).

### Named Rules
**The Model Is An Object Rule.** The first view shows the board as a thing on a plinth, with gallery floor beyond its front corner, not a crop of terrain.

**The Every Cable Lands Rule.** At the default view every cable reaches its post. A cable that ends in mid-air reads as a fault that is not there.

## Elevation & Depth

A hybrid with a hard boundary. **The chrome is flat**: depth comes from hairlines and tinted fills; the only shadows are a whisper under the service cards, a coloured lift under the hi-vis button, and the odometer cells' 1 px inset lower edge. **The scene is lit**: every surface takes a computed tone from one directional light, and every object casts a soft ground shadow.

**Light.** One light from the north-west, low sun: `L = normalize(−1, 0.1, 1.05)`. For a face normal `n`, `b = dot(n̂, L)·0.8 − 0.12`. The face tone is the base colour mixed (linear sRGB, per channel) toward `shade-dark` by `0.6·|b|` when `b < 0`, or toward `shade-lite` by `0.5·b` when `b > 0`. This gives three canonical faces for axis-aligned boxes: top `b ≈ +0.46` (lightest), the +y face (screen lower-left) `b ≈ −0.07` (near base), the +x face (screen lower-right) `b ≈ −0.67` (darkest). Worked check: galvanised `#d9d5cc` gives top `#e2dcd1`, left face `#d2cec5`, right face `#938a87`; hi-vis `#f2b01e` gives `#f5c04a` / `#eaaa1e` / `#a2741f`. Curved solids are faceted (a cylinder is 16 wall facets under a 24-sided top) and toned per facet by the same function, with back faces culled. Ground triangles sit at `b ≈ top − 0.42 ± 0.045` so the land reads as matte against lit plant. A few surfaces (windrows, berms) take a fixed offset on `b`, never a different light.

**Cast shadows.** Each object projects its footprint by `(1.5, −0.15)` metres per metre of height, takes the convex hull of footprint plus offset footprint, and fills it with `cast-shadow`; the whole shadow layer is blurred (about 1.6·k px) and set to 34 % opacity, so overlapping shadows never double-darken. The whole model also sits on a large blurred plinth shadow on the gallery floor.

**Cut-away slab.** The two visible board edges show strata bands with gently waving bedding planes (oxide reds, ochres and dark ironstone, top 0 to −30 m), then a 14 m plinth in two tones (front-left face `plinth`, lower-right face the darker derived mix), with a lighter arris and a pale lit lip along the board's top edges.

### Shadow Vocabulary
- **Card float** (`box-shadow: 0 1px 0 rgba(29,26,23,.04), 0 6px 14px -8px rgba(60,40,25,.25)`): service cards only.
- **Hi-vis lift** (`box-shadow: 0 1px 0 rgba(29,26,23,.25), 0 10px 22px -12px rgba(150,95,10,.55)`): the primary welcome button.
- **Odometer cell edge** (`box-shadow: inset 0 -1px 0 rgba(29,26,23,.08)`): each odometer digit cell.

### Named Rules
**The One Sun Rule.** Every facet in the scene is toned by the same light vector and the same two shade poles. No hand-picked side colours, no second light, no gradients on solids.

**The Flat Chrome Rule.** Panels, the timeline and the top bar have no shadow. If chrome needs separation, it gets a hairline in `line`.

## Shapes

Small, consistent radii on chrome: 3 px for tags, plaques, popovers, cable labels, the pinned plate and odometer cells; 4 px for the plain outlined button; 5 px for controls (Cut/Restore, Fit, segments); 6 px for cards, the state box, the legend and the close button; 7 px for the segmented well and the hi-vis button; full pills for the top-bar badges; circles for the play button and the timeline's "now" disc. Borders are 1 px hairlines; 1.5 to 3 px is reserved for ink that must read at a distance (focus ring 2 px, play ring 2 px, timeline elapsed line 3 px, cables 1.5 px).

In the scene, everything is a polygon: boxes, oriented boxes, beams, faceted cylinders and convex solids, all drawn as flat fills (seams are closed by the renderer's antialiasing, not by strokes). Organic forms (creek, ridge, roads, pit crests) are Chaikin-smoothed polylines. Trees and spinifex are the only round shapes: stacked ellipses in three greens.

The brand mark is a pit in section (four stacked bench lines narrowing upward) with a short Stop Red stroke cutting the top right.

### Named Rules
**The Octilinear Rule.** Cables and their buses run only vertical and horizontal, joined by 9 px 45° chamfers. No curves, no free diagonals.

## Components

### Service Card (signature)
Five cards, one per service group (D-102), in cable order: Hosted ERP, Cloud logins, Perth operations link, Corporate network, Vendor remote access. Paper card (240 px wide at most, at least 58 px tall, 7 px 8 px padding, 6 px radius, `line-2` border, card float), a 26 px line icon per group (ink 1.5 strokes on a 32-unit grid, paper fills), the name as Title, the status as Label ("Up", "Cut since day 0", "Cut from day N", "Restored day N", "Down via <service>", "Access revoked"), and the button(s) at right.
- **Cut state:** border goes 1 px dashed ink, fill `cut-wash`, a Stop Red diagonal slashes the icon, the status turns Stop Red at 650 with a break glyph.
- **Buttons:** 28 px high, 5 px radius, 12 px 650, each with a 12 px line glyph and `aria-pressed`. **Cut** is paper with `line-2` border and scissors; hover inks the border on white. **Restore** (the cut is holding the service down) is ink-filled with paper text and a joined-cable glyph; hover goes `ink-hover`. **Remove cut** (a planned or finished cut) is paper with an ink border and a cross. Only free play edits cuts; elsewhere buttons are disabled at 55 %.
- **The Vendor card:** one card and one cable for vendor A and vendor B. While both are up it reads a single "Up"; otherwise a status line per vendor, prefixed "Vendor A" / "Vendor B" in ink. It carries two keyed buttons, glyph plus letter (A, B), each named for its own service. The shared cable shows the worse of the two states.
- **Compact:** see Layout, Card row.

### Cable and Entry Post
Ink, 1.5 px, octilinear, butt caps. Three states, told apart by shape:
- **Live:** solid, carrying a paper dot (r 2.4) with a 1.2 px ink ring that travels the cable in 5 to 7 s per run, staggered by group.
- **Severed:** solid down to a break: two 10 px bars across the cable 16 px apart, a Stop Red ring (r 3.2, 1.4 px) between them blinking on a 2.4 s ease-in-out (opacity 0.4 to 1), a boxed "Link cut" label (16 px paper box, ink hairline, Stop Red 10.5 px 700) beside it, and the rest of the run dashed 3/3 at 1.3 px, 55 %.
- **Revoked:** the whole cable dashed 4/3 at 90 % with an ink "Access revoked" label.
Each cable lands on its entry post; a cut service's post is desaturated. The DOM layer carries one marker per cable (`data-cable-group`, `data-cable-state`) at its anchor.

### Survey Flags and Plaques (state grammar)
Each process area has a pole planted at its location in world space, with a small ground ellipse at its foot, a flag at the top, and a plaque beside it.
- **Stopped:** full rectangular flag in Stop Red with a white X, plus **hatched ground** over the area's pad: `hatch-ink` lines 1.5 px at 62 % every 7 px, running with the board's x axis (26.565° on screen), over an 8 % wash, with a dashed 5/3 outline at 80 %.
- **Degraded:** white rectangular flag with the lower-left triangle filled Degraded Amber.
- **Normal:** white open triangular pennant.
- **Parked:** a boxed pause glyph (11 px paper square, two ink bars) on a short post above each parked truck; the truck itself goes khaki. Markers step aside from plaques and flag cloths.
- **Plaque:** paper box at 96 %, 3 px radius, 0.8 px ink stroke, 31 px high. Line 1 is the area name (11 px, 700); line 2 is the state word in bold (Stop Red Text for stopped) and a short note ("Diesel rationed"). **Selected** inverts to ink fill with paper text, a 1.2 px stroke and a 1.6 px pole.
- **Placement:** deterministic, never fixed pole lengths. Stopped areas claim space first, then degraded, then normal; each tries every pole length (22 to 158 px) on its preferred side, the other side, then over the pole's top, keeping inside the stage and clear of other plaques, the Fit button and the plate, and of cables and other flags where it can. A flag out of frame has no plaque.

### Scene Contract (v2) and Accessible Layer
Every scene implementation (the PixiJS diorama, the SVG schematic) draws the same `SceneState` and nothing else, and renders the same DOM layer over it:
- one native `<button>` per process area over its plaque and flag, `aria-label="<area>: <State word>. <note>"`, `aria-pressed` from the selection; click, Enter and Space select. An area out of frame keeps its button in the tab order, visually hidden; focusing it pans the camera to it.
- one `.scene-plinth` element holding the plate text as DOM text (see Honesty Plate);
- one cable marker per service group; `onAnchors` reports each group's anchor as `cableFraction(i)`;
- `decorative` (the welcome hero) renders no buttons and hides the scene from assistive tech (`aria-hidden`, `inert`).
The scene itself is a focusable group labelled "Model site" with a 2 px inset ink focus ring. The canvas takes `touch-action: pan-y`, a grab cursor, and grabbing while dragging.

### Honesty Plate
The plate reads "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA" (650, `wdth` 92, +0.12em, `plate-engraving`). It is DOM text, never canvas: where the board's front-left plinth face is in view it is the engraving, set in the face's plane by a 2:1 skew (`matrix(cos, sin, 0, 1, 0, 0)` of the face's 1/2 slope), from 40 m along the face, sized to 0.55 of the face's height and never under 9 px. Only when that face is off-screen is it **pinned** bottom-right of the stage as a small plinth-coloured pill (11 px, 4 px 10 px padding; 9 px and 3 px 7 px on a phone). The 100 m scale bar is engraved on the same face by the canvas.

### Schematic (no-WebGL fallback)
Where WebGL is unavailable or the renderer fails, an SVG schematic stands in, meets the same scene contract and carries every state (flags, hatched ground, cables, the plate), with the note "Simplified view: this browser can't draw the 3D model." (12 px, 600, ink-2) under the cards (D-106). The welcome hero shows no note. Its text sizes are viewBox units (see Typography).

### Legend
Bottom-right of the stage in the legend band, a paper strip at 86 % with `line` border, 6 px radius, 8 px 12 px padding. Five entries, each the actual glyph followed by the state word in ink at 650 and its shape in ink-2 at 600: Normal "open pennant", Degraded "half flag", Stopped "full flag, hatched ground", Parked "parked marker", Cut "severed cable". It names shapes, not colours.

### Docked Detail Panel
The 372 px right column (below the stage on tablet and phone). On top, the **revenue section**: "Production deferred so far" with the odometer, a stockpile line ("Stockpile feeding rail: N days before loadings are cut back") when it applies, a hairline, then "Revenue at risk" as the panel figure, a rate line ("≈ US$… per day once loadings are cut back, US$… once the stockpile is empty", 13 px 650) when it applies, and its working shown inline at 12 px ink-2, each input followed by its tag, ending in "Revenue at risk, not written off" in ink-3. Below, the **area panel**: Headline name with a one-line description and a safety line in ink-3, a 30 px close button (6 px radius), the **state box** (`state-wash`, `line-2` border) with flag, state word (15 px 700), note, and the fleet row (eight small truck glyphs, parked ones khaki with the pause marker, never a count); then "Why this stops" / "Why it is running"; then **Depends on** and **Continuity** as ruled rows (hairline between, value right-aligned at 650 with its tag and an ink-3 sub-line). Section headings are 12 px, 700.

### Odometer
Production deferred, in tonnes. A row of 21 × 30 px cells (3 px radius, `computed-fill`, the cell-edge inset, 19 px 650 digits in `odometer-unlit`) with 3 px gaps, grouped in threes by a further 5 px; the number's own significant digits are lit (ink on `odometer-lit-fill`); the unit ("t", 14 px 650) and a computed tag follow. Assistive tech reads the number once as text.

### Day Timeline
An axis drawn at the real pixel width of its container (lines are CSS, positioned by percentage, never stretched). Elapsed time is a solid 3 px ink line up to "now"; beyond it a 1.5 px line, dashed when the run is a projection. Daily ticks (5 px), long ticks (9 px) every 6 days, 10 px numerals in ink-3. "Now" is a 16 px paper disc with a 2 px ink ring and an ink centre, sliding on 120 ms linear. A 38 px circular play button (2 px ink ring) and the "Day N of M" figure sit at left over a projection note in ink-3. A **speed control** (segmented, "12×", "24×", "48×", "96×", hours per second) sits between axis and stocks.
- **Event lanes:** each event is a dashed `ink-3` hairline button. Wider than a phone, each label takes a lane above or below the axis, alternating, wherever it fits without overlapping another (placed from measured widths); one that fits nowhere keeps its hairline and shows its label on hover and focus, on paper, one at a time. A phone labels only the latest event. Labels are 11 px: the name in ink-2 (ink when current), the event word in ink-3, then a 9.5 px **tag word** in ink-3 saying where its time comes from ("computed", "sourced", "assumed", "measured", "changed by you"; D-112).
- The **event list** writes every event out in a two-column list (when, what) under the stage on a phone and in the panel flow elsewhere.

### Stock Meters
Three rows (Diesel, ROM pad, Stockpile): a 64 px name in ink-2, a 6 px track (`meter-track`, 3 px radius) with an ink fill scaled on 120 ms linear, the value in days at 680, and a computed tag.

### Provenance Tags and Popover
16 px high, 3 px radius, 10 px type in ink-2, 4 px after the number. The kinds are told apart by border, not colour: **computed** filled `computed-fill` with no visible border; **assumed** dashed `line-2`; **sourced** solid `ink-3`; **measured** solid `ink-3` with a 2 px bottom edge; **changed by you** solid ink with ink text. A sourced tag, an assumed tag and a changed-by-you tag are buttons with a **popover**: the source's title, the assumption's reasoning, or the register's original value. The popover is paper, `line-2` hairline, 3 px radius, 12 px ink, at most 280 px wide, 6 px above the tag (below it when there is no room), nudged to stay inside the window. Hover or focus shows it; a press pins or dismisses it; Escape dismisses it; only one is open at a time; the pointer can cross onto it.

### Top Bar Controls
- **Title block:** the scenario title (14 px 680, `wdth` 92, truncates) over a 12 px ink-2 subline, "Modelled on <source>" when the scenario reproduces that record, otherwise "Based on <source>", with a sourced tag that never truncates.
- **Badges:** 24 px pills, 1 px ink border, 12 px 600 label after a 14 px line glyph. "Fictional model site" (a block on its plinth) is solid; "Projection" (a run going solid to dashed) is dashed.
- **Segmented control** (Unprepared / Prepared; also the speed control): paper well with `line-2` border, 7 px radius, 2 px inset; 26 px segments, 12 px 650; the pressed segment is ink with paper text; hover on others washes `paper-2`; locked at 55 % while the guided run drives it.

### Welcome Buttons
- **Primary:** hi-vis fill, ink text 16 px 700, 50 px high, 7 px radius, hi-vis lift, an 18 px arrow; hover deepens to `hivis-pressed` and nudges the arrow 3 px right; active drops 1 px.
- **Secondary** ("Explore freely"): a plain outlined button, paper with a 1 px ink border, 4 px radius, at least 44 px high, 15 px 650.

### Motion
The animation renders engine output; nothing on the board moves unless the process it depicts is working (D-099, D-108).
- **Haulage:** eight illustrative trucks: all running when haulage is normal, four when degraded, none when stopped; the rest stand in eight bays south of the fuel-bay canopy. A running truck travels the haul cycle at a display 12 m/s in lanes ±4.6 m off the centreline, empty down the ramp and loaded back up, turning on a half circle at the shovel and hidden for the moment it tips into the dump pocket. Dust puffs every 0.22 s fade over 2.6 s.
- **Rail:** three locomotives and 34 wagons run the balloon loop at 8 m/s times the rail speed (half when degraded, standing when stopped); a wagon fills under the loadout while the train runs, because the loadout is fed from the stockpile by the reclaimer and rail runs only while the stockpile feeds it (ruling R-ab), and each lap starts empty. The belt's ore dashes still run only while the conveyor runs.
- **Conveyor:** 2.2 m ore dashes every 5.6 m, one 56 m cycle every 9 s, while the conveyor runs.
- **Light vehicles** circulate on the access road at 13 m/s only while haulage is not stopped; when it stops they stand where they are.
- **Cables:** travelling dots on live cables; the cut-link ring pulses.
- **Frame:** one ticker, throttled to about 30 ms per frame; each step's dt is capped at 0.25 s so a background tab never jumps the scene; nothing renders while the WebGL context is lost.
- **Reduced motion** draws one still frame of the same engine state (the scene is not hidden): trucks, train and vehicles where the state puts them, a live cable's dot still at its bus corner, the cut ring held lit, no belt, and no UI transitions (timeline disc, meters, button and arrow).
- **Chrome:** the primary button's background and lift on 0.15 s; the arrow's nudge on 0.2 s `cubic-bezier(.2,.8,.2,1)`.

### Mining Accuracy (the model's invariants)
The art must stay true to a real open-pit iron ore operation, because recruiters will notice:
- Pit: west of centre, a 540 × 420 m crest, five benches 12 m high with a 5 m batter run and 11 m berms; a 25 m spiral ramp cut into the walls at a constant 11 % grade; a sump on the floor; a face shovel on the floor and a drill with a blast-hole pattern on the first bench.
- Haul trucks are ultra-class (CAT 793 / Komatsu 930E): 13 m long, 7.6 m wide, cab on the left, loaded trays carry a visible ore heap. Haul roads are 26 m with darker windrow edges, and keep 20 m back from the crest except on the last 100 m into the ramp head.
- The workshop has four roller doors sized for ultra-class trucks. Diesel tanks sit in a bund; the fuel bay has a canopy.
- The explosives magazine is two magazines in earth bunds inside a fence, in the far corner, more than 800 m from the workshop, fuel farm and camp; its track never passes the camp.
- Crushing: ROM pad with stocks feeding a primary gyratory crusher with a dump pocket; an overland conveyor on a raised gallery over the creek to the stockyard.
- Stockyard: windrows built by a rail-mounted stacker and recovered by a bucket-wheel reclaimer; a reclaim conveyor rises to a loadout bin over a balloon loop of 210 m radius; dark ore wagons, and the main line leaves for Port Hedland.
- Landscape: western ironstone ridge, braided creek with river red gums, spinifex everywhere the ground is open and nowhere on roads, pads or the pit.
- The plinth carries the engraved plate and a 100 m scale bar, both in the plane of the board's face.

**Open items (not system).**
- The network overlay ("Show the network": each service's runs drawn flat on the board) is deferred, and so is its switch; the Limitations page says so (D-110). The old Network Overlay and Switch components are withdrawn until it is built.
- Truck legibility at the default view is unresolved: at k ≈ 0.58 a 13 m haul truck is about 7 to 8 px; it reads clearly only when zoomed in (about 31 px at the 2.4 limit).
- Owner deliverables: the walkthrough video, the `[Your name]` byline placeholder, and the draft copy marked for approval (guided captions, the assumption caveat, the Limitations line).

## Do's and Don'ts

### Do:
- **Do** project every scene object through the one dimetric function in metres, and depth-sort by `x + y`.
- **Do** tone every facet with the one-sun function (`L = normalize(−1, 0.1, 1.05)`, poles `shade-dark` / `shade-lite`) and cast its shadow with the `(1.5, −0.15)` per-metre vector at 34 %.
- **Do** show state by shape first: full flag, half flag, open pennant, hatched ground, parked marker, severed or dashed cable. Colour reinforces; it never carries state alone.
- **Do** put a provenance tag after every number on screen, distinguished by border treatment.
- **Do** use dashes to mean "not solid": assumed tags, the Projection badge, the projected timeline, cut cards, revoked cables, the run beyond a cut, event hairlines.
- **Do** set every numeral tabular and get hierarchy from Archivo's width axis before adding size.
- **Do** desaturate whatever is not working: parked trucks to khaki, a cut service's entry post to grey.
- **Do** bind every moving thing to the engine state of the process it depicts, and stop it when that process stops.
- **Do** keep the plate "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA" as DOM text, engraved on the front-left face when it is in view and pinned to the stage bottom only when it is not.
- **Do** open the site on the model as an object on its plinth, with every cable reaching its post.
- **Do** render reduced motion as a still frame of the live engine state, not a blank or a placeholder.
- **Do** give every scene implementation the same accessible layer: a native button per area, the plate as text, a marker per cable.

### Don't:
- **Don't** use green or any third signal hue for "normal"; normal is a white pennant.
- **Don't** put shadows, gradients or textures on chrome panels; the chrome is paper and hairline.
- **Don't** add a second light, hand-pick side colours, or shade solids with gradients.
- **Don't** tilt, rotate or put perspective on the scene's camera or canvas; the projection is dimetric and the camera does not tilt. The plate's face-plane skew is the one transform, and it follows the projection.
- **Don't** draw cables as curves or free diagonals; they are octilinear with 9 px chamfers.
- **Don't** show a number for an illustration: the eight trucks are a picture of the fleet's state, never "3 of 8".
- **Don't** add a colour outside `tokens.css`.
- **Don't** place bitmap, AI-generated or stock imagery in the scene or chrome; all art is drawn in code.
- **Don't** leave a stopped or parked thing in its working colour.
- **Don't** put mining equipment where a real site would not: roads through the pit wall, spinifex on pads, a magazine beside the camp.
