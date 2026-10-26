# Plan 1 follow-ups

These items came out of the Plan 1 reviews (26 Oct 2026). They were deliberately left out of Plan 1. Each later plan should pick up its own items.

## Owner decisions needed before Plan 2

1. **Revenue punchline (final review I1).** On the model site, revenue at risk is $0 in both variants for S1 (as reported, and the projection) and for S3. The stockpile carries rail through Scope's real 12 days. S2 shows the same $3.3M with or without preparation. Only S4 shows a gap: about $29.0M unprepared against $16.7M prepared. The spec ends the guided run on "being prepared protected $X". Pick one:
   - **(a)** Add a per-stock delivery lead time to the engine. D-008 already admits that recovery is unrealistically instant.
   - **(b)** Ratify a longer S1 restore as a labelled what-if, in D-079's Owner change line.
   - **(c)** End S1 on "the fleet never parked", and take the dollar comparison from S4.

   **Update, 26 Oct 2026:** the owner chose (a), and it is now merged. Diesel has a 36 h lead time and explosives 72 h (D-091, D-092). The delay moves the S1 outage later without deepening it: the fleet parks at h276, and revenue at risk is still $0. Two options remain: add Scope's sourced recovery tail (one to two days of transactions reconciled by hand after the restore), or go with (c).

   **Done, 26 Oct 2026:** the owner chose the recovery tail. Diesel and explosives ordering hold new purchase orders for 24 h after the ERP is back (assumed, D-094, D-095), and the prepared site's duplicate rejection lifts the hold (D-096). S1 projection now has about $6.0M at risk unprepared and $0 prepared. The figure rests entirely on the assumed hold: it is $0 below a 10-hour hold (D-079).

   Separately, decide whether rail under site authority (S2, prepared) should earn shipping credit (D-040).
2. **Vendor jump host tier (I2).** The asset that keeps the crusher safe in S3 derives a `low` tier (D-011), and the tier table prints it that way. Fixing this needs a schema field, such as `protects: [process ids]` on controls, or the processes and assets a vendor-access service reaches. Make the change before Plan 2 freezes the register shape.
3. **Variant-aware independent copy (I3).** `independentCopy` describes the baseline site, so it reads "no" even with the prepared toggle on. The pack now documents this convention. Plan 2's side panel needs either a derived prepared-variant value or the same explanation.

## Plan 2 (website) notes
- Out-of-range values are rejected as a `RegisterError` that names the path. A run is rejected if any override in the set is invalid, not only the overrides for the active scenario.
- Free play: build scenarios from template events with fixed provenance, and apply the visitor's values through `overrides`, so they arrive as `overridden: true` ("chosen by you"). See the `simulate.ts` doc comment.
- `assumptionsUsed` lists every workaround `holdsFor`, and every working control's effect paths in prepared runs. Filter the display to the services the scenario touches.
- `assessReadiness` runs about 100 simulations (about 250 ms). Cache it per scenario × variant, and never call it per keystroke.
- `quantityPaths` returns live register objects, so do not mutate them.
- A horizon of 0.001 days is accepted. If visitors can set the horizon, add a 1-day floor in the editor.
- Same-hour event order and fractional `TimelineEvent.hour` are documented in `simulate.ts`.

## Plan 3 (lab) notes
- The date regex accepts invalid calendar dates such as `2026-13-45`. Tighten it before the lab writes `measured` dates.
- Detection gate: a later compromise that takes down the control's gating asset before an earlier detection is not seen, so the prepared site is over-credited. A repeat compromise through an already-revoked service emits a duplicate `access-revoked`.
- Restore with a relied-on asset: a service goes down again if the asset fails during the original outage window. This is intended and tested; revisit it once restore is measured.
- `site-identity` zone: Level 3.5 vs Level 3. Settle it when drawing the network overlay.

## Plan 4 (launch) notes
- The pack label guard does not catch ranges like "2-3 hours", or tonnes and USD on their own without a negative test. Revisit it alongside the PDF pack.
- `simulate.ts` is about 520 lines. Split out `windows.ts` (`covering`, `merge`, `intersect`, `subtract`) when the file is next touched.
