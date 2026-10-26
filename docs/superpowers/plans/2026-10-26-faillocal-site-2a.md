# FailLocal Plan 2a: Site Shell, Logic and Chrome — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the playable FailLocal website around the existing engine. It has the welcome page, the guided S1 run, free play, the unprepared/prepared toggle, the revenue counter with its working shown, the detail panel, the timeline, the assumptions editor, the supporting pages, mobile tiering and strict security headers. The animated diorama comes in Plan 2b; until then a clean schematic scene sits behind one interface.

**Architecture:**
- A new `site` npm workspace (Vite + React + TypeScript) imports the engine from source and runs it in the browser.
- All behaviour lives in pure, unit-tested modules: run derivation, free-play scenario building, the playback clock, guided-run step derivation, number formatting, and the `SceneState` mapping.
- React components only render. The scene is behind `SceneView`, which takes a `SceneState`. Plan 2a ships a schematic SVG implementation; Plan 2b replaces it with the PixiJS diorama without touching anything else.

**Tech Stack:** Node ≥ 22, TypeScript 5 strict, React 19, Vite (current major), Vitest + @testing-library/react + jsdom, Playwright (Chromium), `@fontsource-variable/archivo` (self-hosted). Plan 2b adds `pixi.js@^8`.

**Spec:** `docs/superpowers/specs/2026-10-22-faillocal-design.md`. Also binding: `DESIGN.md` (visual system), `PRODUCT.md`, and `docs/superpowers/plans/2026-10-26-plan-1-followups.md` (Plan 2 notes).

## Plan 2 is split in two

| Plan | Delivers | Ships release 2? |
|---|---|---|
| **2a (this)** | Everything except the art: shell, model layer, chrome, panel, timeline, guided run, free play, editor, pages, mobile, CSP, build checks, owner gates for deploy | No: the schematic scene is a working stand-in, not the release art |
| 2b | The PixiJS Living Diorama behind `SceneView` (projection, one-sun tones, layout at real setbacks, zoom/pan, vehicles, flags, cables, reduced motion), the impeccable finish review, and the DESIGN.md re-record | Yes, once the owner's deploy gates are cleared |

2b is written when 2a lands, because it consumes `SceneState` exactly as 2a defines it.

## Decisions made in this plan (log each in `docs/decisions.md` as part of the task that implements it)

- **D-099 Display rules (assumed).** These map engine state to art. None of them displays a number.
  - The haul fleet is drawn as an illustrative eight trucks: normal means all moving, degraded means four moving and four parked, stopped means none moving.
  - The train runs at full speed when rail is normal, half speed when degraded, and stands when stopped.
  - The stockpile, ROM pad and fuel-tank fill heights are proportional to stock level ÷ capacity.

  No count of trucks is shown as a number. The panel says "Fleet rationed" or similar, never "3 of 8".
