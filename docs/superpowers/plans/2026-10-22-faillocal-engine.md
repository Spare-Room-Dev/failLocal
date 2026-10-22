# FailLocal Plan 1: Register, Engine and CLI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the substance layer of FailLocal: a validated YAML register of a fictional Pilbara iron ore site, a pure TypeScript engine that computes what stops, when and what it costs for each scenario on the unprepared and prepared site, and a CLI that validates, simulates and emits the continuity pack.

**Architecture:** An npm-workspaces monorepo. This plan creates the `engine` package only. The register is one YAML file; `zod` schemas plus semantic checks reject anything unlabelled, dangling or cyclic. `simulate()` is a fixed-step (hourly), deterministic, pure function from (register, scenario, variant) to a `Timeline`. The site (Plan 2) and the lab write-back (Plan 3) both depend on the types defined here.

**Tech Stack:** Node ≥ 22, TypeScript 5 (strict), Vitest, zod 3, yaml 2, tsx (CLI runner).

**Spec:** `docs/superpowers/specs/2026-10-22-faillocal-design.md`

## Roadmap (why this is Plan 1 of 4)

The spec covers three subsystems with clean seams, so it is split into four plans. Each is written when the one before it lands, because each consumes the previous plan's interfaces.

| Plan | Delivers | Gate before starting |
|---|---|---|
| **1 (this)** | Register schema, model-site register, engine, CLI, Markdown continuity pack, decision log | none |
| 2 | Site for **release 2** (first playable): welcome page, guided run, S1 hero, unprepared/prepared toggle, revenue counter, side panels, assumptions editor, mobile tiering, CSP, Cloudflare Pages deploy, repo goes public | **Task 1 of Plan 2 is "show the owner 2–3 styled vector mockups of the same scene (top-down vs isometric at minimum) and STOP until they pick one."** The brainstorm mockups were throwaway and do not count. The owner's domain name is also needed for deploy. |
| 3 | **Release 3**: Docker lab (PLC sim, HMI, mock ERP, vendor jump hosts, local identity/logging, Zeek + Suricata), Python harness, lab write-back of `measured` capabilities, S3 detection evidence, "How this was tested" page, network overlay, assets tab, risk ranking with KEV | Plan 2 shipped |
| 4 | **Full launch**: S2/S4 polish on the site, continuity pack PDF, video, "How I built this", limitations, practitioner review changes | Plan 3 shipped |

Release 1 (the LinkedIn write-up on the Scope outage) is writing, not code, and is not planned here.

## Global Constraints

- Node ≥ 22, TypeScript `strict: true`, ES modules throughout.
- The site is a **fictional model mine**. The register's `site.fictional` must be the literal `true`.
- **Every number in the register carries provenance** of exactly one kind: `sourced` (cites a `sources[].id`), `measured` (`runId`, ISO `date`, `evidence`) or `assumed` (`reasoning`). An unlabelled number is a validation error. (Spec §5.1)
- **Capability and duration are separate fields** (spec §5.3). A `restore` control's `duration` and a `cut-service` event's `restoreAfter` may never be `measured`: "A mock ERP restoring in 40 seconds must never be presented as a real restore time." Only `detect-and-revoke` durations may be `measured`.
- The engine is pure and deterministic: no I/O, no clock, no randomness.
- Revenue is always called **"revenue at risk"**, and tonnes **"production deferred"**, never "lost" (spec §4.2).
- No real company is modelled. Real companies appear only as cited sources for scenario bases.
- Every domain judgement written into the register (tier, dependency, outage limit, assumed value) gets an entry in `docs/decisions.md` (spec §9, the owner is review-only).
- Licence: Apache-2.0.
- Every exported function and type is re-exported from `engine/src/index.ts` (Plan 2 imports only from there).

## Review Focus

