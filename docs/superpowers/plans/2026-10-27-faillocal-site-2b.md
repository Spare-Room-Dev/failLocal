# FailLocal Plan 2b: The Living Diorama — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the schematic scene with the animated PixiJS "Living Diorama" behind the existing `SceneView` seam, fix the three before-release items, and finish with the impeccable finish review and a re-recorded DESIGN.md. When this plan is done, release 2 is ready to ship, once the owner's gates are cleared.

**Architecture:**
- First, the seam contract is hardened (version 2), so both scenes implement the same contract and are tested against it: the schematic, kept as the no-WebGL fallback, and the new diorama.
- Every piece of scene maths is pure and unit-tested: projection, one-sun tone, shadows, camera, layout, paths and the animation state.
- PixiJS only draws what those modules compute.
- An accessible DOM layer over the canvas provides:
  - process-area buttons;
  - the honesty plate text;
  - the cable anchors that place the cards.
- The register is compiled to JSON at build time, so the YAML parser leaves the browser bundle.

**Tech Stack:** `pixi.js@^8.22` (import `pixi.js/unsafe-eval` before any renderer, because the CSP forbids eval). Everything else is unchanged from Plan 2a: React 19, Vite 8, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-faillocal-design.md`. Also binding:
- `DESIGN.md`, especially Layout, Elevation & Depth, Components, Motion and Mining Accuracy;
- `PRODUCT.md`;
- `docs/superpowers/plans/2026-10-27-plan-2a-followups.md`;
- the art reference `.impeccable/mocks/directions/diorama/site.html` and `welcome.html`. This is the approved direction. Match its finish, not its compressed geometry.

## Decisions made in this plan (log each in `docs/decisions.md` in the owning task)

- **D-104: bundle budget.** It rises from 300 KB to 450 KB gzipped JS (decimal), to make room for PixiJS.
- **D-105: layout values.** These include the bench count and size, road width, balloon-loop radius, magazine setbacks and the default camera framing. They are display geometry, labelled assumed, with reasoning that cites DESIGN.md's Mining Accuracy section and D-100.
- **D-106: no-WebGL fallback.** If WebGL is unavailable, the schematic scene renders with the note "Simplified view: this browser can't draw the 3D model." It is never blank.

## Global Constraints

- **Everything from Plan 2a still binds.** That covers the honesty rules (every on-screen number goes through `<Qty>`, no "lost", fictional labelling) and the CSP `_headers`, which are unchanged. Do NOT loosen the CSP. Use `pixi.js/unsafe-eval` instead.
- **DESIGN.md scene rules are law:**
  - a true 2:1 dimetric projection in metres, `screenX = ox + (x − y)·k` and `screenY = oy + (x + y)·k/2 − z·k·1.2247`;
  - painter's order by `x + y`;
  - one sun, `L = normalize(−1, 0.1, 1.05)`, with tone mixing toward `shade-dark` / `shade-lite` as specified;
  - shadows cast at `(1.5, −0.15)` per metre of height, `cast-shadow` at 34%;
  - no second light, no gradients on solids, no tilt or perspective transform;
  - octilinear cables with 9 px chamfers;
  - state shown by shape first: full, half or pennant flag, hatched ground, parked marker, severed cable;
  - parked items desaturated (khaki trucks, grey entry posts);
  - no green.
- **The board is 1,600 × 1,000 m (D-100):**
  - balloon-loop radius ≥ 200 m;
  - explosives magazine ≥ 500 m from the workshop, fuel farm and camp;
  - five benches, 12 m high, 11 m berms;
  - a ramp about 25 m wide at about 11%;
  - haul roads 26 m wide;
  - ultra-class trucks, 13 × 7.6 m.
- **All art is vector, drawn in code.** No bitmaps.
- **The scene renders engine output only.** Every visual state comes from `SceneState` (the binding table in `sceneState.ts`). Ambient motion (vehicles circulating, dust, travelling cable dots) is decorative, and it is only shown while the bound state says that thing is running.
- **Motion:**
  - frame updates throttled to about 30 ms;
  - dt capped at 0.25 s;
  - `timeScale` honoured (R9);
  - reduced motion renders one still frame of the same engine state.
- **The honesty plate** "FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA" is visible as DOM text wherever the board's front edge is in frame. `register.site.fictional` is a boolean: the scene builds the plate from it, and a register with `fictional: false` makes `buildSceneState` throw rather than render an unlabelled site.

## Review Focus

1. **No WebGL** (blocked, old device, context creation fails). The schematic renders with the D-106 note, and nothing goes blank. → Task 5, e2e `no webgl falls back to the schematic`.
2. **Route changes mount and unmount the scene repeatedly.** The WebGL context and the ticker are destroyed every time, so 20 mount/unmount cycles neither lose a context nor leak tickers. → Task 5, e2e `scene mount and unmount does not leak contexts`.
3. **Camera extremes** (zoomed fully in or out, panned far away). The camera clamps so part of the board is always in view, and the plate DOM stays visible whenever the front edge is in frame. → Task 3 unit `camera clamps`, plus Task 7 e2e.
4. **Tab hidden for 30 s, then regained.** Vehicles resume without a jump (dt cap). → Task 6, unit `animation step caps dt`.
5. **Reduced motion.** It shows the same flags, fills, fleet split and cable states as the moving frame for the same `SceneState`. → Task 6, unit `still frame matches state`.

---

## File Structure

```
site/
  scripts/build-register.mjs            # YAML -> validated JSON (Task 2)
  src/model/register.ts                 # now imports register.json
  src/model/sceneState.ts               # v2 contract (Task 1)
  src/ui/SceneView.tsx                  # picks Diorama or Schematic; contract types
  src/ui/scene/SchematicScene.tsx       # the 2a SVG, moved, v2 contract
  src/ui/scene/DioramaScene.tsx         # React shell: canvas + accessible DOM layer (Tasks 5–7)
  src/scene/iso.ts                      # projection, tone, shadow hull, depth, camera (Task 3)
  src/scene/layout.ts                   # world geometry in metres (Task 4)
  src/scene/paths.ts                    # haul cycle, rail loop, conveyor, LV loop (Task 4)
  src/scene/animation.ts                # pure animation state from SceneState + t (Task 6)
  src/scene/pixi/app.ts                 # Application lifecycle, CSP import, ticker (Task 5)
  src/scene/pixi/static.ts              # terrain, slab, plinth, structures, shadows (Task 5)
  src/scene/pixi/dynamic.ts             # vehicles, train, belt, fills, flags, cables (Task 6)
  test/sceneContract.test.tsx           # one contract suite run against both scenes