- **D-100 Board size (Plan 2b; recorded now so 2a's schematic matches).** Earlier the board was 720 × 480 m, which forced an unreal rail loop (radius about 82 m) and an unsafe magazine setback. It becomes 1,600 × 1,000 m, with:
  - zoom and pan;
  - the default framing on the pit, ROM pad and crusher;
  - a balloon loop radius of at least 200 m;
  - the explosives magazine at least 500 m from the workshop, fuel farm and camp.

  These are assumed values. DESIGN.md's Layout section is updated in Plan 2b.
- **Free play:** `projection: true`, `workaroundsHold` chosen by the visitor (default `false`), `basis: []`. All values chosen by the visitor arrive through `overrides`, so they are flagged "chosen by you" (follow-ups, I5 convention).

## Global Constraints

- **Workspaces.** Root `workspaces` becomes `["engine", "site"]`. The root `test` runs both workspaces. The root `typecheck` runs `tsc --noEmit -p engine && tsc --noEmit -p site`. The site imports `@faillocal/engine` (the workspace link to `engine/src/index.ts`). Relative imports use `.js` extensions.
- **The register.** It is loaded in the browser from `register/pilbara-model-site.yaml` via a Vite `?raw` import and `loadRegisterYaml`. **Every number on screen comes from the register, a `Timeline`, or `assumptionsUsed`. Never copy a figure from the mockups.** The mockup's "40 Mt/a × US$100/t" is a placeholder and is wrong.
- **Fixed ids:**
  - processes: `diesel-ordering`, `explosives-ordering`, `work-orders`, `payroll`, `remote-operations`, `control-room`, `drill-and-blast`, `haulage`, `crushing`, `rail`
  - services: `corporate-network`, `hosted-erp`, `cloud-identity`, `iroc-link`, `vendor-a-access`, `vendor-b-access`
  - stocks: `diesel`, `explosives`, `broken-ore`, `rom-pad`, `ore-stockpile`
  - scenarios: `s1-as-reported`, `s1-projection`, `s2-iroc-lost`, `s3-vendor-setpoint`, `s4-precautionary-isolation`
- **Every displayed quantity is rendered by `<Qty>`**, which attaches its provenance tag (Task 3). Four tag kinds are told apart by border, as DESIGN.md "Provenance Tags" specifies. An overridden input is also marked "changed by you".
  - Only clock values are exempt: the current day/hour and the axis tick numerals, rendered inside `[data-clock]`.
- **Wording:**
  - "revenue at risk" and "production deferred", never "lost" (about revenue, production or tonnes);
  - mining language on the front, with no security jargon outside the side panel.
- **The "Fictional model site" badge** renders from `register.site.fictional`. **The "Projection" badge** renders from `timeline.projection`. **The timeline axis length** comes from the scenario's `horizon` (14 days as reported, 16 days for the projection), never a fixed 12.
- **Scenario titles and summaries** come from the register's `title` and `summary`. Do not rewrite them in the UI.
- **Visual tokens** are taken from DESIGN.md's front-matter `colors` as CSS custom properties. The rules that apply: Archivo is the only face, hierarchy comes from width before size, every numeral is tabular, chrome is flat, and there is no green anywhere. The desktop frame is a 60 px top bar, a 92 px timeline and a 372 px docked panel; the phone breakpoint is ≤ 760 px.
- **No third-party requests at runtime.** The Archivo variable font is self-hosted via `@fontsource-variable/archivo` (width axis 62–125). There are no trackers.
- **Reduced motion** (`prefers-reduced-motion: reduce`) drops UI transitions. The scene shows the same engine state, still.
- Accessibility is best effort: keyboard operable, a visible 2 px focus ring, status words next to every colour.
- Licence: Apache-2.0.

## Review Focus

1. **A visitor types an out-of-range or empty value** (blank, `-3`, `1.5` for a fraction) into the assumptions editor. The field shows an inline error that names the problem, the last valid run stays on screen, and nothing goes blank or throws. → Task 9, `invalid edit keeps the last good run and names the field`.
2. **A visitor scrubs beyond the ends of the timeline, or switches scenario mid-playback.** The hour clamps to `[0, horizonHours]`. Switching scenario resets to hour 0 and pauses. → Task 7, `scrub clamps to the horizon` and `scenario change resets the clock`.
3. **A visitor cuts services in free play, then flips Unprepared/Prepared.** The run recomputes with the same cuts. → Task 9, `variant toggle keeps free-play cuts`.
4. **A phone at 390 × 844.** No horizontal scroll. The editor is replaced by a "Best on a laptop" note. Cut buttons still work. → Task 11, Playwright `phone layout`.
5. **Skipping the guided run at any step** lands in free play on `s1-projection`, unprepared, at hour 0, paused, with no guided timers left running. → Task 8, `skip from any step lands cleanly in free play`.

---

## File Structure

```
package.json                         # workspaces ["engine","site"]; test/typecheck span both
site/
  package.json  vite.config.ts  vitest.config.ts  playwright.config.ts  tsconfig.json  index.html
  public/_headers                    # CSP and security headers (Task 12)
  scripts/check-build.mjs            # build guard (Task 12)
  src/
    main.tsx  App.tsx  routes.ts     # hash routing
    styles/tokens.css  styles/base.css
    model/
      register.ts                    # loads the YAML once
      store.ts                       # tiny external store + useStore
      run.ts                         # deriveRun (engine call, error capture, memo)
      freePlay.ts                    # freePlayScenario + override paths
      clock.ts                       # playback clock maths
      guided.ts                      # guided-run step derivation
      format.ts                      # quantity formatting
      sceneState.ts                  # SceneState mapping (the 2a/2b seam)
    ui/
      Qty.tsx  ProvenanceTag.tsx
      TopBar.tsx  ServiceCard.tsx  Legend.tsx
      DetailPanel.tsx  RevenueSection.tsx  AreaPanel.tsx
      Timeline.tsx  StockMeters.tsx
      GuidedRun.tsx  FreePlay.tsx  AssumptionsEditor.tsx
      SceneView.tsx                  # interface + schematic SVG implementation (replaced in 2b)
      pages/Welcome.tsx  pages/Sources.tsx  pages/Tested.tsx  pages/Built.tsx  pages/Limits.tsx
  test/…                             # vitest (jsdom)
  e2e/…                              # playwright
```

---

### Task 1: Site workspace, tokens, fonts and test harness

**Files:**
- Create: `site/*` scaffold, `site/src/styles/tokens.css`, `site/src/styles/base.css`, `site/src/main.tsx`, `site/src/App.tsx`
- Modify: root `package.json`
- Test: `site/test/tokens.test.ts`, `site/test/app.test.tsx`

**Interfaces:**
- Produces:
  - `tokens.css`: one `--<name>` custom property per key in DESIGN.md's front-matter `colors` (e.g. `--hivis`, `--stop-red`, `--ink-2`).
  - `base.css`, which sets:
    - body `font-family: 'Archivo Variable', system-ui, sans-serif` with `font-variant-numeric: tabular-nums`;
    - `::selection` in `--hivis`;
    - a 2 px ink focus ring;
    - themed scrollbars;
    - the gallery-floor background.

- [ ] **Step 1: Scaffold.**
  - Create the `site` workspace with React 19, Vite, `@vitejs/plugin-react`, Vitest, jsdom, @testing-library/react, @testing-library/user-event, @playwright/test and `@fontsource-variable/archivo`.
  - Install dependencies with exact lockfile resolution.
  - Update the root scripts as in Global Constraints.
- [ ] **Step 2: Failing tests.**
  - `tokens.css defines every DESIGN.md colour`: parse the DESIGN.md front matter (the `yaml` package) and expect a `--${key}:` line per colour key, with the identical hex value.
  - `app renders the fictional badge from the register`: render `<App/>` and expect the text "Fictional model site". Its presence must come from `register.site.fictional` (Task 2 wires this; for now assert against a stub register in the test).
- [ ] **Step 3: Run** `npm test -w site`. Expected: FAIL.
- [ ] **Step 4: Implement** the tokens, base styles, font import and the minimal `App`.
- [ ] **Step 5: Run** `npm test` and `npm run typecheck` at the root. Expected: PASS (all engine tests still green).
- [ ] **Step 6: Commit** with `feat(site): workspace, design tokens, self-hosted Archivo`.

---

### Task 2: Model layer — register, store, run derivation, free-play builder

**Files:**
- Create: `site/src/model/register.ts`, `store.ts`, `run.ts`, `freePlay.ts`
- Test: `site/test/run.test.ts`, `site/test/freePlay.test.ts`

**Interfaces:**
- Consumes: `loadRegisterYaml`, `simulateScenario`, `simulateWith`, `RegisterError`, `Register`, `Scenario`, `Timeline`, `Variant` from `@faillocal/engine`.
- Produces:
  ```ts
  // register.ts
  export const register: Register;                       // parsed once at module load
  // store.ts
  export function createStore<S>(initial: S): { get(): S; set(p: Partial<S> | ((s: S) => Partial<S>)): void; subscribe(f: () => void): () => void };
  export function useStore<S, T>(store: ReturnType<typeof createStore<S>>, select: (s: S) => T): T;
  // run.ts
  export type RunSpec =
    | { kind: 'register'; scenarioId: string }
    | { kind: 'free'; cuts: FreeCut[]; workaroundsHold: boolean };
  export interface RunInput { spec: RunSpec; variant: Variant; overrides: Record<string, number> }
  export type RunResult = { ok: true; timeline: Timeline } | { ok: false; issues: string[] };
  export function deriveRun(r: Register, input: RunInput): RunResult;   // memoised on JSON.stringify(input); never throws
  // freePlay.ts
  export interface FreeCut { service: string; atDays: number; forDays: number }
  export const FREE_PLAY_ID = 'free-play';
  export function freePlayScenario(r: Register, cuts: FreeCut[], workaroundsHold: boolean): { scenario: Scenario; overrides: Record<string, number> };
  ```
- `freePlayScenario` behaviour:
  - It builds `id: 'free-play'`, `title: 'Your scenario'`, `summary: 'Cuts you chose in free play. A what-if on a fictional site, not a public record.'`, `basis: []` and `projection: true`.
  - It builds one `cut-service` event per cut. Event quantities carry a template provenance, `{ kind: 'assumed', reasoning: 'Free-play template; the value is chosen by the visitor.' }`, with placeholder values.
  - The visitor's real values are returned as `overrides` on `scenarios.free-play.events[i].at` and `.restoreAfter`, in hours. The horizon is the latest cut end plus 4 days, clamped to the range 1–400, and also passed as an override.
  - `deriveRun` merges these overrides with the editor's overrides.

- [ ] **Step 1: Failing tests:**
  ```ts
  test('register run returns a timeline', () => {
    const r = deriveRun(register, { spec: { kind: 'register', scenarioId: 's1-projection' }, variant: 'unprepared', overrides: {} });
    expect(r.ok && r.timeline.projection).toBe(true);
  });
  test('an invalid override returns issues naming the path, never throws', () => {
    const r = deriveRun(register, { spec: { kind: 'register', scenarioId: 's1-projection' }, variant: 'unprepared', overrides: { 'production.degradedOutput': 1.5 } });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.issues.join('\n')).toMatch(/production\.degradedOutput/);
  });
  test('free-play values arrive as overrides and are flagged chosen-by-visitor', () => {
    const { scenario, overrides } = freePlayScenario(register, [{ service: 'hosted-erp', atDays: 0, forDays: 12 }], false);
    const r = deriveRun(register, { spec: { kind: 'free', cuts: [{ service: 'hosted-erp', atDays: 0, forDays: 12 }], workaroundsHold: false }, variant: 'unprepared', overrides: {} });
    expect(scenario.projection).toBe(true);
    expect(overrides['scenarios.free-play.events[0].restoreAfter']).toBe(288);
    expect(r.ok && r.timeline.assumptionsUsed['scenarios.free-play.events[0].restoreAfter'].overridden).toBe(true);
  });
  test('free play with no cuts runs a one-day quiet horizon', () => { /* horizon override 24 h; no events */ });
  test('deriveRun memoises identical input', () => { /* same object returned for equal input */ });
  ```
- [ ] **Step 2: Run** `npm test -w site`. Expected: FAIL.
- [ ] **Step 3: Implement.** `deriveRun` catches `RegisterError` (returning `issues`) and rethrows anything else. The memo is a bounded LRU of 32 entries.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): model layer — register, store, run derivation, free play`.

---

### Task 3: Quantities on screen — formatting, `<Qty>` and provenance tags

**Files:**
- Create: `site/src/model/format.ts`, `site/src/ui/Qty.tsx`, `site/src/ui/ProvenanceTag.tsx`
- Test: `site/test/format.test.ts`, `site/test/qty.test.tsx`, `site/test/helpers/untagged.ts`

**Interfaces:**
- Produces:
  ```ts
  export type QtyKind = 'days' | 'hours' | 'tonnes' | 'usd' | 'mtpa' | 'usdPerT' | 'fraction';
  export function formatQty(value: number, kind: QtyKind): string;
  // <Qty value kind display={DisplayKind} overridden? source? />  renders <span data-quantity>{formatted}<ProvenanceTag/></span>
  export function untaggedNumbers(root: HTMLElement): string[]; // test helper: digit runs outside [data-quantity] and [data-clock]
  ```
- **Exact formats:**

  | Kind | Rule | Examples |
  |---|---|---|
  | `days` | one decimal; "1 day" when exactly 1 | `1.4 days`, `1 day`, `0.4 days` |
  | `hours` | integer; "1 hour" singular | `24 hours`, `1 hour` |
  | `tonnes` | thousands separator | `12,400 t` |
  | `usd` | below 1 million: `US$` plus thousands; from 1 million: `US$` plus one decimal and `M` | `US$950,000`, `US$6.0 M` |
  | `mtpa` | as is | `25 Mt/a` |
  | `usdPerT` | one decimal | `US$97.7/t` |
  | `fraction` | percent | `60%` |

- **Tags:**
  - `computed`: filled `--computed-fill`, no border;
  - `assumed`: dashed `--line-2`;
  - `sourced`: solid `--ink-3`;
  - `measured`: solid `--ink-3` with a 2 px bottom edge.

  The tag's text is the kind word. `overridden` adds a second tag, "changed by you". Hovering or focusing a sourced tag shows the source title. `title` holds the reasoning for an assumed tag.

- [ ] **Step 1: Failing tests:**
  - a `format.test.ts` table covering every row above;
  - `Qty renders value and tag together`;
  - `overridden adds changed-by-you`;
  - `untaggedNumbers finds a bare "4 days" but not one inside data-quantity or data-clock`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): quantity formatting and provenance tags`.