1. **A cyclic process dependency** (A needs B, B needs A) must be rejected at load with the cycle spelled out, not hang or silently mis-order the simulation. → Task 2, `rejects a dependency cycle and names it`.
2. **A reference to an id that does not exist** (in `dependsOn`, a control effect, a scenario event or a stock) must be rejected and name the missing id. → Task 2, `rejects dangling references and names them`.
3. **A lab number used as a real-world duration** (`measured` provenance on `restoreAfter` or a `restore` control's `duration`) must be rejected with a message pointing to spec §5.3. → Task 2, `rejects measured provenance on real-world durations`.
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
    quantity.ts                  # Provenance, Quantity, unit-locked quantity schemas, toHours()
    schema.ts                    # zod schema for the whole Register + inferred types
    validate.ts                  # semantic checks: refs, cycles, §5.3 rule; parseRegister, loadRegisterYaml
    simulate.ts                  # simulate() — services, assets, processes, stocks, controls
    production.ts                # tonnes deferred / revenue at risk accumulation
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
  export type Unit = 'hours' | 'days' | 'seconds' | 'count' | 'fraction' | 'Mt/a' | 'USD/t' | 'days/day';
  export interface Quantity<U extends Unit = Unit> { value: number; unit: U; provenance: Provenance }
  export const provenanceSchema: z.ZodType<Provenance>;
  export function quantity<U extends Unit>(unit: U, opts?: { allowMeasured?: boolean }): z.ZodType<Quantity<U>>;
  export function toHours(q: Quantity<'hours' | 'days'>): number;
  ```

- [ ] **Step 1: Scaffold the workspace.** Root `package.json` (`"private": true`, `"type": "module"`, `"workspaces": ["engine"]`, `"engines": {"node": ">=22"}`, scripts `test`, `typecheck`, `cli` delegating to the engine). `engine/package.json` with deps `zod@^3`, `yaml@^2`; devDeps `typescript@^5`, `vitest`, `tsx`, `@types/node`. `tsconfig.base.json`: `strict`, `module`/`moduleResolution` `NodeNext`, `target` `ES2022`, `noUncheckedIndexedAccess: true`. Apache-2.0 `LICENSE`. A five-line `README.md`. Run `npm install`.

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

- [ ] **Step 3: Run** `npm test -w engine`. Expected: FAIL, module `../src/quantity` not found.

- [ ] **Step 4: Implement `engine/src/quantity.ts`.** A zod discriminated union on `kind`, all strings non-empty, `date` matching `/^\d{4}-\d{2}-\d{2}$/`. The `measured`-disallowed error message must contain `§5.3` and the text `lab measurements are not real-world durations`. Re-export from `index.ts`.

- [ ] **Step 5: Run** `npm test -w engine` and `npm run typecheck`. Expected: PASS, no type errors.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(engine): workspace and provenance-carrying quantities"`

---

### Task 2: Register schema and validation

**Files:**
- Create: `engine/src/schema.ts`, `engine/src/validate.ts`, `engine/test/fixtures.ts`
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
    manualWorkaround?: { description: string; holdsFor: Quantity<'days'> };
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
  interface Asset { id: string; name: string; type: 'plc' | 'hmi' | 'historian' | 'server' | 'network' | 'workstation'; zone: string }
  interface Service { id: string; name: string; provider: string; hosting: string; kind: 'enterprise-app' | 'identity' | 'remote-ops' | 'vendor-access' | 'network-link' }
  interface Stock {
    id: string; name: string;
    capacity: Quantity<'days'>; initial: Quantity<'days'>; lowThreshold: Quantity<'days'>;
    refillRate: Quantity<'days/day'>;
    replenishedBy: string;                       // process id
    consumedBy: string[];                        // process ids, min 1
  }
  type ControlEffect =
    | { kind: 'fallback'; process: string; service: string }   // process degraded, not stopped, while service down
    | { kind: 'restore'; service: string }                     // service back after `duration`
    | { kind: 'detect-and-revoke'; service: string };          // compromise via service detected after `duration`; service revoked
  interface Control {
    id: string; name: string; description: string; effects: ControlEffect[];   // min 1
    capability: { works: boolean; provenance: Provenance; measurements: { name: string; quantity: Quantity }[] }; // measurements may be measured
    duration?: Quantity<'hours'>;  // required for restore and detect-and-revoke; measured allowed ONLY for detect-and-revoke
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
  ```
- Produces (in `test/fixtures.ts`, used by all later engine tests):
  ```ts
  export function q<U extends Unit>(value: number, unit: U): Quantity<U>;  // assumed provenance, reasoning 'test'
  export function minimalRegister(): Register;
  ```
  `minimalRegister()` is a valid site with: one service `erp`; one asset `plc`; processes `ordering` (back-office, depends on `erp` onLoss `stop`), `haulage` (physical, depends on stock `diesel` onLoss `stop`), `crushing` (depends on process `haulage` and asset `plc`, both `stop`), `rail` (depends on stock `ore`); stock `diesel` (capacity 4 d, initial 4, lowThreshold 1, refillRate 2 d/d, replenishedBy `ordering`, consumedBy `[haulage]`); stock `ore` (capacity 3, initial 3, lowThreshold 0.5, refillRate 2, replenishedBy `crushing`, consumedBy `[rail]`); production 10 Mt/a at 100 USD/t, shippingProcess `rail`, degradedOutput 0.5; no controls; scenario `cut-erp` (cut `erp` at 0 h for 288 h, horizon 20 d, workaroundsHold false, projection false); one source `test-src`.

- [ ] **Step 1: Write the fixtures and the failing tests** in `engine/test/validate.test.ts`:
  ```ts
  test('minimal register is valid', () => { expect(() => parseRegister(minimalRegister())).not.toThrow(); });
  test('site must be marked fictional', () => {
    const r: any = minimalRegister(); r.site.fictional = false;
    expect(() => parseRegister(r)).toThrow(RegisterError);
  });
  test('rejects dangling references and names them', () => {
    const r: any = minimalRegister(); r.processes[0].dependsOn.push({ on: 'ghost', onLoss: 'stop' });
    expect(() => parseRegister(r)).toThrow(/ghost/);
  });
  test('rejects a dependency cycle and names it', () => {
    const r: any = minimalRegister();
    r.processes.find((p: any) => p.id === 'haulage').dependsOn.push({ on: 'crushing', onLoss: 'stop' });
    expect(() => parseRegister(r)).toThrow(/haulage.*crushing|crushing.*haulage/);
  });
  test('rejects measured provenance on real-world durations', () => {
    const r: any = minimalRegister();
    r.scenarios[0].events[0].restoreAfter.provenance = { kind: 'measured', runId: 'r', date: '2026-12-14', evidence: 'x' };
    expect(() => parseRegister(r)).toThrow(/§5\.3/);
  });
  test('allows measured duration only on detect-and-revoke', () => { /* restore control with measured duration -> throws; detect-and-revoke -> ok */ });
  test('restore and detect-and-revoke controls require a duration', () => { /* missing duration -> throws */ });
  test('sourced provenance must cite a listed source', () => { /* source 'nope' -> throws /nope/ */ });
  test('stock must have at least one consumer', () => { /* consumedBy [] -> throws */ });
  test('duplicate ids across processes, assets, services and stocks are rejected', () => { /* id 'plc' used twice -> throws /plc/ */ });
  test('processOrder puts dependencies first', () => {
    const order = processOrder(parseRegister(minimalRegister()));
    expect(order.indexOf('haulage')).toBeLessThan(order.indexOf('crushing'));
  });
  ```
  Write the two-line bodies of the commented tests as described.

- [ ] **Step 2: Run** `npm test -w engine`. Expected: FAIL, `parseRegister` not defined.

- [ ] **Step 3: Implement `schema.ts`.** zod objects mirroring the types above. Use `quantity(unit)` for every numeric field; `capability.measurements[].quantity` uses `allowMeasured: true`; `Control.duration` uses `allowMeasured: true` and the §5.3 rule is enforced in `validate.ts` (it depends on `effect.kind`). `site.fictional: z.literal(true)`.

- [ ] **Step 4: Implement `validate.ts`.** After zod, collect **all** issues before throwing (not just the first): one id namespace across processes/assets/services/stocks; every reference resolves to the right kind (e.g. `replenishedBy` is a process, `effect.service` is a service, `compromise.target` is an asset); every `sourced` provenance cites a `sources[].id`; §5.3 rule for `restore` durations and `restoreAfter`; required durations. `processOrder` is a topological sort over process→process dependencies only; a cycle produces an issue of the form `dependency cycle: haulage -> crushing -> haulage`.

- [ ] **Step 5: Run** `npm test -w engine`. Expected: PASS.

- [ ] **Step 6: Commit** `git commit -am "feat(engine): register schema and validation"` (add new files first).

---

### Task 3: Simulation core: services, assets and process propagation

**Files:**
- Create: `engine/src/simulate.ts`
- Test: `engine/test/simulate.services.test.ts`

**Interfaces:**
- Consumes: `Register`, `Scenario`, `processOrder`, `toHours` (Tasks 1–2).
- Produces (in `simulate.ts`; later tasks extend the same function, not new ones):
  ```ts
  export type Variant = 'unprepared' | 'prepared';
  export type ProcessState = 'normal' | 'degraded' | 'stopped';
  export interface Sample {
    hour: number;
    processes: Record<string, ProcessState>;
    services: Record<string, 'up' | 'down' | 'revoked'>;
    assets: Record<string, 'up' | 'down'>;
    stocks: Record<string, number>;     // days remaining
    tonnesDeferred: number;             // cumulative
    revenueAtRisk: number;              // cumulative USD
  }
  export type TimelineEventKind =
    | 'service-down' | 'service-up' | 'access-revoked' | 'asset-down' | 'asset-up'
    | 'compromise-detected' | 'process-state' | 'stock-low' | 'stock-empty';
  export interface TimelineEvent { hour: number; kind: TimelineEventKind; subject: string; from?: string; to?: string }
  export interface Timeline {
    scenarioId: string; variant: Variant; projection: boolean; stepHours: 1;
    samples: Sample[]; events: TimelineEvent[];
    totals: { tonnesDeferred: number; revenueAtRisk: number; nonNormalHours: Record<string, number>; stoppedHours: Record<string, number> };
    assumptionsUsed: { annualTonnes: Provenance; price: Provenance };
  }
  export function simulate(r: Register, scenarioId: string, variant: Variant): Timeline;
  export function simulateWith(r: Register, scenarioId: string, variant: Variant, overrides: Partial<Record<string, number>>): Timeline;
  // overrides: key "stock:<id>.initial" | "production.annualTonnes" | "production.price" -> replacement value (the site's assumptions editor)
  ```

The model (state this in a short doc comment at the top of `simulate.ts`, because the owner must be able to explain it):
- Fixed 1-hour steps from hour 0 to `horizon` inclusive. One `Sample` per step.
- A service is `down` while any `cut-service` window `[at, at + restoreAfter)` covers the hour. Windows for the same service merge.
- A `compromise` event downs its `target` asset for `[at, at + downFor)` (Task 5 adds the prepared-site response).
- Each step, evaluate processes in `processOrder`. A process's state is the **worst** over its dependencies, where a lost dependency yields `stopped` if `onLoss: 'stop'`, else `degraded`. A dependency is lost when: a service is `down`/`revoked`; an asset is `down`; an upstream process is `stopped` (an upstream `degraded` makes this one at most `degraded`); a stock is at 0 (at or below `lowThreshold` it yields `degraded` regardless of `onLoss`).
- `manualWorkaround` on a service dependency: while the service is down, the dependency yields `degraded`, for ever if `scenario.workaroundsHold`, else for `holdsFor` after the outage began and then the normal `onLoss` result.
- Emit `process-state` events only on change, with `from`/`to`.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('cutting a service stops the process that needs it, then restores it', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[1].processes.ordering).toBe('stopped');
    expect(t.samples[288].processes.ordering).toBe('normal');
    expect(t.events).toContainEqual(expect.objectContaining({ hour: 0, kind: 'service-down', subject: 'erp' }));
  });
  test('onLoss degrade yields degraded, not stopped', () => { /* set ordering dep onLoss 'degrade' -> 'degraded' at hour 1 */ });
  test('a stopped upstream process stops a dependent one', () => { /* compromise event downs 'plc' for 5 h -> crushing stopped at hours 0..4, normal at 5 */ });
  test('overlapping cuts of one service merge into one outage', () => {
    // two windows [0,10) and [5,20) on erp -> ordering stopped at hours 9, 10 and 19; normal at 20
  });
  test('manual workaround degrades for holdsFor, then stops, unless workarounds hold', () => {
    // ordering dep on erp with manualWorkaround holdsFor 2 days:
    // workaroundsHold false -> degraded at hour 47, stopped at hour 48
    // workaroundsHold true  -> degraded at hour 200
  });
  test('simulate is deterministic', () => { /* two runs deep-equal */ });
  test('unknown scenario id throws', () => { /* /no-such/ */ });
  ```
  (Stocks are ignored until Task 4. In this task, treat every stock as full.)

- [ ] **Step 2: Run** `npm test -w engine -- simulate.services`. Expected: FAIL.
- [ ] **Step 3: Implement** `simulate`/`simulateWith` per the model above. Leave `tonnesDeferred`/`revenueAtRisk` at 0 and `stocks` at `initial` (Task 4 fills them).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(engine): hourly simulation of services and process propagation"`

---

### Task 4: Stocks and production deferred

**Files:**
- Create: `engine/src/production.ts`
- Modify: `engine/src/simulate.ts`
- Test: `engine/test/simulate.stocks.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `Sample` (Task 3).
- Produces: `export function tonnesPerHour(p: Production): number` (= `annualTonnes × 1e6 / 8760`) in `production.ts`; populated `stocks`, `tonnesDeferred`, `revenueAtRisk`, `totals`, `assumptionsUsed`.

Stock rule, per step (all values in days, step = 1/24 day):
- If `replenishedBy` is `normal` or `degraded`: level += `refillRate × step`, capped at `capacity`.
- Else, if any consumer is not `stopped`: level -= `step`, floored at 0.
- Emit `stock-low` when the level first drops to or below `lowThreshold`, and `stock-empty` at 0 (once per crossing).

Production rule, per step: deferred += `tonnesPerHour × (shipping stopped ? 1 : shipping degraded ? (1 - degradedOutput) : 0)`; revenueAtRisk = deferred × price. `nonNormalHours`/`stoppedHours` count steps per process.

- [ ] **Step 1: Write the failing tests** (with `minimalRegister`, `cut-erp` for 288 h):
  ```ts
  test('diesel runs down once ordering stops, and haulage degrades then stops', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[24].stocks.diesel).toBeCloseTo(3, 5);
    expect(t.samples[72].processes.haulage).toBe('degraded');   // level 1 = lowThreshold
    expect(t.samples[97].processes.haulage).toBe('stopped');    // empty after 96 h
  });
  test('the stockpile buffers rail after crushing stops', () => {
    // crushing stops at hour 96 with haulage; ore lasts 3 days -> rail normal at hour 100, stopped by hour 169
  });
  test('production is deferred only while rail is not normal', () => {
    const t = simulate(parseRegister(minimalRegister()), 'cut-erp', 'unprepared');
    expect(t.samples[100].tonnesDeferred).toBe(0);
    const perHour = 10e6 / 8760;
    expect(t.totals.tonnesDeferred).toBeCloseTo(perHour * (t.totals.stoppedHours.rail + 0.5 * (t.totals.nonNormalHours.rail - t.totals.stoppedHours.rail)), 0);
    expect(t.totals.revenueAtRisk).toBeCloseTo(t.totals.tonnesDeferred * 100, 0);
  });
  test('stocks refill after the service returns', () => { /* diesel back above lowThreshold some hours after 288 */ });
  test('assumptionsUsed exposes price and tonnes provenance', () => { /* deep-equals register provenance */ });
  test('simulateWith overrides diesel stock and changes the outcome', () => {
    const r = parseRegister(minimalRegister());
    const t = simulateWith(r, 'cut-erp', 'unprepared', { 'stock:diesel.initial': 20 });
    expect(t.samples[200].processes.haulage).toBe('normal');
  });
  test('an unknown override key throws', () => { /* 'stock:nope.initial' -> throws /nope/ */ });
  ```
  Where the exact hour of a crossing depends on floating-point stepping, assert a ±1 h window rather than a single hour.

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the stock and production rules. Stocks update **after** process evaluation in each step, and processes read the previous step's stock levels (state this in the doc comment).
- [ ] **Step 4: Run** all engine tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(engine): stocks, production deferred and revenue at risk"`