```

---

### Task 0: Before-release fixes (batched)

**Files:**
- Modify:
  - `docs/decisions.md` (D-079)
  - `site/src/styles/base.css` (the tablet tier)
  - `site/src/model/store.ts`
  - `site/src/ui/AssumptionsEditor.tsx`
  - `site/src/ui/useDraft.ts`
  - `site/playwright.config.ts`
- Test: `site/test/editor.test.tsx`, `site/e2e/site.spec.ts`

- [ ] **Step 1: Write the failing tests.**
  - **`reset all clears refused drafts`.** Type `-1` into the price field and see the field issue. Click "Reset all". The field then shows the current register value and no issue is shown.
  - **`field issues are re-tried after a change`.** Set the diesel `initial` above its capacity, which is refused. Raise the capacity override. The refused field is re-tried and accepted, and its issue clears. A `fieldIssues` entry whose draft is now valid must not stay stale.
  - **e2e `1150 px keeps a usable timeline`.** Add a project at 1150×800. The axis is wider than 200 px and the toggle is in view.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.**
  - Move the tablet tier to `(min-width: 761px) and (max-width: 1200px)`.
  - `clearOverrides` and the per-row reset also clear `fieldIssues` and the drafts. Use a reset key that remounts the row.
  - After any committed override, scenario change or variant change, re-try every pending field draft once.
  - Amend D-079 so it names both assumptions:
    - the phone-and-email workaround `holdsFor` is 3 days. At 0 days about $25.65M is at risk; at 9 days or more, $0;
    - the purchasing hold `holdFor` is 24 h. Below 10 h, $0; at 48 h, about $8.92M.

    Write it as "rests on two assumed numbers". Record the change in the entry's Owner change line as a controller correction.
- [ ] **Step 4: Run `npm test` and `npm run e2e -w site`.** Expected: PASS.
- [ ] **Step 5: Commit** with `fix: before-release items — D-079 names both assumptions, tablet tier to 1200 px, refused drafts reset`.

---

### Task 1: Scene contract v2 and the schematic as its first implementation

**Files:**
- Modify:
  - `site/src/model/sceneState.ts`
  - `site/src/ui/SceneView.tsx` (this becomes the contract and the chooser)
  - `site/src/ui/pages/SitePage.tsx`
  - `site/src/ui/pages/WelcomePage.tsx`
- Move: the SVG implementation from `SceneView.tsx` to `site/src/ui/scene/SchematicScene.tsx`
- Test: `site/test/sceneContract.test.tsx` replaces the implementation-specific parts of `sceneView.test.tsx`; also update `site/e2e/site.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // sceneState.ts — additions
  export interface SceneState {
    /* …2a fields… */
    cables: Record<string, Cable>;          // keyed by SERVICE_GROUPS id (from groupState)
    plate: { fictional: true; text: string }; // DESIGN's fixed wording; throws unless register.site.fictional
  }
  // missing engine values THROW (replace every `?? 'normal'|0|'live'` fallback)
  // SceneView.tsx — the contract
  export interface SceneViewProps {
    scene: SceneState; selected: string | null; onSelect(id: string): void;
    reducedMotion: boolean; decorative?: boolean;            // welcome hero: no buttons, aria-hidden
    onAnchors?(anchors: Record<string, number>): void;        // group id -> x of its entry post, 0..1 of the scene box width
  }
  export function SceneView(p: SceneViewProps): JSX.Element;  // chooses Diorama (Task 5) or Schematic
  ```
- **The accessible DOM contract.** Every implementation must render all of the following:
  - **Area buttons:** one `<button>` per process area with `aria-label="<label>: <State word>"` and `aria-pressed` set by `selected`. Enter, Space and click call `onSelect`.
  - **Honesty plate:** one element with class `.scene-plinth`, containing the plate text as real DOM text.
  - **Cable markers:** one element per group, carrying `data-cable-group="<id>"` and `data-cable-state="live|severed|revoked"`.
  - **Anchors:** report `onAnchors` after layout, and again whenever the anchors change.
- **SitePage.** It positions each card slot from the reported anchors, falling back to `cableFraction(i)` until anchors arrive. The card-centring e2e test now reads its positions from the anchors.

- [ ] **Step 1: Write the failing tests.**
  - **`sceneContract.test.tsx`.** Write it as a `describe.each` over implementations; for now only `SchematicScene`. It covers:
    - buttons and labels;
    - the `.scene-plinth` text equals `scene.plate.text`, and `buildSceneState` throws for a register copy with `fictional: false`;
    - `data-cable-group` and its state, at s1-projection hour 300 for hosted-erp and at s3 prepared hour 12 for vendor (revoked);
    - `onAnchors` is called with one value per group, each in (0, 1);
    - `decorative` renders no buttons and sets `aria-hidden`.
  - **`sceneState` throws on a missing process, service or stock value.**
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.**
  - Do the move and add the contract fields.
  - Update the existing e2e selectors to the contract: `[data-cable-group]` instead of the SVG `line`, and the `.scene-plinth` text instead of SVG internals.
- [ ] **Step 4: Run `npm test` and `npm run e2e -w site`.** Expected: PASS.
- [ ] **Step 5: Commit** with `refactor(site): scene contract v2 — cables, plate, anchors, accessible DOM layer`.

---

### Task 2: Register compiled to JSON at build time

**Files:**
- Create: `site/scripts/build-register.mjs`
- Modify: `site/src/model/register.ts`, `site/package.json` (`prebuild`/`predev` run the script; the output is gitignored at `site/src/generated/register.json`), `.gitignore`
- Test: `site/test/register.test.ts`, plus a build-guard assertion

**Interfaces:**
- `build-register.mjs` reads `register/pilbara-model-site.yaml` and runs the engine's `loadRegisterYaml`, failing the build on a `RegisterError`. It then writes the parsed object as JSON.
- `register.ts` imports the JSON and runs `parseRegister`. Zod still validates it at runtime.

- [ ] **Step 1: Write the failing tests.**
  - `json register equals the yaml register`: deep-equal both after `parseRegister`.
  - `site bundle has no yaml parser`: after build, no `dist` JS contains the `yaml` package's signature string. Pick a stable one, such as its error class name, and state which in the test.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.** Remove `yaml` from the site's runtime dependencies. If the tokens test still needs it, keep it as a devDependency.
- [ ] **Step 4: Run `npm test`, `npm run build -w site` and `npm run e2e -w site`.** Expected: PASS, with a smaller bundle.
- [ ] **Step 5: Commit** with `perf(site): compile the register to JSON at build time`.

---

### Task 3: Scene maths (pure)

**Files:**
- Create: `site/src/scene/iso.ts`
- Test: `site/test/scene/iso.test.ts`

**Interfaces:**
```ts
export interface Vec3 { x: number; y: number; z: number }
export function project(p: Vec3, cam: Camera): { sx: number; sy: number };           // DESIGN formula
export function tone(baseHex: string, normal: Vec3): string;                           // one-sun mix
export function boxFaces(base: string): { top: string; left: string; right: string };  // +z, +y, +x faces
export function shadowHull(footprint: { x: number; y: number }[], height: number): { x: number; y: number }[];
export function depthKey(p: Vec3, bias?: number): number;                              // x + y + bias
export interface Camera { k: number; ox: number; oy: number }
export function fitCamera(board: { w: number; h: number }, view: { w: number; h: number }, focus?: Rect): Camera;
export function clampCamera(cam: Camera, board: { w: number; h: number }, view: { w: number; h: number }): Camera;
export const K_MIN = 0.35, K_MAX = 2.4;
```

- [ ] **Step 1: Write the failing tests.**
  - `boxFaces` reproduces DESIGN's worked values exactly:
    - galvanised `#d9d5cc` → `#e2dcd1` / `#d2cec5` / `#938a87`;
    - hi-vis `#f2b01e` → `#f5c04a` / `#eaaa1e` / `#a2741f`.
  - `project` of the four board corners gives the dimetric diamond: north at the top, +x to the lower right.
  - `shadowHull` for a 10 m box offsets by `(15, −1.5)` m.
  - `depthKey` orders a far object before a near one.
  - `camera clamps`: whatever the requested k and origin, `clampCamera` keeps k within `[K_MIN, K_MAX]` and keeps at least 25% of the board's bounding box inside the view.
  - `fitCamera` with a focus rectangle centres that focus.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.** Hex colours are mixed in sRGB as DESIGN implies. If the worked values only match in another space, the test decides which.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(scene): dimetric projection, one-sun tone, shadows, camera`.

---

### Task 4: World layout and paths (pure, with mining invariants)

**Files:**
- Create: `site/src/scene/layout.ts`, `site/src/scene/paths.ts`
- Modify: `docs/decisions.md` (add D-105)
- Test: `site/test/scene/layout.test.ts`

**Interfaces:**
```ts
export const BOARD = { w: 1600, h: 1000 } as const;   // metres
export interface Structure { id: string; kind: 'box'|'tank'|'cone'|'gallery'|'shed'|'magazine'|'camp'; at: Vec3; size: Vec3; base: string /* token */ }
export interface Layout {
  pit: { centre: Vec3; benches: { radiusX: number; radiusY: number; floorZ: number }[]; rampWidth: number; rampGrade: number };
  roads: { id: string; points: { x: number; y: number }[]; width: number }[];
  structures: Structure[];
  areas: Record<string /* process id */, { anchor: Vec3; pad: { x: number; y: number }[] }>; // flag pole + hatched pad
  entryPosts: Record<string /* group id */, Vec3>;    // on the north rim, ordered like SERVICE_GROUPS
  railLoop: { centre: Vec3; radius: number }; stockyard: { windrows: number }; creek: { x: number; y: number }[]; ridge: { x: number; y: number }[];
  defaultFocus: { x: number; y: number; w: number; h: number }; // pit → crusher
}
export const LAYOUT: Layout;
// paths.ts
export interface Path { length: number; at(s: number): { p: Vec3; heading: number } }  // s in metres, wraps
export const HAUL_CYCLE: Path; export const RAIL_LOOP: Path; export const LV_LOOP: Path; export const CONVEYOR: Path;
```

- [ ] **Step 1: Write the failing tests.** They pin every Global Constraints geometry value:
  - five benches, 12 m apart in height;
  - berm ≥ 11 m;
  - ramp width 25 ± 3 m;
  - grade 11 ± 2%;
  - roads 26 m;
  - loop radius ≥ 200 m;
  - magazine distance ≥ 500 m to the workshop, fuel farm and camp;
  - everything inside `BOARD`;
  - no structure footprint intersects the pit crest or a road.
  - Every process id in the register has an area.
  - Every `SERVICE_GROUPS` id has an entry post, posts are ordered west to east, and all of them sit on the north rim.
  - `HAUL_CYCLE` is closed (`at(0) ≈ at(length)`), passes the dump pocket and the pit floor, and keeps the two lanes 4.6 m apart.
  - Spinifex placement (when added in Task 5) avoids roads, pads and the pit, so expose a pure `spinifexPoints(seed)` here and test it.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.**
  - Take the arrangement from the diorama mockup at real scale: pit to the west-centre, ROM pad and crusher east of it, the overland conveyor over the creek to the stockyard, the balloon loop south-east, the fuel farm and workshop north-east, the camp east, and the magazine in the far south-west corner.
  - Add D-105, short, with no Path line.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(scene): world layout and paths at real setbacks (D-100, D-105)`.