---

### Task 4: SceneState mapping and the schematic scene

**Files:**
- Create: `site/src/model/sceneState.ts`, `site/src/ui/SceneView.tsx`
- Modify: `docs/decisions.md` (add D-099 and D-100 as described above)
- Test: `site/test/sceneState.test.ts`, `site/test/sceneView.test.tsx`

**Interfaces:**
- Consumes: `Register`, `Sample`, `Timeline`, `ProcessState`, `ServiceState`.
- Produces (this is the contract Plan 2b's PixiJS scene implements):
  ```ts
  export type Flag = 'pennant' | 'half' | 'full';
  export interface SceneState {
    hour: number;
    processes: Record<string, { state: ProcessState; flag: Flag; hatched: boolean; label: string; note: string }>;
    services: Record<string, { state: ServiceState; cable: 'live' | 'severed' | 'revoked' }>;
    fleet: { moving: number; parked: number };          // illustrative eight (D-099)
    train: { speed: 0 | 0.5 | 1 };
    fills: { stockpile: number; romPad: number; diesel: number };   // 0..1 of capacity
    motion: { crusher: boolean; conveyor: boolean };
  }
  export function sceneState(r: Register, sample: Sample): SceneState;
  export interface SceneViewProps { scene: SceneState; selected: string | null; onSelect(processId: string): void; reducedMotion: boolean }
  export function SceneView(p: SceneViewProps): JSX.Element;   // 2a: schematic SVG
  ```
- **Binding table.** This is the "computed, not scripted" record. Write it into `sceneState.ts`'s doc comment.

  | Engine value | Scene |
  |---|---|
  | `processes[id]` | normal → pennant, degraded → half flag, stopped → full flag + hatched ground |
  | `processes.haulage` | fleet: normal 8/0, degraded 4/4, stopped 0/8 (moving/parked) |
  | `processes.rail` | train speed 1 / 0.5 / 0 |
  | `processes.crushing` | crusher and conveyor move unless stopped |
  | `services[id]` | up → live cable; down → severed; revoked → revoked |
  | `stocks['ore-stockpile'] / capacity`, `stocks['rom-pad'] / capacity`, `stocks.diesel / capacity` | fill heights |

  Each process's `label` comes from the register `name`. Its `note` is the register's `status.degraded` or `status.stopped` copy, or the empty string when normal.
- **Schematic SceneView.** An inline SVG with one labelled box per process area, placed on a fixed schematic grid; cable lines from the four services; the flag glyphs; and hatching. It must be keyboard selectable (each area is a button). It must also print the plinth text "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA". This is a stand-in; keep it clean and on-token, with no art effort.

- [ ] **Step 1: Failing tests:**
  - `binding table holds at s1-projection hour 300 unprepared`: haulage stopped → fleet `{0,8}` and flag `full`; hosted-erp up → cable live (assert against the actual timeline sample);
  - `degraded haulage shows four parked`;
  - `fills are level over capacity`: diesel at the start of hour 0 is 1;
  - `scene view renders a button per process area with its state word`;
  - `scene view shows the plinth text`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add D-099 and D-100 to `docs/decisions.md`, short, in the existing format. No `**Path:**`, because these are display and layout rules, not register paths.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. The engine's decision-log coverage test must still pass.
- [ ] **Step 5: Commit** with `feat(site): SceneState mapping and schematic scene`.

---

### Task 5: Top bar, service cards and legend

**Files:**
- Create: `site/src/ui/TopBar.tsx`, `ServiceCard.tsx`, `Legend.tsx`
- Test: `site/test/chrome.test.tsx`

**Interfaces:**
- Consumes: the store (Task 2), `SceneState` (Task 4) and `<Qty>` (Task 3).
- Produces `<TopBar>`, which renders:
  - the brand mark and word;
  - the scenario title from the register, or "Your scenario";
  - the "Fictional model site" badge (solid; from the register);
  - the "Projection" badge (dashed; shown only when `timeline.projection`);
  - the Unprepared/Prepared segmented control (store `variant`).

  The "Show the network" switch is NOT in 2a (Plan 3).
- Produces `<ServiceCard service>`. It shows the name, the status line and a Cut/Restore button with `aria-pressed`. The cut state follows DESIGN.md "Service Card". The status reads "Up", "Cut since day N" (N from the first `service-down` event hour ÷ 24, rendered in `[data-clock]`) or "Access revoked".
  - In free play the button adds or removes a cut with a default of `{ atDays: current day, forDays: 12 }`.
  - In guided mode the cards are read-only.
- Produces `<Legend>`, which draws the actual glyphs and names shapes, not colours.

- [ ] **Step 1: Failing tests:**
  - `projection badge follows the timeline` (present for `s1-projection`, absent for `s1-as-reported`);
  - `variant toggle updates the store`;
  - `cut in free play adds a cut and the card shows Restore with aria-pressed`;
  - `cards are read-only during the guided run`;
  - `legend names shapes`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): top bar, service cards, legend`.

---

### Task 6: Detail panel — revenue section and area panel

**Files:**
- Create: `site/src/ui/DetailPanel.tsx`, `RevenueSection.tsx`, `AreaPanel.tsx`
- Test: `site/test/panel.test.tsx`

**Interfaces:**
- Consumes: `Timeline`, `Sample`, `independentCopyFor`, `Register` and `<Qty>`.
- **Revenue section:**
  - "Production deferred so far": `sample.tonnesDeferred` as tonnes, tagged computed.
  - "Revenue at risk": `sample.revenueAtRisk` as usd, tagged computed.
  - The working, shown inline: `production.annualTonnes` × `production.price` × the deferred share. Each input takes its value and provenance from `timeline.assumptionsUsed`, with the `overridden` flag. Include one line of copy, "Revenue at risk, not revenue lost: shipments can recover once the stockpile refills."
- **Area panel** (for the selected process; defaults to `haulage`):
  - the register name as the heading, and its description;
  - the state box (flag glyph, state word, note);
  - the fleet row, only for `haulage`: 8 glyphs from `SceneState.fleet`, with no count number;
  - "Why this stops": the dependency or dependencies currently lost at this sample, with their names and states;
  - "Depends on": each dependency, its live state and its `onLoss`;
  - "Continuity": maximum tolerable outage and recovery target via `<Qty>` with their provenance; owner; last restore test; independent copy via `independentCopyFor(r, id, variant)` (yes/no, plus the control name when the source is a control).

- [ ] **Step 1: Failing tests:**
  - `revenue working shows each input with its tag from assumptionsUsed`: the price tag is "sourced" and the tonnes tag is "assumed";
  - `an overridden price shows changed-by-you`;
  - `why-this-stops names hosted-erp-driven loss for diesel-ordering at s1-projection hour 100 unprepared`;
  - `independent copy reads yes on prepared via independent-erp-restore for diesel-ordering`;
  - `no untagged numbers in the panel`: `untaggedNumbers(panel)` is `[]` at several hours of several scenarios.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): detail panel with revenue working and continuity`.