---

### Task 5: Controls and the prepared site

**Files:**
- Modify: `engine/src/simulate.ts`
- Test: `engine/test/simulate.controls.test.ts`

**Interfaces:**
- Consumes: `Control`, `ScenarioEvent` (Task 2); `simulate` (Tasks 3–4).
- Produces: no new exports. `variant: 'prepared'` now applies every control whose `capability.works` is `true`; `'unprepared'` applies none.

**Decision recorded here (spec §8 left it to the builder):** "prepared" is **one register plus its `controls` list**. There is no second register file. The unprepared site is the same register with controls ignored.

Control semantics (prepared only; a control applies each entry in its `effects` list):
- `fallback {process, service}`: while `service` is down, that dependency of `process` yields `degraded` instead of its `onLoss` result.
- `restore {service}`: every cut window on `service` is shortened to `min(restoreAfter, duration)`.
- `detect-and-revoke {service}`: a `compromise` event via `service` emits `compromise-detected` and `access-revoked` at `at + duration`; from then to the horizon `service` is `revoked`; the target asset is **not** downed. Unprepared: the target asset is `down` for `downFor`, and nothing is revoked.
- `capability.measurements` never feed the simulation. Only `duration` does.

- [ ] **Step 1: Write the failing tests:**
  ```ts
  test('a fallback keeps a process degraded instead of stopped', () => { /* fallback ordering/erp -> ordering degraded at hour 1, diesel never empties */ });
  test('an independent restore shortens the outage', () => { /* restore erp duration 6 h -> erp up at hour 6, prepared; still down at 6 unprepared */ });
  test('detect-and-revoke protects the asset and revokes only that vendor', () => {
    // services vendor-a, vendor-b; compromise via vendor-a on plc at 2 h, downFor 8 h; control duration 0.25 h
    // prepared: plc never down; crushing never stopped; vendor-a 'revoked' from hour 3; vendor-b 'up' throughout
    // unprepared: plc down hours 2..9; crushing stopped those hours
  });
  test('a control whose capability does not work is ignored', () => { /* works:false restore -> outage unchanged */ });
  test('lab measurements on a capability do not change durations', () => {
    // restore duration 6 h assumed; measurement {name:'restore', quantity: 40 seconds measured}
    // -> erp still down at hour 5, up at hour 6
  });
  ```
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the control semantics.
- [ ] **Step 4: Run** all engine tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(engine): resilience controls and prepared variant"`

