# FailLocal Plan 1: Register, Engine and CLI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the substance layer of FailLocal: a validated YAML register of a fictional Pilbara iron ore site, a pure TypeScript engine that computes what stops, when and what it costs for each scenario on the unprepared and prepared site, and a CLI that validates, simulates and emits the continuity pack.

**Architecture:** An npm-workspaces monorepo. This plan creates the `engine` package only. The register is one YAML file; `zod` schemas plus semantic checks reject anything unlabelled, dangling or cyclic. `simulateScenario()` is a fixed-step (hourly), deterministic, pure function from (register, scenario, variant, overrides) to a `Timeline`. The site (Plan 2) and the lab write-back (Plan 3) both depend on the types defined here.

**Tech Stack:** Node ≥ 22, TypeScript 5 (strict), Vitest, zod 3, yaml 2, tsx (CLI runner).

**Spec:** `docs/superpowers/specs/2026-10-22-faillocal-design.md`

**Revision:** 25 Oct 2026. Revised after an independent review against the spec. Changes: integer-hour stock arithmetic, provenance for computed and overridden values, service-to-service dependencies, per-effect durations, id-keyed paths, buffer stocks in the model site, and further interface additions for Plans 2–3.

## Roadmap (why this is Plan 1 of 4)

The spec covers three subsystems with clean seams, so it is split into four plans. Each is written when the one before it lands, because each consumes the previous plan's interfaces.

| Plan | Delivers | Gate before starting |
|---|---|---|
| **1 (this)** | Register schema, model-site register, engine, CLI, Markdown continuity pack, decision log | none |
| 2 | Site for **release 2** (first playable): welcome page, guided run, S1 hero, unprepared/prepared toggle, revenue counter, side panels, assumptions editor, free-play cuts, mobile tiering, CSP, Cloudflare Pages deploy, repo goes public | The art direction is decided (The Living Diorama, 25 Oct 2026), and Plan 2 builds against `DESIGN.md`. The owner's domain name is still needed for deploy. |
| 3 | **Release 3**: Docker lab (PLC sim, HMI, mock ERP, vendor jump hosts, local identity/logging, Zeek + Suricata), Python harness, lab write-back of `measured` capabilities and observations, S3 detection evidence, "How this was tested" page, network overlay, assets tab, risk ranking with KEV | Plan 2 shipped |
| 4 | **Full launch**: S2/S4 polish on the site, continuity pack PDF, video, "How I built this", limitations, practitioner review changes | Plan 3 shipped |

Release 1 (the LinkedIn write-up on the Scope outage) is writing, not code, and is not planned here.

## Global Constraints

- Node ≥ 22, TypeScript `strict: true`, ES modules throughout. With `NodeNext` resolution, relative imports carry the `.js` extension (`import { q } from './fixtures.js'`).
- The repo already exists at `~/Documents/FailLocal`, with commits and a `.gitignore` (`node_modules/`, `dist/`, `.superpowers/`, `.DS_Store`). Do not re-initialise it.
- The site is a **fictional model mine**. The register's `site.fictional` must be the literal `true`.
- **Every input number in the register carries provenance** of exactly one kind: `sourced` (cites a `sources[].id`), `measured` (`runId`, ISO `date`, `evidence`) or `assumed` (`reasoning`). An unlabelled number is a validation error (spec §5.1). **Numbers the engine derives** (stock levels, state-change hours, outage lengths, tonnes, revenue) are displayed with a fourth label, `computed`. The engine exports `type DisplayKind = Provenance['kind'] | 'computed'`.
- **Capability and duration are separate fields** (spec §5.3). The `duration` of a `restore` effect, the `delay` of a `fallback` effect and the `restoreAfter` of a `cut-service` event may never be `measured`: "A mock ERP restoring in 40 seconds must never be presented as a real restore time." Only a `detect-and-revoke` effect's `duration` may be `measured`. Lab-scale results that are not comparable go in `capability.measurements` / `capability.observations`, which never feed the simulation.
- **Paths:** one id-keyed path format is used for override keys, `assumptionsUsed` keys and decision-log entries: `stocks.diesel.initial`, `production.price`, `processes.crushing.tier`, `processes.crushing.dependsOn.rom-pad`, `controls.independent-erp-restore.effects[0].duration`, `scenarios.s1-projection.events[0].restoreAfter`.
- The engine is pure and deterministic: no I/O, no clock, no randomness.
- Revenue is always called **"revenue at risk"**, and tonnes **"production deferred"**, never "lost" (spec §4.2).
- No real company is modelled. Real companies appear only as cited sources for scenario bases.
- Every domain judgement written into the register (tier, dependency, outage limit, assumed value) gets an entry in `docs/decisions.md` (spec §9, the owner is review-only).
- Licence: Apache-2.0.
- Every exported function and type is re-exported from `engine/src/index.ts` (Plan 2 imports only from there). Each task adds its exports there.

## Review Focus

1. **A cyclic process or service dependency** (A needs B, B needs A) must be rejected at load with the cycle spelled out, not hang or silently mis-order the simulation. → Task 2, `rejects a dependency cycle and names it` and `rejects a service requires cycle`.
2. **A reference to an id that does not exist** (in `dependsOn`, `requires`, a control effect or asset, a scenario event or a stock) must be rejected and name the missing id. → Task 2, `rejects dangling references and names them`.
3. **A lab number used as a real-world duration** (`measured` provenance on `restoreAfter`, a `restore` duration or a `fallback` delay) must be rejected with a message pointing to spec §5.3. → Task 2, `rejects measured provenance on real-world durations`.
4. **The same service cut twice with overlapping windows** must give one continuous outage until the latest restore, never "restored" mid-way by the first window ending. → Task 3, `overlapping cuts of one service merge into one outage`.
5. **A control whose capability is marked as not working** must have no effect, so the prepared site does not take credit for a failed test. → Task 5, `a control whose capability does not work is ignored`.

---

## File Structure

```
package.json                     # workspaces: ["engine"]; scripts proxy to engine
tsconfig.base.json
LICENSE                          # Apache-2.0
README.md                        # short: what this repo is, how to run the CLI
docs/decisions.md                # decision log (Task 7 fills it)
register/pilbara-model-site.yaml # the model site (Task 7)
engine/
  package.json                   # name "@faillocal/engine"
  tsconfig.json
  src/
    quantity.ts                  # Provenance, DisplayKind, Quantity, unit-locked quantity schemas, toHours()
    schema.ts                    # zod schema for the whole Register + inferred types
    validate.ts                  # semantic checks: refs, cycles, §5.3 rule; parseRegister, loadRegisterYaml, processOrder
    paths.ts                     # quantityPaths(), judgementPaths(), applyOverrides()
    simulate.ts                  # simulateScenario() + wrappers
    production.ts                # tonnesPerHour()
    tiers.ts                     # deriveAssetTiers()
    readiness.ts                 # assessReadiness()
    pack.ts                      # renderContinuityPack() -> Markdown
    cli.ts                       # faillocal validate | simulate | pack
    index.ts                     # public exports
  test/
    fixtures.ts                  # q(), minimalRegister() builders
    quantity.test.ts
    validate.test.ts
    simulate.services.test.ts
    simulate.stocks.test.ts
    simulate.controls.test.ts
    tiers-readiness.test.ts
    model-site.test.ts
    pack-cli.test.ts
```