---

### Task 7: Timeline, playback clock and stock meters

**Files:**
- Create: `site/src/model/clock.ts`, `site/src/ui/Timeline.tsx`, `StockMeters.tsx`
- Test: `site/test/clock.test.ts`, `site/test/timeline.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface Clock { hour: number; playing: boolean; hoursPerSecond: number }
  export function advance(c: Clock, dtSeconds: number, horizonHours: number): Clock;  // clamps; stops at horizon
  export function scrubTo(hour: number, horizonHours: number): number;               // clamp + round to integer hour
  export function sampleAt(t: Timeline, hour: number): Sample;                         // samples[clamped hour]
  export const SPEEDS = [12, 24, 48, 96] as const;                                     // hours per second; default 24
  ```
- **The timeline component.**
  - Axis length: `horizon` in days. The axis numerals and the "Day N of H" figure render in `[data-clock]`.
  - Elapsed: a 3 px solid line. The remaining time is 1.5 px dashed when `timeline.projection`, otherwise solid.
  - Event hairlines for `service-down`, `service-up` and the first `process-state` change to `stopped` per process, each labelled from register names.
  - Play/pause and speed controls.
  - Keyboard: ←/→ moves one hour, Shift+←/→ one day, Home/End.
- **Stock meters.** Rows for diesel, ROM pad and stockpile: the start-of-hour level in days via `<Qty kind="days" display="computed">`.