---

### Task 6: Asset tiers and readiness

**Files:**
- Create: `engine/src/tiers.ts`, `engine/src/readiness.ts`
- Test: `engine/test/tiers-readiness.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function deriveAssetTiers(r: Register): Record<string, Tier>;
  // an asset's tier = highest tier of any process that depends on it directly or through other processes; unused assets -> 'low'
  export interface ReadinessRow {
    processId: string; scenarioId: string; variant: Variant;
    longestOutageHours: number;          // longest contiguous non-normal run
    maxTolerableOutageHours: number;
    withinTolerance: boolean;
  }
  export function assessReadiness(r: Register): ReadinessRow[];  // every process × every scenario × both variants
  ```
  Risk ranking (tier × exposure × availability + KEV) is **deferred to Plan 3**, where the lab supplies the asset inventory and a KEV dataset choice is made.

- [ ] **Step 1: Write the failing tests:** `tiers propagate through process dependencies` (`plc` takes `crushing`'s tier; raising `rail`'s tier does not change `plc`, because rail depends on the stock, not on crushing directly); `readiness flags a process over its tolerance` (`ordering` with MTO 24 h under `cut-erp` unprepared → `withinTolerance: false`, `longestOutageHours: 288`); `readiness counts degraded as outage` (a fallback in prepared → longest outage 288, still flagged); `readiness rows cover every process, scenario and variant` (length = processes × scenarios × 2).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** both functions. `assessReadiness` calls `simulate`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(engine): derived asset tiers and outage readiness"`