---

### Task 5: PixiJS static scene, lifecycle, camera and the WebGL fallback

**Files:**
- Create: `site/src/scene/pixi/app.ts`, `site/src/scene/pixi/static.ts`, `site/src/ui/scene/DioramaScene.tsx`
- Modify:
  - `site/src/ui/SceneView.tsx` (choose Diorama when `webglAvailable()` is true, otherwise Schematic plus the D-106 note);
  - `site/package.json` (`pixi.js@^8.22`);
  - `docs/decisions.md` (add D-104 and D-106).
- Test: `site/e2e/scene.spec.ts`, plus contract coverage in `sceneContract.test.tsx` (run Diorama in jsdom with Pixi mocked at the module boundary, asserting only the DOM layer)

**Interfaces:**
```ts
export function webglAvailable(): boolean;     // creates and releases a test context; cached
export interface DioramaHandle { setState(s: SceneState, reducedMotion: boolean): void; setCamera(c: Camera): void; destroy(): void }
export async function createDiorama(host: HTMLElement, onCamera: (c: Camera) => void): Promise<DioramaHandle>;
```
- **`app.ts`:**
  - Its first statement is `import 'pixi.js/unsafe-eval'`, before any other Pixi import.
  - It owns `Application.init` (`antialias: true`, `resolution: devicePixelRatio`, `autoDensity`).
  - It uses a single ticker throttled to 30 ms, scaled by `timeScale` with dt capped at 0.25 s.
  - It cleans up with `destroy({ removeView: true }, { children: true, texture: true })`.