---

### Task 1: Workspace and provenance-carrying quantities

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `LICENSE`, `README.md`, `engine/package.json`, `engine/tsconfig.json`, `engine/src/quantity.ts`, `engine/src/index.ts`
- Test: `engine/test/quantity.test.ts`

**Interfaces:**
- Produces (in `engine/src/quantity.ts`):
  ```ts
  export type Provenance =
    | { kind: 'sourced'; source: string; note?: string }            // source = sources[].id
    | { kind: 'measured'; runId: string; date: string; evidence: string } // date = ISO yyyy-mm-dd
    | { kind: 'assumed'; reasoning: string };
  export type DisplayKind = Provenance['kind'] | 'computed';
  export type Unit = 'hours' | 'days' | 'seconds' | 'count' | 'fraction' | 'Mt/a' | 'USD/t' | 'days/day';
  export interface Quantity<U extends Unit = Unit> { value: number; unit: U; provenance: Provenance }
  export const provenanceSchema: z.ZodType<Provenance>;
  export function quantity<U extends Unit>(unit: U, opts?: { allowMeasured?: boolean }): z.ZodType<Quantity<U>>;
  export function toHours(q: Quantity<'hours' | 'days'>): number;
  ```

- [ ] **Step 1: Scaffold the workspace** inside the existing repo. Root `package.json` (`"private": true`, `"type": "module"`, `"workspaces": ["engine"]`, `"engines": {"node": ">=22"}`, scripts `test`, `typecheck`, `cli` delegating to the engine). `engine/package.json` with deps `zod@^3`, `yaml@^2`; devDeps `typescript@^5`, `vitest`, `tsx`, `@types/node`. `tsconfig.base.json`: `strict`, `module`/`moduleResolution` `NodeNext`, `target` `ES2022`, `noUncheckedIndexedAccess: true`. Apache-2.0 `LICENSE`. A five-line `README.md`. Run `npm install`.

- [ ] **Step 2: Write the failing tests** in `engine/test/quantity.test.ts`:
  ```ts
  test('accepts each provenance kind', () => {
    const s = quantity('days');
    expect(s.parse({ value: 4, unit: 'days', provenance: { kind: 'assumed', reasoning: 'r' } }).value).toBe(4);
    expect(s.parse({ value: 4, unit: 'days', provenance: { kind: 'sourced', source: 'scope-updates' } })).toBeTruthy();
  });
  test('rejects a number with no provenance', () => {
    expect(() => quantity('days').parse({ value: 4, unit: 'days' })).toThrow();
  });
  test('rejects the wrong unit for a field', () => {
    expect(() => quantity('days').parse({ value: 4, unit: 'hours', provenance: { kind: 'assumed', reasoning: 'r' } })).toThrow();
  });
  test('measured needs runId, ISO date and evidence', () => {
    const s = quantity('seconds', { allowMeasured: true });
    expect(() => s.parse({ value: 9, unit: 'seconds', provenance: { kind: 'measured', runId: 'r1', date: '14 Dec', evidence: 'x' } })).toThrow();
    expect(s.parse({ value: 9, unit: 'seconds', provenance: { kind: 'measured', runId: 'r1', date: '2026-12-14', evidence: 'lab/runs/r1' } }).value).toBe(9);
  });
  test('measured is rejected unless the field allows it', () => {
    expect(() => quantity('hours').parse({ value: 1, unit: 'hours', provenance: { kind: 'measured', runId: 'r1', date: '2026-12-14', evidence: 'x' } }))
      .toThrow(/§5\.3/);
  });
  test('toHours converts days', () => {
    expect(toHours({ value: 1.5, unit: 'days', provenance: { kind: 'assumed', reasoning: 'r' } })).toBe(36);
  });
  ```
  Note the default: `quantity()` **disallows** `measured` unless `allowMeasured: true`. Fields that may hold lab measurements opt in explicitly.

- [ ] **Step 3: Run** `npm test -w engine`. Expected: FAIL, module `../src/quantity.js` not found.

- [ ] **Step 4: Implement `engine/src/quantity.ts`.** A zod discriminated union on `kind`, all strings non-empty, `date` matching `/^\d{4}-\d{2}-\d{2}$/`. The `measured`-disallowed error message must contain `§5.3` and the text `lab measurements are not real-world durations`. Re-export from `index.ts`.

- [ ] **Step 5: Run** `npm test -w engine` and `npm run typecheck`. Expected: PASS, no type errors.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(engine): workspace and provenance-carrying quantities"`

---

### Task 2: Register schema, validation and paths

**Files:**
- Create: `engine/src/schema.ts`, `engine/src/validate.ts`, `engine/src/paths.ts`, `engine/test/fixtures.ts`
- Test: `engine/test/validate.test.ts`