- [ ] **Step 1: Failing tests:**
  - `advance moves by hoursPerSecond × dt`;
  - `advance stops and pauses at the horizon`;
  - `scrub clamps to the horizon`: −5 gives 0, horizon+10 gives the horizon;
  - `scenario change resets the clock`: the store action sets hour 0 and paused;
  - `axis uses the scenario horizon`: 14 ticks for as-reported, 16 for the projection;
  - `keyboard scrubbing`;
  - `stock meters are tagged and match the sample`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** One `requestAnimationFrame` loop drives `advance`, throttled to about 30 ms per frame. Reduced motion does not stop the clock; it only removes CSS transitions.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): timeline, playback clock, stock meters`.

---

### Task 8: Guided run

**Files:**
- Create: `site/src/model/guided.ts`, `site/src/ui/GuidedRun.tsx`
- Test: `site/test/guided.test.ts`, `site/test/guidedRun.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface GuidedStep { segment: 'as-reported' | 'projection' | 'prepared'; scenarioId: string; variant: Variant; hour: number; caption: (t: Timeline) => CaptionParts }
  export function guidedSteps(r: Register): GuidedStep[];   // hours derived from computed events, never hard-coded
  export const DWELL_SECONDS = 4.5;  export const TRAVEL_HOURS_PER_SECOND = 40;
  ```
- **Segments and steps.** Each step's hour is found from that segment's own timeline.
  1. **`s1-as-reported` / unprepared:**
     - hour 0, "What really happened";
     - the `service-up` hour of `hosted-erp`.
  2. **`s1-projection` / unprepared:**
     - the first `process-state` where `diesel-ordering` goes to `stopped`;
     - the first where `haulage` goes to `stopped`;
     - `hosted-erp` `service-up`;
     - the first where `rail` goes to `degraded` or `stopped`;
     - the last hour, the total.
  3. **`s1-projection` / prepared:** the same moments, by the same derivation where the event exists; otherwise the as-of hour from segment 2.
  4. **Comparison card.** Unprepared vs prepared `totals.revenueAtRisk` via `<Qty>`, the difference labelled "being prepared protected", and the caveat line built from `assumptionsUsed` for `processes.diesel-ordering.dependsOn.hosted-erp.afterRestore.holdFor`. The caveat reads: "This rests on one assumed number: a {24 hours (assumed)} hold on purchasing after the restore." The card offers "Explore it yourself" to enter free play.

  Pacing: the run holds `DWELL_SECONDS` on each step and travels between steps at `TRAVEL_HOURS_PER_SECOND`. The total is 60–90 s on the real register; a test asserts this.
- **Draft captions** (owner reviews at the gate in Task 12). Numbers are always injected via `<Qty>`, and titles come from the register. One line each:
  - "May 2026: Scope Systems' hosted ERP goes down. Purchasing moves to phone and email. This is the record, on a fictional model site."
  - "The ERP is back after {12 days (sourced)}. The trucks never stopped."
  - "Projection: what if the workarounds ran out? Fuel orders stop."
  - "The fuel farm runs dry. The fleet parks."
  - "The ERP returns, but orders are held while transactions are reconciled."
  - "The stockpile runs low. Trains slow."
  - "Same outage, prepared site: offline ordering and an independent restore keep fuel coming."
- **Controls.** A Skip button, on every step, goes to free play: `s1-projection`, unprepared, hour 0, paused. Pause/resume is also available.

- [ ] **Step 1: Failing tests:**
  - `fleet-park step hour equals the first haulage stopped event`;
  - `no step hour is a literal`: steps recompute when a `stocks.diesel.initial` override shifts the events;
  - `total guided duration is 60–90 s`;
  - `comparison shows both totals and the assumed-hold caveat with its tag`;
  - `skip from any step lands cleanly in free play`: store state is as specified, and no pending timers (fake timers, `vi.getTimerCount() === 0` after skip).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): event-driven guided run`.