- **`static.ts`** draws, in this order:
  1. the plinth and its shadow;
  2. the cut-away slab, with strata bands on the two visible faces and the lit lip;
  3. faceted terrain, as a noise blend of `oxide-low`/`oxide-high`;
  4. the ridge and creek, with gum trees;
  5. benches, ramp and sump;
  6. roads, with windrow edges;
  7. pads;
  8. structures, faceted via `boxFaces` and `tone`;
  9. cast shadows;
  10. the spinifex.

  The plate text is engraved on the plinth face as canvas text, AND the DOM `.scene-plinth` stays visible from Task 1's contract. Everything is drawn once into containers and only redrawn when the camera changes.
- **Camera controls:**
  - wheel and trackpad zoom about the cursor;
  - drag to pan;
  - pinch on touch;
  - the `+` / `-` / `0` keys when the scene has focus, where `0` fits the view;
  - a small "Fit" button in the stage corner.

  The camera always passes through `clampCamera`. The default is `fitCamera(BOARD, view, LAYOUT.defaultFocus)`.

- [ ] **Step 1: Write the failing e2e tests** (Chromium with WebGL, using `--use-angle=swiftshader` / `--enable-unsafe-swiftshader` as needed):
  - `canvas renders the board`: sample canvas pixels and find at least 3 distinct scene palette colours, `oxide`, `galvanised` and `plinth`, within a tolerance;
  - `no CSP violations with the diorama`;
  - `no webgl falls back to the schematic`: launch with `--disable-webgl` (or stub `getContext`), then expect the D-106 note and the schematic contract DOM;
  - `scene mount and unmount does not leak contexts`: navigate `#/site` ↔ `#/sources` 20 times, then expect no `webglcontextlost`, no console errors, and the canvas renders;
  - `camera zoom and fit`: wheel to zoom in past `K_MAX`, then press `0`, and confirm the view returns to the default framing.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.** Use Context7 (`/pixijs/pixijs/v8.22.0`) to confirm the v8 APIs (`Application.init`, `Graphics` fill/stroke chains, `Container`, `Ticker`). Do not guess.