**Interfaces:**
- Consumes: `quantity()`, `provenanceSchema` (Task 1).
- Produces: the register types every later task and plan uses (in `schema.ts`, inferred from zod):
  ```ts
  type Tier = 'high' | 'medium' | 'low';
  type ProcessKind = 'back-office' | 'physical';
  interface Source { id: string; title: string; url: string; accessed: string /* yyyy-mm-dd */ }
  interface Dependency {
    on: string;                                  // id of a service | asset | process | stock
    onLoss: 'stop' | 'degrade';
    manualWorkaround?: { description: string; holdsFor: Quantity<'days'> };   // service dependencies only
  }
  interface Process {
    id: string; name: string; area: string; kind: ProcessKind; tier: Tier;
    safetyFunction: string; productionConsequence: string;
    dependsOn: Dependency[];
    status: { degraded: string; stopped: string };  // plain-English UI copy
    continuity: {
      maxTolerableOutage: Quantity<'hours'>; recoveryTarget: Quantity<'hours'>;
      owner: string; independentCopy: boolean;
      lastRestoreTest?: { date: string; result: 'pass' | 'fail'; provenance: Provenance };
    };
  }
  interface Asset {
    id: string; name: string; type: 'plc' | 'hmi' | 'historian' | 'server' | 'network' | 'workstation';
    zone: string; area?: string;
  }
  interface Service {
    id: string; name: string; provider: string; hosting: string;
    kind: 'enterprise-app' | 'identity' | 'remote-ops' | 'vendor-access' | 'network-link';
    requires?: string[];                         // service ids; down if any required service is down
  }
  interface Stock {
    id: string; name: string;
    capacity: Quantity<'days'>; initial: Quantity<'days'>; lowThreshold: Quantity<'days'>;
    refillRate: Quantity<'days/day'>;
    replenishedBy: string;                       // process id
    consumedBy: string[];                        // process ids, min 1
  }
  type ControlEffect =
    | { kind: 'fallback'; process: string; service: string; delay?: Quantity<'hours'> }   // never measured
    | { kind: 'restore'; service: string; duration: Quantity<'hours'> }                  // never measured
    | { kind: 'detect-and-revoke'; service: string; duration: Quantity<'hours'> };       // measured allowed
  interface Control {
    id: string; name: string; description: string;
    effects: ControlEffect[];                    // min 1; each effect carries its own duration
    assets?: string[];                           // assets the control relies on (e.g. site-identity)
    capability: {
      works: boolean; provenance: Provenance;
      measurements: { name: string; quantity: Quantity }[];                        // may be measured
      observations?: { name: string; value: string; provenance: Provenance }[];    // e.g. "historian stayed up"
    };
  }
  type ScenarioEvent =
    | { kind: 'cut-service'; service: string; at: Quantity<'hours'>; restoreAfter: Quantity<'hours'> }  // never measured
    | { kind: 'compromise'; via: string /* service */; target: string /* asset */; at: Quantity<'hours'>; downFor: Quantity<'hours'> };
  interface Scenario {
    id: string; title: string; summary: string; basis: string[];   // source ids
    projection: boolean;            // true => UI must label the run as a projection
    workaroundsHold: boolean;       // true => manualWorkaround degrades indefinitely ("as reported")
    horizon: Quantity<'days'>; events: ScenarioEvent[];
  }
  interface Production {
    annualTonnes: Quantity<'Mt/a'>; price: Quantity<'USD/t'>;
    shippingProcess: string;        // process id whose state defers tonnes
    degradedOutput: Quantity<'fraction'>;
  }
  interface Register {
    schemaVersion: 1;
    site: { id: string; name: string; fictional: true; description: string };
    sources: Source[]; processes: Process[]; assets: Asset[]; services: Service[];
    stocks: Stock[]; controls: Control[]; scenarios: Scenario[]; production: Production;
  }
  ```
- Produces (in `validate.ts`):
  ```ts
  export class RegisterError extends Error { constructor(public issues: string[]) }
  export function parseRegister(input: unknown): Register;      // zod + semantic checks; throws RegisterError
  export function loadRegisterYaml(text: string): Register;     // yaml.parse then parseRegister
  export function processOrder(r: Register): string[];          // process ids, dependencies first
  export function checkScenario(r: Register, s: Scenario): void; // refs + §5.3 for an ad-hoc scenario; throws RegisterError
  ```
- Produces (in `paths.ts`):
  ```ts
  export function quantityPaths(r: Register): { path: string; quantity: Quantity }[];  // every Quantity in the register, id-keyed paths
  export function judgementPaths(r: Register): string[];  // every processes.<id>.tier and processes.<id>.dependsOn.<on>
  export function applyOverrides(r: Register, overrides: Record<string, number>): Register;
  // returns a copy with each path's value replaced; unknown path -> RegisterError naming it; result re-validated
  ```
- Produces (in `test/fixtures.ts`, used by all later engine tests):
  ```ts
  export function q<U extends Unit>(value: number, unit: U): Quantity<U>;  // assumed provenance, reasoning 'test'
  export function minimalRegister(): Register;
  ```
  `minimalRegister()` is a valid site with: one source `test-src`; one service `erp`; one asset `plc`; processes (all with `area: 'test'`, `safetyFunction: 'none'`, `productionConsequence: 'test'`, `status: { degraded: 'degraded', stopped: 'stopped' }`, continuity MTO 48 h, recoveryTarget 24 h, owner `'test'`, `independentCopy: false`):
  - `ordering`: back-office, tier `low`, depends on `erp` (`stop`)
  - `haulage`: physical, tier `medium`, depends on stock `diesel` (`stop`)
  - `crushing`: physical, tier `medium`, depends on process `haulage` and asset `plc`, both `stop`
  - `rail`: physical, tier `low`, depends on stock `ore` (`stop`)

  Stocks:
  - `diesel`: capacity 4 d, initial 4, lowThreshold 1, refillRate 2 d/d, replenishedBy `ordering`, consumedBy `[haulage]`
  - `ore`: capacity 3, initial 3, lowThreshold 0.5, refillRate 2, replenishedBy `crushing`, consumedBy `[rail]`

  Production is 10 Mt/a at 100 USD/t, shippingProcess `rail`, degradedOutput **0.6**. There are no controls. Scenario `cut-erp` cuts `erp` at 0 h for 288 h, with horizon 20 d, workaroundsHold false and projection false.

- [ ] **Step 1: Write the fixtures and the failing tests** in `engine/test/validate.test.ts`:
  ```ts
  test('minimal register is valid', () => { expect(() => parseRegister(minimalRegister())).not.toThrow(); });
  test('site must be marked fictional', () => {
    const r: any = minimalRegister(); r.site.fictional = false;
    expect(() => parseRegister(r)).toThrow(RegisterError);
  });
  test('rejects dangling references and names them', () => {
    // one case each, every id named in the error:
    // dependsOn 'ghost1'; service requires 'ghost2'; control effect service 'ghost3'; control assets 'ghost4';
    // scenario event service 'ghost5'; compromise target 'ghost6'; stock replenishedBy 'ghost7'
    const r: any = minimalRegister(); r.processes[0].dependsOn.push({ on: 'ghost1', onLoss: 'stop' });
    expect(() => parseRegister(r)).toThrow(/ghost1/);
    /* … same pattern for ghost2–ghost7 … */
  });
  test('collects every issue, not just the first', () => { /* ghost1 and ghost5 together -> RegisterError.issues.length >= 2 */ });
  test('rejects a dependency cycle and names it', () => {
    const r: any = minimalRegister();
    r.processes.find((p: any) => p.id === 'haulage').dependsOn.push({ on: 'crushing', onLoss: 'stop' });
    expect(() => parseRegister(r)).toThrow(/haulage.*crushing|crushing.*haulage/);
  });
  test('rejects a service requires cycle', () => { /* services a requires b, b requires a -> throws /a.*b|b.*a/ */ });
  test('allows a cycle that goes through a stock', () => {
    // ordering depends on stock 'ore' (degrade): stock-mediated loops are allowed (they act with a one-step lag)
  });
  test('rejects measured provenance on real-world durations', () => {
    const r: any = minimalRegister();
    r.scenarios[0].events[0].restoreAfter.provenance = { kind: 'measured', runId: 'r', date: '2026-12-14', evidence: 'x' };
    expect(() => parseRegister(r)).toThrow(/§5\.3/);
    // also: a restore effect duration measured -> /§5\.3/; a fallback delay measured -> /§5\.3/
  });
  test('allows measured duration on detect-and-revoke', () => { /* detect-and-revoke duration measured -> ok */ });
  test('sourced provenance must cite a listed source', () => { /* source 'nope' -> throws /nope/ */ });
  test('stock must have at least one consumer', () => { /* consumedBy [] -> throws */ });
  test('stock initial must not exceed capacity', () => { /* initial 5, capacity 4 -> throws /diesel/ */ });
  test('duplicate ids across processes, assets, services and stocks are rejected', () => { /* id 'plc' used twice -> throws /plc/ */ });
  test('processOrder puts dependencies first', () => {
    const order = processOrder(parseRegister(minimalRegister()));
    expect(order.indexOf('haulage')).toBeLessThan(order.indexOf('crushing'));
  });
  test('quantityPaths uses id-keyed paths', () => {
    const paths = quantityPaths(parseRegister(minimalRegister())).map(p => p.path);
    expect(paths).toContain('stocks.diesel.initial');
    expect(paths).toContain('production.price');
    expect(paths).toContain('scenarios.cut-erp.events[0].restoreAfter');
  });
  test('judgementPaths lists every tier and dependency', () => {
    const j = judgementPaths(parseRegister(minimalRegister()));
    expect(j).toContain('processes.crushing.tier');
    expect(j).toContain('processes.crushing.dependsOn.plc');
  });
  test('applyOverrides replaces a value and rejects unknown paths', () => {
    const r = applyOverrides(parseRegister(minimalRegister()), { 'production.price': 80 });
    expect(r.production.price.value).toBe(80);
    expect(() => applyOverrides(r, { 'stocks.nope.initial': 1 })).toThrow(/nope/);
  });
  ```
  Write the commented bodies as described.