---

### Task 9: Free play and the assumptions editor

**Files:**
- Create: `site/src/ui/FreePlay.tsx`, `AssumptionsEditor.tsx`
- Test: `site/test/freePlayUi.test.tsx`, `site/test/editor.test.tsx`

**Interfaces:**
- **Free play** provides:
  - a scenario picker: the five register scenarios, plus "Your scenario" when cuts exist;
  - a per-cut editor: start day and duration in days, with number inputs where 0 ≤ start, 1 ≤ duration, and start + duration ≤ 400 days;
  - a "Workarounds keep going" checkbox, for free play only;
  - a reset control.
- **Assumptions editor** (desktop only). It lists the editable inputs from the current `timeline.assumptionsUsed`:
  - `production.*`;
  - `stocks.<id>.initial`, `.capacity` and `.leadTime`;
  - the purchasing `afterRestore.holdFor` values;
  - workaround `holdsFor` for services the current scenario touches;
  - control durations, prepared runs only.

  Each row shows its current value via `<Qty>` with its tag and reasoning, plus an input. Edits go to the store's `overrides`. While `deriveRun` returns `ok: false`, the editor shows the issues next to the matching rows (matching by path) and the site keeps rendering the last successful timeline.

- [ ] **Step 1: Failing tests:**
  - `invalid edit keeps the last good run and names the field`: set price to −1 and expect an inline error containing "price", with the panel still showing the previous revenue;
  - `empty input is ignored until valid`;
  - `variant toggle keeps free-play cuts`;
  - `scenario picker switches and resets the clock`;
  - `editor hides control durations on the unprepared run`;
  - `changed-by-you appears on the edited input everywhere it is shown`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): free play and assumptions editor`.

---

### Task 10: Welcome page, supporting pages and routing

**Files:**
- Create: `site/src/routes.ts`, `site/src/ui/pages/*.tsx`
- Modify: `site/src/App.tsx`
- Test: `site/test/pages.test.tsx`

**Interfaces:**
- **Hash routes:** `#/` welcome, `#/site` app, `#/sources`, `#/tested`, `#/built`, `#/limits`. Unknown routes go to welcome.
- **Welcome.** Copy follows `.impeccable/mocks/directions/BRIEF.md` "welcome.html copy":
  - the headline;
  - two short paragraphs;
  - the primary button "Show me the site", which starts the guided run;
  - the secondary "Explore freely", which goes to free play. The brief's "Watch the 2-minute walkthrough" is omitted until the video exists (Plan 4).
  - the sources line, linking to `#/sources`;
  - the byline "Built by [Your name], cyber security graduate, Perth", where `[Your name]` stays a visible placeholder until the owner fills it in at the Task 12 gate;
  - a schematic `SceneView` as the visual.
- **Sources.** Generated from `register.sources`: title, URL, accessed date. Every link has `rel="noopener noreferrer"`.
- **How this was tested.** An honest interim note: "The lab that measures these controls arrives in the next release. Until then every control's capability is labelled assumed." Plus a list of the controls and their current provenance kind, from the register.
- **How I built this.** Drafted copy showing a visible "Draft — awaiting owner review" banner. It covers what the owner decided, what Claude Code wrote, how it was checked (tests, independent reviews, the decision log) and what was learned.
- **Limitations.**
  - It is a fictional site with synthetic data.
  - Lab timings are not comparable with real ones.
  - The S1 dollar figure rests on the assumed hold.
  - There is no delivery-rate modelling beyond the lead times.
  - Link to the decision log in the repo, as a placeholder URL until the repo is public.

- [ ] **Step 1: Failing tests:**
  - `welcome primary starts the guided run`;
  - `explore goes to free play`;
  - `sources page lists every register source with its accessed date`;
  - `built page shows the draft banner`;
  - `unknown route falls back to welcome`;
  - `no page uses the word lost about revenue`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): welcome and supporting pages`.

---

### Task 11: Layout, mobile tiering and end-to-end checks

**Files:**
- Modify: `site/src/App.tsx`, `site/src/styles/base.css`
- Create: `site/playwright.config.ts`, `site/e2e/site.spec.ts`
- Test: e2e

**Interfaces:**
- **Desktop.** Use the DESIGN.md app frame:
  - a 60 px top bar;
  - the stage, with service cards pinned along its top;
  - the legend bottom-right;
  - a 92 px timeline split 186 / flexible / 250;
  - the 372 px detail panel docked right.
- **Phone (≤ 760 px).**
  - A single column.
  - The service cards become a horizontally scrolling strip of 210 px cards.
  - The timeline and stocks stack.
  - The assumptions editor is replaced by a "Best on a laptop" note.
- **Playwright projects:** `desktop` 1440 × 900 and `phone` 390 × 844, against `vite preview`.

- [ ] **Step 1: Write the e2e tests:**
  - `guided run plays and ends on the comparison`: speed up via the store's dev hook `window.__faillocal.setSpeed(400)`, which is exposed only when `import.meta.env.DEV` or under `?e2e`;
  - `free play: cut hosted-erp, scrub to day 13, haulage reads Stopped`;
  - `no untagged numbers on the site view`: page-level scan equivalent to `untaggedNumbers`, at three timeline positions;
  - `no console errors and no requests to other origins`;
  - `phone layout`: no horizontal scroll (`scrollWidth <= innerWidth`), the editor note is present, and the cut button works.
- [ ] **Step 2: Run** `npm run e2e -w site`. Expected: FAIL.
- [ ] **Step 3: Implement** the layout and the responsive rules.
- [ ] **Step 4: Run** `npm test` and `npm run e2e -w site`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): app frame, phone tiering, e2e checks`.

---

### Task 12: Security headers, build guard, and owner gates

**Files:**
- Create: `site/public/_headers`, `site/scripts/check-build.mjs`
- Modify: `site/package.json` (`build` runs `vite build && node scripts/check-build.mjs`), `README.md`
- Test: `site/test/headers.test.ts`

**Interfaces:**
- **`_headers`** applies to every path:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  ```
- **`check-build.mjs`** fails the build if:
  - `dist/index.html` contains an inline `<script>` body or an inline `style=` attribute;
  - any file in `dist/` references `http://` or `https://` URLs other than the register's source URLs in the Sources page bundle (allow-list the register URLs);
  - the gzipped JS total exceeds 300 KB. Plan 2b raises this for PixiJS.

- [ ] **Step 1: Failing tests:**
  - `headers file carries the exact CSP`: parse `_headers` and compare with the block above;
  - `check-build rejects an inline script`, against a fixture;
  - `check-build allows register source URLs only`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Run `npm run build -w site` and `npm audit --omit=dev`. Expected: the build passes the guard and there are no high or critical advisories.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run e2e -w site`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): CSP headers and build guard`.
- [ ] **Step 6: STOP — owner gates.** Do not deploy, buy anything, or change repo visibility. Report to the owner and wait for each of these:
  1. the domain or subdomain for Cloudflare Pages;
  2. Cloudflare account access, or the owner deploying `site/dist` themselves;
  3. their name for the byline;
  4. approval or edits for the "How I built this" draft and the guided-run captions;
  5. making the GitHub repo public. This happens at the first playable release, after Plan 2b, not after 2a.

---

## Done when

- `npm test`, `npm run typecheck` and `npm run e2e -w site` pass from the root, and `npm run build -w site` passes the build guard.
- The guided run plays in 60–90 s, ends on the computed comparison with the assumed-hold caveat, and can be skipped at any step.
- Free play and the editor never crash on bad input, and every number on screen carries a tag.
- The owner gates in Task 12 have been reported. Plan 2b is written next against `SceneState`.