- [ ] **Step 4: Run `npm test`, `npm run build -w site` and `npm run e2e -w site`.** Expected: PASS. Raise the budget per D-104 in this task: set `JS_BUDGET_BYTES` to 450,000 and update its test.
- [ ] **Step 5: Commit** with `feat(scene): PixiJS diorama — static world, camera, lifecycle, no-WebGL fallback`.

---

### Task 6: Living state — vehicles, train, belt, fills, flags, cables, reduced motion

**Files:**
- Create: `site/src/scene/animation.ts`, `site/src/scene/pixi/dynamic.ts`
- Test: `site/test/scene/animation.test.ts`, plus a `site/e2e/scene.spec.ts` addition

**Interfaces:**
```ts
export interface AnimState {
  trucks: { pos: Vec3; heading: number; loaded: boolean; parked: boolean }[];   // 8, from scene.fleet
  dust: { pos: Vec3; age: number }[];
  train: { head: number /* s along RAIL_LOOP */; wagonsFilled: number };
  beltOffset: number; cableDots: Record<string, number>; lvs: { pos: Vec3; heading: number }[];
}
export function initAnim(scene: SceneState): AnimState;
export function stepAnim(a: AnimState, scene: SceneState, dtSeconds: number): AnimState;   // pure; dt capped at 0.25
export function stillFrame(scene: SceneState): AnimState;                                   // reduced motion
```
- **Bindings.** These are the same table as `sceneState.ts`.
  - **Trucks:**
    - `scene.fleet.moving` trucks advance on `HAUL_CYCLE`, spaced evenly, and run loaded on the way up;
    - parked trucks sit at the fuel bay, are drawn in `hivis-parked`, and carry the pause marker.
  - **Train:** it advances at `train.speed`. Wagons fill as they pass the loadout bin while `motion.conveyor` is true.
    - *Correction (final review, ruling R-ab):* wagons fill while the train runs (`train.speed > 0`), not while `motion.conveyor` is true: the loadout is fed from the stockpile, and rail runs only while the stockpile feeds it. The belt stays bound to `motion.conveyor`.
  - **Belt:** the dashes move only while `motion.conveyor` is true.
  - **Fills:**
    - the stockpile windrow height is ∝ `fills.stockpile`;
    - the ROM pad heap is ∝ `fills.romPad`;
    - the tank level marker is ∝ `fills.diesel`.
  - **Flags, plaques and hatch:** per `scene.processes`. Use DESIGN's survey flags (full, half, pennant), the 26.565° hatch on the area pad, and plaques with the label and state word. Selection inverts the plaque.
  - **Cables:** per `scene.cables`.
    - Live cables are octilinear, from the stage top down to the posts, with travelling dots.
    - Severed cables show the break bars, a pulsing ring, the "Link cut" label, and a dashed run beyond the break.
    - Revoked cables are dashed with the "Access revoked" label.
    - A cut service's entry post is desaturated.
  - **Dust:** puffs every 0.22 s behind moving trucks only, fading over 2.6 s.