- [ ] **Step 2: Run** `npm test -w engine`. Expected: FAIL, `parseRegister` not defined.

- [ ] **Step 3: Implement `schema.ts`.** zod objects mirroring the types above. Use `quantity(unit)` for every numeric field. `capability.measurements[].quantity` and the `detect-and-revoke` `duration` use `allowMeasured: true`; every other quantity uses the default (measured rejected, message containing `§5.3`). `site.fictional: z.literal(true)`.

- [ ] **Step 4: Implement `validate.ts`.** After zod, collect **all** issues before throwing (not just the first):
  - one id namespace across processes, assets, services and stocks
  - every reference resolves to the right kind (`replenishedBy` and `consumedBy` are processes; `requires` and `effect.service` are services; `effect.process` and `control.assets` are processes and assets respectively; `compromise.via` is a service and `compromise.target` an asset)
  - every `sourced` provenance cites a `sources[].id`
  - `initial ≤ capacity` for every stock
  - `processOrder` is a topological sort over process→process dependencies only. Stock-mediated loops are allowed, because processes read the previous step's stock levels. A cycle produces an issue of the form `dependency cycle: haulage -> crushing -> haulage`.
  - `requires` cycles among services are rejected the same way.
  - `checkScenario` runs the scenario-level checks (references, §5.3) for a scenario that is not in the register.

- [ ] **Step 5: Implement `paths.ts`.** Paths follow the Global Constraints format: list entries keyed by `id`, effects and events by index. `applyOverrides` clones the register, replaces only `value` (provenance is untouched; `simulateScenario` marks the input as overridden) and re-runs `parseRegister`, so an override that breaks `initial ≤ capacity` is rejected.

- [ ] **Step 6: Run** `npm test -w engine`. Expected: PASS.

- [ ] **Step 7: Commit** `git add -A && git commit -m "feat(engine): register schema, validation and paths"`

---

### Task 3: Simulation core: services, assets and process propagation

**Files:**
- Create: `engine/src/simulate.ts`
- Test: `engine/test/simulate.services.test.ts`

**Interfaces:**
- Consumes: `Register`, `Scenario`, `processOrder`, `checkScenario`, `applyOverrides`, `quantityPaths`, `toHours` (Tasks 1–2).
- Produces (in `simulate.ts`; later tasks extend the same functions, not new ones):
  ```ts
  export type Variant = 'unprepared' | 'prepared';
  export type ProcessState = 'normal' | 'degraded' | 'stopped';
  export interface Sample {
    hour: number;
    processes: Record<string, ProcessState>;
    services: Record<string, 'up' | 'down' | 'revoked'>;
    assets: Record<string, 'up' | 'down'>;
    stocks: Record<string, number>;     // days remaining at the START of this hour
    tonnesDeferred: number;             // cumulative to the end of this hour
    revenueAtRisk: number;              // cumulative USD to the end of this hour
  }
  export type TimelineEventKind =
    | 'service-down' | 'service-up' | 'access-revoked' | 'asset-down' | 'asset-up'
    | 'compromise-started' | 'compromise-detected' | 'process-state' | 'stock-low' | 'stock-empty';
  export interface TimelineEvent { hour: number; kind: TimelineEventKind; subject: string; from?: string; to?: string }
  export interface UsedInput { value: number; unit: Unit; provenance: Provenance; overridden: boolean }
  export interface Timeline {
    scenarioId: string; variant: Variant; projection: boolean; stepHours: 1;
    samples: Sample[]; events: TimelineEvent[];
    totals: { tonnesDeferred: number; revenueAtRisk: number; nonNormalHours: Record<string, number>; stoppedHours: Record<string, number> };
    assumptionsUsed: Record<string, UsedInput>;   // every input quantity the run used, keyed by path
  }
  export function simulateScenario(r: Register, scenario: Scenario, variant: Variant, overrides?: Record<string, number>): Timeline;
  export function simulate(r: Register, scenarioId: string, variant: Variant): Timeline;                // wrapper
  export function simulateWith(r: Register, scenarioId: string, variant: Variant, overrides: Record<string, number>): Timeline; // wrapper
  ```
  `simulateScenario` accepts scenarios not in the register (Plan 2 free play: any combination of cuts). It calls `checkScenario` first.

The model (state this in a short doc comment at the top of `simulate.ts`, because the owner must be able to explain it):
- Fixed 1-hour steps. Samples are taken for `hour = 0 … horizonHours` inclusive.
- **Fractional times:** an event at fractional time *t* takes effect from the first sample with `hour ≥ t`; `TimelineEvent.hour` records *t* itself.
- **Services:** all `cut-service` windows `[at, at + restoreAfter)` for one service are **merged first** into contiguous outages. A service is `down` while an outage covers the hour, or while any service in its `requires` is down or revoked. Emit exactly one `service-down` / `service-up` per merged outage.
- **Assets:** a `compromise` event emits `compromise-started { subject: target, from: via }` at `at`, and in this task downs `target` for `[at, at + downFor)` (Task 5 adds the prepared-site response).
- **Processes**, each step, in `processOrder`. A process's state is the **worst** over its dependencies. A lost dependency yields `stopped` if `onLoss: 'stop'`, else `degraded`. A dependency is lost when:
  - a service is `down` or `revoked`
  - an asset is `down`
  - an upstream process is `stopped` (an upstream `degraded` makes this one at most `degraded`)
  - a stock is at 0. At or below `lowThreshold`, a stock yields `degraded` regardless of `onLoss`.