---

### Task 7: The model site register and decision log

**Files:**
- Create: `register/pilbara-model-site.yaml`, `docs/decisions.md`
- Test: `engine/test/model-site.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the canonical register Plan 2's site loads. Ids below are fixed (the site and Plan 3's lab refer to them).

Content to model (ids fixed; values chosen and justified by the implementer):
- `site`: id `pilbara-model-site`, name "Model Pilbara iron ore site (fictional)", `fictional: true`.
- **services:** `hosted-erp`, `cloud-identity`, `iroc-link`, `vendor-a-access`, `vendor-b-access`, `corporate-network`.
- **assets (minimum):** `crusher-plc`, `conveyor-plc`, `control-room-hmi`, `site-historian`, `site-identity`, `offline-wo-app`, `vendor-jump-host`.
- **processes:** `diesel-ordering`, `explosives-ordering`, `work-orders`, `payroll` (back-office; depend on `hosted-erp`, with `manualWorkaround` where the public record shows one, e.g. purchase orders by email); `remote-operations` (depends on `iroc-link`); `control-room` (depends on `control-room-hmi` and on `cloud-identity` via `corporate-network`); `haulage` (diesel stock, `remote-operations`); `drill-and-blast` (explosives stock); `crushing` (`haulage`, `crusher-plc`, `conveyor-plc`, `control-room`); `rail` (ore stockpile stock). Every process gets `status` copy in mining language, with no security jargon (spec §2).
- **stocks:** `diesel`, `explosives`, `ore-stockpile`.
- **controls (prepared site):** `offline-ordering` (two fallback effects: `diesel-ordering`/`hosted-erp` and `explosives-ordering`/`hosted-erp`), `offline-work-orders` (fallback, `work-orders`/`hosted-erp`), `payroll-continuity` (fallback, `payroll`/`hosted-erp`: the last pay run is reused), `independent-erp-restore` (restore `hosted-erp`), `site-authority` (fallback `remote-operations`/`iroc-link`), `local-identity` (fallback `control-room`/`cloud-identity` and `control-room`/`corporate-network`), `vendor-monitoring` (detect-and-revoke on `vendor-a-access`). Capabilities are `assumed` until Plan 3 measures them.
- **scenarios:** `s1-as-reported` (cut `hosted-erp`, `restoreAfter` **sourced** from the Scope Systems incident updates: about 12 days from 5 May to the 100% restore on 17 May 2026; `workaroundsHold: true`, `projection: false`); `s1-projection` (same cut, `workaroundsHold: false`, `projection: true`, summary says plainly it is a "what if the workarounds ran out" projection); `s2-iroc-lost`; `s3-vendor-setpoint` (compromise via `vendor-a-access` on `crusher-plc`); `s4-precautionary-isolation` (cut `corporate-network`; duration basis Copper Mountain, Dec 2022, about five days).
- **sources:** at least the Scope Systems updates, MM-ISAC reference architecture, the MINING.COM op-ed, the Copper Mountain reporting, the Claroty mining survey and Waterfall 2025, with URLs from `~/Documents/Hyperresearch/project-ideas/01-mine-site-resilience-map.md` "Key sources" (and the research report for Copper Mountain / Northern Star). Set `accessed` to the date you verify each URL.
- **production:** `annualTonnes` is `assumed` with reasoning (a mid-size Pilbara mine). `price` is `sourced` from a dated public iron ore price series (cite the series and the month); if no source can be verified, `assumed` with the reasoning stated. Do **not** invent a figure and label it sourced.

- [ ] **Step 1: Write the failing tests** in `engine/test/model-site.test.ts` (load the YAML from disk):
  ```ts
  test('the model site register is valid and fictional', () => { expect(reg.site.fictional).toBe(true); });
  test('S1 as reported: no physical process stops, matching the public record', () => {
    const t = simulate(reg, 's1-as-reported', 'unprepared');
    for (const id of ['haulage', 'drill-and-blast', 'crushing', 'rail'])
      expect(t.totals.stoppedHours[id]).toBe(0);
    expect(t.totals.nonNormalHours['diesel-ordering']).toBeGreaterThan(0);
  });
  test('S1 projection: the fleet stops before the ERP is back', () => {
    const t = simulate(reg, 's1-projection', 'unprepared');
    const firstStop = t.events.find(e => e.kind === 'process-state' && e.subject === 'haulage' && e.to === 'stopped');
    expect(firstStop && firstStop.hour).toBeLessThan(288);
    expect(t.projection).toBe(true);
  });
  test('S1 prepared: nothing stops and less revenue is at risk', () => {
    const u = simulate(reg, 's1-projection', 'unprepared'), p = simulate(reg, 's1-projection', 'prepared');
    expect(Object.values(p.totals.stoppedHours).every(h => h === 0)).toBe(true);
    expect(p.totals.revenueAtRisk).toBeLessThan(u.totals.revenueAtRisk);
  });
  test('S3: crusher trips unprepared; prepared revokes vendor A only', () => { /* per Task 5 semantics on real ids */ });
  test('S4 prepared: control room keeps running under isolation', () => { /* control-room never stopped, prepared */ });
  test('S1 restore duration is sourced, not assumed', () => {
    const ev = reg.scenarios.find(s => s.id === 's1-as-reported')!.events[0] as any;
    expect(ev.restoreAfter.provenance.kind).toBe('sourced');
  });
  test('every assumed value has an entry in the decision log', () => {
    // collect every provenance of kind 'assumed' with its JSON path; each path must appear in docs/decisions.md
  });
  ```
- [ ] **Step 2: Run.** Expected: FAIL (no register file).
- [ ] **Step 3: Write the register.** Verify every URL you cite by fetching it. Mark anything you could not verify as `assumed`.
- [ ] **Step 4: Write `docs/decisions.md`.** One entry per domain judgement, in this format:
  ```markdown
  ## D-007 Diesel on site: 4 days of normal consumption
  - **Where:** stocks.diesel.initial
  - **Decision:** 4 days
  - **Reasoning:** …
  - **Source / provenance:** assumed | sourced: <source id>
  - **Owner change:** (blank until the owner or a practitioner changes it)
  ```
  Include the path string exactly as the decision-log test computes it. Open the file with a short paragraph saying the owner reviews every entry and that changes made after review or practitioner feedback are recorded in "Owner change".
- [ ] **Step 5: Run** all engine tests. Expected: PASS. If an S1/S3/S4 behavioural test fails, change the register values (and their decision-log reasoning), not the test. The tests encode the spec's honesty claims.
- [ ] **Step 6: Commit** `git commit -m "feat(register): fictional model Pilbara site, scenarios S1-S4, decision log"`

---

### Task 8: Continuity pack and CLI

**Files:**
- Create: `engine/src/pack.ts`, `engine/src/cli.ts`
- Modify: `engine/src/index.ts`, `engine/package.json` (`"bin": {"faillocal": "src/cli.ts"}` run via tsx), root `package.json` (`"cli": "tsx engine/src/cli.ts"`), `README.md`
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
  The pack is Markdown in this plan. **PDF output is Plan 4** (a Node PDF library choice is its own decision).

Pack contents, per process in tier order (high first): name, tier, safety function, production consequence; a dependencies table (id, name, kind, on loss, workaround); maximum tolerable outage, recovery target, owner, independent copy, last restore test; a readiness table (scenario × variant: longest outage vs MTO, ✓/✗). Then an asset-tier table. Every number is followed by its provenance tag: `(sourced: <source title>)`, `(measured: <runId>, <date>)` or `(assumed)`. A header states "Fictional model site. Generated <date> by FailLocal from register <site.id>." A closing "Sources" list.

- [ ] **Step 1: Write the failing tests:** `pack lists every process with MTO and owner`; `pack tags every number with its provenance` (no line in the pack matches `/\d+(\.\d+)?\s*(h|hours|days)\b(?!.*\((sourced|measured|assumed))/`); `pack states the site is fictional`; `cli validate exits 0 on the model site` (spawn `tsx engine/src/cli.ts validate register/pilbara-model-site.yaml`); `cli validate exits 1 and prints each issue on a broken register` (write a temp YAML with a dangling ref, expect the id on stderr); `cli simulate --json prints a Timeline` (parse stdout, `scenarioId` matches); `cli pack writes the file`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `renderContinuityPack` and `cli.ts`, using `node:util` `parseArgs` (no CLI framework).
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS. Then run `npm run cli -- pack register/pilbara-model-site.yaml --out out/continuity-pack.md`, open the output, and check it reads well to a non-technical reader. Add `out/` to `.gitignore`.
- [ ] **Step 5: Update `README.md`**: what FailLocal is (two sentences, fictional site), how to run `validate`, `simulate` and `pack`, and a link to `docs/decisions.md`.
- [ ] **Step 6: Commit** `git commit -m "feat(engine): continuity pack and CLI"`

---

## Done when

- `npm test` and `npm run typecheck` pass from the repo root.
- `npm run cli -- validate register/pilbara-model-site.yaml` exits 0.
- The S1 as-reported test proves the model does not claim any real mine stopped; the S1 projection is flagged `projection: true`.
- Every `assumed` value in the register has a decision-log entry, and the owner has a walkthrough of `docs/decisions.md` and the simulation model comment at the top of `simulate.ts` (spec §9 review step) before Plan 2 begins.