- **Reduced motion.** `stillFrame` is used, so there are no dots, pulse or belt movement. Every state-bearing visual is identical.

- [ ] **Step 1: Write the failing unit tests:**
  - `moving and parked trucks follow scene.fleet`: at 8/0, 4/4 and 0/8, the parked trucks sit at the fuel bay.
  - `animation step caps dt`: a 30 s dt advances the trucks the same distance as 0.25 s.
  - `still frame matches state`: for several `SceneState`s, `stillFrame` and a stepped frame agree on the fleet split, the train-moving flag, the fills and the cable states.
  - `no movement when stopped`: when haulage is stopped, no moving trucks appear. When rail is stopped, the train head does not advance. When the conveyor is stopped, the belt offset does not change.
  - `deterministic`: the same inputs give equal outputs.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement** `animation.ts`, then `dynamic.ts`, which draws `AnimState` plus `SceneState` every throttled tick.
- [ ] **Step 4: Add e2e `cutting hosted-erp severs its cable on the canvas layer`.** Cut the service, then expect `data-cable-state="severed"` for the group, and a canvas pixel probe near its entry post finds Stop Red. Run `npm test` and `npm run e2e -w site`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(scene): living state — fleet, train, belt, fills, flags, cables, reduced motion`.

---

### Task 7: Accessible DOM layer, anchors, phone crop, welcome hero

**Files:**
- Modify: `site/src/ui/scene/DioramaScene.tsx`, `site/src/ui/pages/SitePage.tsx`, `site/src/ui/pages/WelcomePage.tsx`, `site/src/styles/base.css`
- Test: `site/test/sceneContract.test.tsx` (Diorama added to the `describe.each`), `site/e2e/site.spec.ts`

**Interfaces:**
- **Area buttons.** `DioramaScene` overlays one absolutely positioned button per area at `project(area.anchor)`. Each button is a transparent hit target over the plaque, carrying the contract `aria-label` and `aria-pressed`. Positions update on camera change.
- **Plate.** `.scene-plinth` is positioned over the projected plinth face. When the front edge is out of view (zoomed in), the plate pins to the bottom of the stage, so it is always visible.
- **Cables.** `data-cable-group` markers sit at the entry posts.
- **Anchors.** `onAnchors` reports `project(entryPosts[id]).sx / sceneBoxWidth`.
- **Phone (≤ 760 px).**
  - The camera focuses on the working area (pit → crusher → stockyard).
  - Cables are hidden. The cards strip already shows service states.
  - Touch uses pinch and drag; a single tap selects an area.
- **Welcome.** `decorative`, `k = 1.18` crop on the pit, ROM pad and crusher, untilted, with slow ambient motion. Under reduced motion it is a still frame.

- [ ] **Step 1: Write the failing tests.**
  - The contract suite runs against Diorama (Pixi mocked) and passes the same assertions as the schematic.
  - The e2e tests from 2a (`desktop frame`, `hairline labels`, `free play`, `phone layout`, `no untagged numbers`) pass with the diorama active.
  - **Card centring.** At 1440, 1150, 1024 and 820, each card's centre is within 2 px of its reported anchor, and no card covers its cable by more than 8 px.
  - **Plate.** At maximum zoom, `.scene-plinth` is still visible and contains "SYNTHETIC DATA".
  - **Phone.** No cable markers are visible, and tapping an area selects it.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test` and `npm run e2e -w site`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(scene): accessible layer, cable anchors, phone crop, welcome hero`.

---

### Task 8: Chrome follow-ups and legibility

**Files:**
- Modify: `site/src/ui/TopBar.tsx`, `site/src/ui/chrome.css`, `site/src/ui/pages/LimitsPage.tsx`, `site/src/styles/base.css`, `site/src/ui/ProvenanceTag.tsx`, `site/src/ui/Timeline.tsx`, `site/test/helpers/untagged.ts`, `site/test/guided*.test.*`
- Test: the existing suites, plus the additions below

- [ ] **Step 1: Write the failing tests.**
  - The badges carry their line glyphs.
  - `chrome.css` has no raw hex or rgba outside `tokens.css`. Add a stylesheet scan test.
  - The Limitations caveat shows the "Draft copy" marker.
  - Assumed-value reasoning is reachable by keyboard and touch. The tag becomes a button that toggles a popover, and Escape dismisses it, matching the sourced tooltip, which also becomes hoverable.
  - Only one hairline label shows at a time, even with focus and hover on different hairlines.
  - `untaggedNumbers` also scans `aria-label` and `title`, and the input `value` of read-only fields. The whole site passes.
  - The guided "skip from any step" test gets a 15 s timeout.
- [ ] **Step 2: Run them and confirm they FAIL.**
- [ ] **Step 3: Implement.** Also give the compact cards at 1024–1280 px the stage's side gutters: widen the card band to the full stage, keep cards centred on their anchors, and clamp them at the edges. The vendor rows then read "Vendor A" and "Vendor B", not "V.".
- [ ] **Step 4: Run `npm test` and `npm run e2e -w site`.** Expected: PASS.
- [ ] **Step 5: Commit** with `fix(site): chrome follow-ups — glyphs, tokens, accessible reasoning, legibility`.

---

### Task 9: Finish — impeccable review, fixes, DESIGN.md re-record

**Files:** whatever the review names; `DESIGN.md` and `.impeccable/design.json` (via the documenter); `docs/superpowers/plans/2026-10-27-plan-2a-followups.md` (mark items done)

- [ ] **Step 1: Capture screenshots.** Use `.impeccable/review/` at 1440×900, 1150×800, 1024×768, 820×1180 and 390×844. At each size, capture the s1-projection unprepared run at day 13 (fleet parked, ERP back) and the s1-as-reported run at day 3. Also capture the welcome page at 1440 and 390.
- [ ] **Step 2: Run the detector.** Run `node <impeccable>/scripts/detect.mjs --json` over `site/src` (CSS and TSX). Fix anything mechanical.
- [ ] **Step 3: Spawn the `impeccable:impeccable-finish-reviewer`.** Give it:
  - the screenshots;
  - the diorama mockup as the critique reference (`.impeccable/mocks/directions/diorama/site.png` and `welcome.png`);
  - the direction contract, from the HTML comment at the top of `site.html`;
  - DESIGN.md;
  - the craft-floor reference path.

  Apply its material fixes in one batch, recapture, and send the result back for a verdict. Two rounds at most.
- [ ] **Step 4: Spawn the `impeccable:impeccable-documenter`** to re-record DESIGN.md from the built world. It must cover:
  - the five service groups and the vendor rows;
  - compact cards;
  - the board size and camera (D-100);
  - the tablet tier at 1200 px;
  - the scene contract v2 and its accessible layer;
  - the token drift resolved.

  Remove the "open items carried from the mock" that are now fixed.
- [ ] **Step 5: Finish up.** Run `npm test`, `npm run typecheck`, `npm run build -w site` (the guard must pass within the D-104 budget), `npm run e2e -w site` and the full `npm audit`, which must report 0 high and 0 critical. Mark the done items in the follow-ups doc.
- [ ] **Step 6: Commit** with `docs: finish review fixes and DESIGN.md re-recorded for the Living Diorama`.
- [ ] **Step 7: STOP at the owner gates** (unchanged from Plan 2a). Do not deploy or make the repo public. Report the gates.

---

## Done when

- The diorama renders the engine's state on desktop, tablet and phone, under the unchanged CSP. Without WebGL it falls back to the schematic with a note.
- Both scenes pass one contract suite, and every 2a e2e test passes with the diorama active.
- The honesty plate is visible at every width and zoom. Every number is tagged. D-079 and the site agree.
- The finish reviewer's verdict is recorded, and DESIGN.md describes what is built.
- `npm test`, `npm run typecheck`, the build guard (≤ 450 KB gzipped JS), `npm run e2e -w site` and a full `npm audit` are all clean.