- **`manualWorkaround`** on a service dependency: while the service is down, the dependency yields `degraded`. It does so for ever if `scenario.workaroundsHold`. Otherwise it lasts for `holdsFor` measured from the start of that outage, then gives the normal `onLoss` result.
- Emit `process-state` events only on change, with `from`/`to`.
- **assumptionsUsed:** one entry per path from `quantityPaths` that the run read. `overridden: true` for paths in `overrides`, with the original provenance retained, so the UI can show "changed by you (was: sourced …)".

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('cutting a service stops the process that needs it, then restores it', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[1].processes.ordering).toBe('stopped');
    expect(t.samples[288].processes.ordering).toBe('normal');
    expect(t.events).toContainEqual(expect.objectContaining({ hour: 0, kind: 'service-down', subject: 'erp' }));
  });
  test('onLoss degrade yields degraded, not stopped', () => { /* set ordering dep onLoss 'degrade' -> 'degraded' at hour 1 */ });
  test('a lost asset stops the process that needs it', () => { /* compromise downs 'plc' at 0 for 5 h -> crushing stopped hours 0..4, normal at 5; compromise-started at 0 */ });
  test('a stopped upstream process stops a dependent one', () => {
    // add haulage dependsOn erp (stop): crushing stopped at hour 1
    // with haulage->erp onLoss 'degrade' instead: haulage degraded and crushing degraded at hour 1
  });
  test('overlapping cuts of one service merge into one outage', () => {
    // two windows [0,10) and [5,20) on erp -> ordering stopped at hours 9, 10 and 19; normal at 20
    // exactly one 'service-down' for erp (hour 0) and exactly one 'service-up' (hour 20)
  });
  test('a service is down while a service it requires is down', () => {
    // add service 'net'; erp requires ['net']; scenario cuts only 'net' 0..10 h -> erp 'down' at hour 5, ordering stopped; erp 'up' at 10
  });
  test('manual workaround degrades for holdsFor, then stops, unless workarounds hold', () => {
    // ordering dep on erp with manualWorkaround holdsFor 2 days:
    // workaroundsHold false -> degraded at hour 47, stopped at hour 48
    // workaroundsHold true  -> degraded at hour 200
  });
  test('simulateScenario runs an ad-hoc scenario and rejects bad ids', () => {
    // a scenario not in the register cutting erp 0..24 h -> ordering stopped at 1; cutting 'ghost' -> RegisterError /ghost/
  });
  test('simulate is deterministic', () => { /* two runs deep-equal */ });
  test('unknown scenario id throws', () => { /* /no-such/ */ });
  ```
  Stocks are ignored until Task 4. In this task, treat every stock as full.

- [ ] **Step 2: Run** `npm test -w engine -- simulate.services`. Expected: FAIL.
- [ ] **Step 3: Implement** `simulateScenario` and its wrappers per the model above. Leave `tonnesDeferred`/`revenueAtRisk` at 0 and `stocks` at `initial` (Task 4 fills them).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(engine): hourly simulation of services and process propagation"` (add new files first).

---

### Task 4: Stocks and production deferred

**Files:**
- Create: `engine/src/production.ts`
- Modify: `engine/src/simulate.ts`
- Test: `engine/test/simulate.stocks.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `Sample`, `UsedInput` (Task 3).
- Produces: `export function tonnesPerHour(p: Production): number` (= `annualTonnes × 1e6 / 8760`) in `production.ts`; populated `stocks`, `tonnesDeferred`, `revenueAtRisk`, `totals` and `assumptionsUsed` entries for production and stock inputs.

**Stock arithmetic (exact; avoids floating-point drift):** stock levels are kept internally as **integer hours of normal consumption**. Day values are converted once at start (`days × 24`), and `refillRate` becomes `refillRate × 1` hours gained per hour. `Sample.stocks` reports `levelHours / 24`, recorded at the **start** of the hour (the level that hour's process evaluation saw). Each step:
1. Evaluate processes against the start-of-hour stock levels.
2. Update stocks: if `replenishedBy` is `normal` or `degraded`, level += `refillRate`, capped at capacity. Otherwise, if any consumer is not `stopped`, level -= 1, floored at 0.
3. Emit `stock-low` when the level first reaches or crosses `lowThreshold`, and `stock-empty` when it reaches 0 (once per crossing, `hour` = the hour whose start sees the new level).

**Production, per step:** deferred += `tonnesPerHour × (shipping stopped ? 1 : shipping degraded ? (1 − degradedOutput) : 0)`; revenueAtRisk = deferred × price. `nonNormalHours`/`stoppedHours` count steps per process.

- [ ] **Step 1: Write the failing tests** (with `minimalRegister`, `cut-erp` for 288 h). The chain these hours follow: diesel 96 h → low at 72, empty at 96; crushing stops at 96; ore 72 h → low at 156, empty at 168; ERP back at 288; diesel refills at 2 h/h, so haulage is normal again from 301.
  ```ts
  test('diesel runs down once ordering stops, and haulage degrades then stops', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[24].stocks.diesel).toBe(3);
    expect(t.samples[71].processes.haulage).toBe('normal');
    expect(t.samples[72].processes.haulage).toBe('degraded');
    expect(t.samples[96].processes.haulage).toBe('stopped');
    expect(t.samples[96].processes.crushing).toBe('stopped');
  });
  test('the stockpile buffers rail after crushing stops', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[155].processes.rail).toBe('normal');
    expect(t.samples[156].processes.rail).toBe('degraded');
    expect(t.samples[168].processes.rail).toBe('stopped');
  });
  test('production is deferred only while rail is not normal', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[155].tonnesDeferred).toBe(0);
    const perHour = 10e6 / 8760;
    const { stoppedHours: s, nonNormalHours: n } = t.totals;
    expect(t.totals.tonnesDeferred).toBeCloseTo(perHour * (s.rail + (1 - 0.6) * (n.rail - s.rail)), 3);
    expect(t.totals.revenueAtRisk).toBeCloseTo(t.totals.tonnesDeferred * 100, 3);
  });
  test('stocks refill after the service returns', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[300].processes.haulage).not.toBe('normal');
    expect(t.samples[301].processes.haulage).toBe('normal');
  });
  test('assumptionsUsed lists every input with its provenance', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.assumptionsUsed['production.price']).toMatchObject({ value: 100, unit: 'USD/t', overridden: false });
    expect(t.assumptionsUsed['stocks.diesel.initial']).toBeDefined();
    expect(t.assumptionsUsed['production.degradedOutput']).toBeDefined();
  });
  test('simulateWith overrides stock and marks it overridden', () => {
    const r = parseRegister(minimalRegister());
    const t = simulateWith(r, 'cut-erp', 'unprepared', { 'stocks.diesel.capacity': 20, 'stocks.diesel.initial': 20 });
    expect(t.samples[200].processes.haulage).toBe('normal');
    expect(t.assumptionsUsed['stocks.diesel.initial'].overridden).toBe(true);
    expect(t.assumptionsUsed['stocks.diesel.initial'].provenance).toEqual(r.stocks[0].initial.provenance);
  });
  test('an override above capacity is rejected', () => { /* { 'stocks.diesel.initial': 20 } alone -> RegisterError /diesel/ */ });
  test('an unknown override key throws', () => { /* 'stocks.nope.initial' -> throws /nope/ */ });
  ```
  A non-integer `refillRate` or threshold can land between hours; only such tests may assert a ±1 h window.

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the stock and production rules exactly as stated, and add the "integer hours, start-of-hour sample" convention to the `simulate.ts` doc comment.
- [ ] **Step 4: Run** all engine tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(engine): stocks, production deferred and revenue at risk"` (add new files first).

---

### Task 5: Controls and the prepared site

**Files:**
- Modify: `engine/src/simulate.ts`
- Test: `engine/test/simulate.controls.test.ts`

**Interfaces:**
- Consumes: `Control`, `ControlEffect`, `ScenarioEvent` (Task 2); `simulateScenario` (Tasks 3–4).
- Produces: no new exports. `variant: 'prepared'` now applies every control whose `capability.works` is `true` and none of whose `assets` is `down` in that hour. `'unprepared'` applies none. Each applied effect's duration appears in `assumptionsUsed`.

**Decision recorded here (spec §8 left it to the builder):** "prepared" is **one register plus its `controls` list**. There is no second register file. The unprepared site is the same register with controls ignored.

Control semantics (prepared only; a control applies each entry in its `effects` list):
- `fallback {process, service, delay?}`: while `service` is down, that dependency of `process` gives its normal `onLoss` result for the first `delay` hours of the outage (default 0), and `degraded` after that. This is the takeover time, e.g. a handover to site authority.
- `restore {service, duration}`: windows are merged first (Task 3), then each merged outage `[start, end)` is shortened to `[start, min(end, start + duration))`.
- `detect-and-revoke {service, duration}`: for a `compromise` via `service`, emit `compromise-detected` and `access-revoked` at `at + duration`. From then to the horizon `service` is `revoked`, and the target asset is **not** downed. This assumes detection and revocation happen before the write takes effect, or that the write is reverted; record that in the decision log (Task 7). Unprepared: the target asset is `down` for `downFor`, and nothing is revoked.
- `capability.measurements` and `capability.observations` never feed the simulation. Only effect durations do.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('a fallback keeps a process degraded instead of stopped', () => { /* fallback ordering/erp -> ordering degraded at hour 1, diesel never empties */ });
  test('a fallback with a delay stops the process until the takeover', () => { /* delay 3 h -> ordering stopped at hours 0..2, degraded at 3 */ });
  test('an independent restore shortens the outage', () => { /* restore erp duration 6 h -> erp up at hour 6 prepared; still down at 6 unprepared */ });
  test('restore shortens the merged outage from its start', () => { /* windows [0,10) and [5,20) + restore 6 h -> erp up at hour 6 */ });
  test('detect-and-revoke protects the asset and revokes only that vendor', () => {
    // services vendor-a, vendor-b; compromise via vendor-a on plc at 2 h, downFor 8 h; effect duration 0.25 h
    // prepared: compromise-started at 2; compromise-detected and access-revoked with hour 2.25;
    //   plc never down; crushing never stopped; vendor-a 'revoked' from sample 3; vendor-b 'up' throughout
    // unprepared: compromise-started at 2; plc down hours 2..9; crushing stopped those hours; no revocation
  });
  test('a control whose capability does not work is ignored', () => { /* works:false restore -> outage unchanged */ });
  test('a control does not apply while an asset it relies on is down', () => {
    // ad-hoc scenario: cut erp 0..24 h AND compromise downs plc 0..5 h; fallback ordering/erp with assets ['plc']
    // prepared -> ordering stopped hours 0..4, degraded from 5
  });
  test('lab measurements on a capability do not change durations', () => {
    // restore duration 6 h assumed; measurement {name:'restore', quantity: 40 seconds measured}
    // -> erp still down at hour 5, up at hour 6
  });
  ```
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the control semantics.
- [ ] **Step 4: Run** all engine tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(engine): resilience controls and prepared variant"`

---

### Task 6: Asset tiers and readiness

**Files:**
- Create: `engine/src/tiers.ts`, `engine/src/readiness.ts`
- Test: `engine/test/tiers-readiness.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function deriveAssetTiers(r: Register): Record<string, Tier>;
  export interface ReadinessRow {
    processId: string; scenarioId: string; variant: Variant;
    longestOutageHours: number;          // longest contiguous non-normal run (computed)
    maxTolerableOutageHours: number;
    recoveryTargetHours: number;
    withinTolerance: boolean;            // longestOutageHours <= maxTolerableOutageHours
    withinRecoveryTarget: boolean;       // longestOutageHours <= recoveryTargetHours
  }
  export function assessReadiness(r: Register): ReadinessRow[];  // every process × every scenario × both variants
  ```

**Tier rule [my call]:** a process's *effective* tier is the highest of its own tier and the effective tier of every process that depends on it. "Depends on" includes, transitively, depending on a stock that it replenishes, because a buffer changes how soon an outage bites but not whether it does. An asset's tier is the highest effective tier of any process that depends on it directly, or that is protected by a control listing the asset in `assets` (the tier of the protected `fallback` process or of the processes depending on the protected service). An asset nothing depends on gets `low`.

Risk ranking (tier × exposure × availability + KEV) is **deferred to Plan 3**, where the lab supplies the asset inventory and a KEV dataset choice is made.

- [ ] **Step 1: Write the failing tests:**
  - `tiers propagate through processes and stocks`: `plc` is `medium` (from crushing). Raise `rail` to `high` and `plc` becomes `high`, via ore stock → crushing → plc.
  - `an asset used only by a low-tier chain stays low`: add process `reporting` (tier `low`, nothing depends on it) depending on new asset `printer` → `printer` is `low`. An asset nothing depends on (add `spare`) is also `low`.
  - `a control's relied-on asset takes the protected process's tier`: add asset `site-id` and control fallback `ordering`/`erp` with `assets: ['site-id']`. Ordering's effective tier is `medium` (it replenishes diesel for haulage), so `site-id` is `medium`.
  - `readiness flags a process over its tolerance`: `ordering` under `cut-erp` unprepared → `longestOutageHours: 288`, `withinTolerance: false` (MTO 48), `withinRecoveryTarget: false`.
  - `readiness counts degraded as outage`: a fallback in prepared → longest outage 288, still flagged.
  - `readiness rows cover every process, scenario and variant`: length = processes × scenarios × 2.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** both functions. `assessReadiness` calls `simulate`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(engine): derived asset tiers and outage readiness"`

---

### Task 7: The model site register and decision log

**Files:**
- Create: `register/pilbara-model-site.yaml`, `docs/decisions.md`
- Test: `engine/test/model-site.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the canonical register that Plan 2's site loads. The ids below are fixed, because the site and Plan 3's lab refer to them.

**Honesty order of work (spec §5.1). Do not reverse it.**
1. Choose and justify every stock size, workaround duration, outage limit and dependency **first**, in `docs/decisions.md`, sourced where a source exists.
2. Only then write the behavioural tests and run them.
3. If an honest configuration does not park the fleet within Scope's ~12 days in `s1-projection`, do **not** shrink stocks or workarounds to make it pass. The permitted lever is `s1-projection`'s own `restoreAfter`, labelled `assumed`, with the summary saying "what if restore took longer and the workarounds ran out".
4. Never change a `sourced` value to pass a test. If no honest configuration passes, stop and report to the owner.

Content to model (ids fixed; values chosen and justified by the implementer):

**Site:** id `pilbara-model-site`, name "Model Pilbara iron ore site (fictional)", `fictional: true`. The description states the haul fleet is **autonomous (AHS), supervised from a Perth remote operations centre**. That is a stated model assumption, logged in the decision log, not a claim about any company.

**Services:**
- `corporate-network`
- `hosted-erp`, `cloud-identity` and `iroc-link`, each with `requires: [corporate-network]`
- `vendor-a-access` and `vendor-b-access`, which reach the site via the DMZ jump host, **not** the corporate network, so S3 and S4 stay independent

**Assets (minimum):** `crusher-plc`, `conveyor-plc`, `control-room-hmi`, `site-historian`, `site-identity`, `offline-wo-app`, `vendor-jump-host`, each with `zone` and `area`.

**Processes:**
- `diesel-ordering`, `explosives-ordering`, `work-orders`, `payroll`: back-office. They depend on `hosted-erp`, with a `manualWorkaround` where the public record shows one (e.g. purchase orders by email).
- `remote-operations`: depends on `iroc-link`.
- `control-room`: two dependencies, `control-room-hmi` (stop) and `cloud-identity` (stop, with `manualWorkaround` of about 0.5 d, "current shift stays logged in").
- `drill-and-blast`: depends on the explosives stock.
- `haulage`: depends on the diesel stock, the `broken-ore` stock and `remote-operations` (stop; AHS assumption).
- `crushing`: depends on the `rom-pad` stock, `crusher-plc`, `conveyor-plc` and `control-room`.
- `rail`: depends on the `ore-stockpile` stock, and on `remote-operations` with `degrade`, because Pilbara rail is controlled from Perth with local fallback.

Every process gets `status` copy in mining language, with no security jargon (spec §2).

**Stocks:**
- `diesel` (replenished by `diesel-ordering`, consumed by `haulage`)
- `explosives` (by `explosives-ordering`, consumed by `drill-and-blast`)
- `broken-ore` (by `drill-and-blast`, consumed by `haulage`)
- `rom-pad` (by `haulage`, consumed by `crushing`; hours to about a day)
- `ore-stockpile` (by `crushing`, consumed by `rail`)

**Controls (prepared site):**
- `offline-ordering`: two fallback effects, `diesel-ordering`/`hosted-erp` and `explosives-ordering`/`hosted-erp`
- `offline-work-orders`: fallback `work-orders`/`hosted-erp`, assets `[offline-wo-app]`
- `payroll-continuity`: fallback `payroll`/`hosted-erp` (the last pay run is reused)
- `independent-erp-restore`: restore `hosted-erp`
- `site-authority`: fallbacks `remote-operations`/`iroc-link`, with a handover `delay`
- `local-identity`: fallback `control-room`/`cloud-identity`, assets `[site-identity]`
- `vendor-monitoring`: detect-and-revoke effects on **both** `vendor-a-access` and `vendor-b-access`, assets `[vendor-jump-host]`

Capabilities stay `assumed` until Plan 3 measures them.

**Scenarios:**
- `s1-as-reported`: cut `hosted-erp`. `restoreAfter` is **sourced** from the Scope Systems incident updates: about 12 days, from 5 May to the 100% restore on 17 May 2026. `workaroundsHold: true`, `projection: false`. The summary notes that Scope restored customers in stages (20 / 53 / 80 / 100%), and that the model site is placed in the last cohort.
- `s1-projection`: the same cut, `workaroundsHold: false`, `projection: true`. The summary says plainly that this is a "what if the workarounds ran out" projection.
- `s2-iroc-lost`
- `s3-vendor-setpoint`: compromise via `vendor-a-access` on `crusher-plc`.
- `s4-precautionary-isolation`: cut `corporate-network`. The duration basis is Copper Mountain, Dec 2022, about five days.

**Sources:** at minimum the Scope Systems updates, the MM-ISAC reference architecture, the MINING.COM op-ed, the Copper Mountain reporting, the Claroty mining survey and Waterfall 2025. Take URLs from the "Key sources" list in `~/Documents/Hyperresearch/project-ideas/01-mine-site-resilience-map.md`, and from the research report for Copper Mountain and Northern Star. Set `accessed` to the date you verify each URL.

**Production:**
- `annualTonnes` is `assumed`, with reasoning (a mid-size Pilbara mine).
- `price` is `sourced` from a dated public iron ore price series (cite the series and the month). If no source can be verified, make it `assumed` and state the reasoning. Do **not** invent a figure and label it sourced.

- [ ] **Step 1: Write `docs/decisions.md` first.** Open it with a short paragraph saying the owner reviews every entry, and that changes made after review or practitioner feedback are recorded in "Owner change". Add one entry per domain judgement, keyed by the exact path:
  ```markdown
  ## D-007 Diesel on site: N days of normal consumption
  - **Path:** stocks.diesel.initial
  - **Decision:** N days
  - **Reasoning:** …
  - **Source / provenance:** assumed | sourced: <source id>
  - **Owner change:** (blank until the owner or a practitioner changes it)
  ```
  Required entries: every `assumed` quantity path, every `judgementPaths()` entry (tiers and dependencies), the AHS-supervised-from-Perth assumption, and the detect-before-effect assumption for `vendor-monitoring`.
- [ ] **Step 2: Write the register.** Verify every URL you cite by fetching it. Mark anything you could not verify as `assumed`.
- [ ] **Step 3: Write the tests** in `engine/test/model-site.test.ts`, loading the YAML from disk relative to the repo root:
  ```ts
  test('the model site register is valid and fictional', () => { expect(reg.site.fictional).toBe(true); });
  test('S1 as reported: no physical process stops, matching the public record', () => {
    const t = simulate(reg, 's1-as-reported', 'unprepared');
    for (const id of ['haulage', 'drill-and-blast', 'crushing', 'rail'])
      expect(t.totals.stoppedHours[id]).toBe(0);
    expect(t.totals.nonNormalHours['diesel-ordering']).toBeGreaterThan(0);
  });
  test('S1 projection: the fleet stops before the ERP is back', () => {
    const s = reg.scenarios.find(x => x.id === 's1-projection')!;
    const ev = s.events[0] as Extract<ScenarioEvent, { kind: 'cut-service' }>;
    const t = simulate(reg, 's1-projection', 'unprepared');
    const firstStop = t.events.find(e => e.kind === 'process-state' && e.subject === 'haulage' && e.to === 'stopped');
    expect(firstStop!.hour).toBeLessThan(toHours(ev.at) + toHours(ev.restoreAfter));
    expect(t.projection).toBe(true);
  });
  test('S1 prepared: nothing stops and less revenue is at risk', () => {
    const u = simulate(reg, 's1-projection', 'unprepared'), p = simulate(reg, 's1-projection', 'prepared');
    expect(Object.values(p.totals.stoppedHours).every(h => h === 0)).toBe(true);
    expect(p.totals.revenueAtRisk).toBeLessThan(u.totals.revenueAtRisk);
  });
  test('S2: losing Perth parks the fleet unprepared; site authority takes over prepared', () => { /* haulage stopped >0 h unprepared; prepared stopped hours <= the site-authority delay */ });
  test('S3: crusher trips unprepared; prepared revokes vendor A only', () => { /* per Task 5 semantics on real ids; vendor-b-access 'up' throughout */ });
  test('S4 unprepared: isolation takes down the hosted ERP and the Perth link', () => { /* hosted-erp and iroc-link 'down' during the cut */ });
  test('S4 prepared: control room keeps running under isolation', () => { /* control-room stoppedHours 0, prepared */ });
  test('S1 restore duration is sourced, not assumed', () => {
    const ev = reg.scenarios.find(s => s.id === 's1-as-reported')!.events[0] as any;
    expect(ev.restoreAfter.provenance.kind).toBe('sourced');
  });
  test('every assumed value and every judgement has a decision-log entry', () => {
    const log = readFileSync('docs/decisions.md', 'utf8');
    const assumed = quantityPaths(reg).filter(p => p.quantity.provenance.kind === 'assumed').map(p => p.path);
    for (const path of [...assumed, ...judgementPaths(reg)]) expect(log).toContain(`**Path:** ${path}`);
  });
  ```
- [ ] **Step 4: Run** all engine tests. Expected: PASS. If a behavioural test fails, follow the honesty order above: revisit the reasoning, use only the permitted lever, or stop and report. Never tune a value just to pass.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(register): fictional model Pilbara site, scenarios S1-S4, decision log"`

---

### Task 8: Continuity pack and CLI

**Files:**
- Create: `engine/src/pack.ts`, `engine/src/cli.ts`
- Modify: `engine/src/index.ts`, `engine/package.json` (`"bin": {"faillocal": "src/cli.ts"}`), root `package.json` (`"cli": "tsx engine/src/cli.ts"`), `.gitignore` (add `out/`), `README.md`
- Test: `engine/test/pack-cli.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function renderContinuityPack(r: Register, generatedOn: string /* yyyy-mm-dd */): string; // Markdown
  // CLI (exit 0 on success, 1 on RegisterError with one issue per line on stderr):
  //   faillocal validate <register.yaml>
  //   faillocal simulate <register.yaml> --scenario <id> --variant <unprepared|prepared> [--json]
  //   faillocal pack <register.yaml> --out <file.md>
  ```
  The pack is Markdown in this plan. **PDF output is Plan 4** (choosing a Node PDF library is a decision of its own).

**Pack contents.** A header states "Fictional model site. Generated <date> by FailLocal from register <site.id>." Then, per process in effective-tier order (high first):
- name, tier, safety function, production consequence
- a dependencies table: id, name, kind, on loss, workaround
- maximum tolerable outage, recovery target, owner, independent copy, last restore test
- a readiness table, one row per scenario × variant: longest outage vs MTO and vs recovery target, ✓/✗

After the processes come an asset-tier table and a closing "Sources" list.

Every number is followed by its display label: `(sourced: <source title>)`, `(measured: <runId>, <date>)`, `(assumed)` or `(computed)`.

- [ ] **Step 1: Write the failing tests.** Run every spawned CLI with `cwd` set to the repo root, resolved from the test file's location.
  - `pack lists every process with MTO and owner`
  - `pack tags every number with its display label`: no line matches `/\d+(\.\d+)?\s*(h|hours|days)\b(?!.*\((sourced|measured|assumed|computed))/`
  - `pack states the site is fictional`
  - `pack never calls revenue or production lost`: no match for `/\blost (revenue|production|tonnes)\b|\b(revenue|production|tonnes) (is |was )?lost\b/i`. Scenario names like "IROC link lost" are fine.
  - `cli validate exits 0 on the model site`: spawn `tsx engine/src/cli.ts validate register/pilbara-model-site.yaml`
  - `cli validate exits 1 and prints each issue on a broken register`: write a temp YAML with a dangling ref and expect the id on stderr
  - `cli simulate --json prints a Timeline`: parse stdout; `scenarioId` matches
  - `cli pack writes the file`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `renderContinuityPack` and `cli.ts` using `node:util` `parseArgs` (no CLI framework). `cli.ts` starts with the shebang `#!/usr/bin/env -S npx tsx` so the `bin` entry is runnable.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS. Then run `npm run cli -- pack register/pilbara-model-site.yaml --out out/continuity-pack.md`, open the output and check it reads well to a non-technical reader.
- [ ] **Step 5: Update `README.md`**: what FailLocal is (two sentences, fictional site), how to run `validate`, `simulate` and `pack`, and a link to `docs/decisions.md`.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(engine): continuity pack and CLI"`

---

## Done when

- `npm test` and `npm run typecheck` pass from the repo root.
- `npm run cli -- validate register/pilbara-model-site.yaml` exits 0.
- The S1 as-reported test proves the model does not claim any real mine stopped; the S1 projection is flagged `projection: true`.
- Every `assumed` value, tier and dependency in the register has a decision-log entry. Before Plan 2 begins, the owner gets a walkthrough of `docs/decisions.md` and of the simulation model comment at the top of `simulate.ts` (the spec §9 review step).
