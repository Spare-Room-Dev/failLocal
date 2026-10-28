# Decision log: the model Pilbara site

Every domain judgement in `register/pilbara-model-site.yaml` is recorded here: each tier, each dependency, each outage limit and each assumed number, with its reasoning and source. The owner reviews every entry before a release. A change the owner makes during review, or after feedback from a practitioner, is recorded in that entry's "Owner change" line, so the log shows who decided what and why.

Entries are grouped by topic, so their numbers are not always in order. Each entry names the register path it covers (`**Path:**`). Entries without a path record a modelling rule that applies across the register. "Assumed" means a reasoned estimate, not a fact about any real mine; "sourced" names a source listed in the register's `sources`.

# How the model works

## D-001 Prepared and unprepared are one register
- **Decision:** "Prepared" is the register with its controls applied. "Unprepared" is the same register with every control ignored. There is no second site.
- **Reasoning:** The only difference between the two runs is the controls, so any gap between them is caused by the controls and nothing else.
- **Source / provenance:** modelling rule (engine, `simulate.ts`)
- **Owner change:**

## D-002 The site is fictional, with distances compressed
- **Decision:** The model site is a fictional mid-size Pilbara iron ore mine. It is not any company's site. Distances on the display are compressed to model scale (see DESIGN.md, open items).
- **Reasoning:** No public mine OT data exists, and modelling a real company would imply knowledge we do not have. Real companies appear only as sources for scenario bases.
- **Source / provenance:** assumed
- **Owner change:**

## D-003 The haul fleet is autonomous, supervised from Perth
- **Decision:** The haul fleet is autonomous (AHS) and supervised from a remote operations centre in Perth. Without that supervision the trucks park.
- **Reasoning:** A stated model assumption, not a claim about any company. The pattern exists: Pilbara mines are run from Perth, 1,000–1,500 km away (project idea file, from the research report), and Rio Tinto says about 90% of its Pilbara haul fleet is autonomous and operated from its Perth Operations Centre.
- **Source / provenance:** assumed (pattern evidenced by sourced: rio-tinto-wa-operations)
- **Owner change:**

## D-004 Detect-and-revoke stops the change before it bites
- **Decision:** When vendor monitoring detects a bad change and revokes the vendor's access before the change's effect would end, the model assumes the change never took effect (detection and revocation came first, or the change was reverted). If detection comes at or after the end of the crusher outage (`downFor`), nothing was prevented: the crusher still trips.
- **Reasoning:** This is the prepared site's claim in S3, and it is optimistic. Plan 3's lab will test whether the write can really be caught before the crusher acts on it.
- **Source / provenance:** assumed (engine rule, `simulate.ts`)
- **Owner change:**

## D-005 When controls overlap, the shortest time wins
- **Decision:** If several working controls cover the same thing (two restores of one service, two fallbacks for one dependency, two monitors on one vendor), the shortest duration applies.
- **Reasoning:** The site would use whichever path is quickest.
- **Source / provenance:** modelling rule (engine, `controls.ts`)
- **Owner change:**

## D-006 A control that fails its test still counts toward asset tiers
- **Decision:** An asset a control relies on gets that control's tier even if the control is marked `works: false`.
- **Reasoning:** A tier says what an asset is relied on for, not whether the reliance is currently justified. A failed test makes the asset more urgent to fix, not less important.
- **Source / provenance:** modelling rule (engine, `tiers.ts`)
- **Owner change:**

## D-007 Every control is assumed to work until the lab tests it
- **Decision:** All eight controls are `works: true` with `assumed` provenance and no measurements.
- **Reasoning:** The lab (Plan 3) does not exist yet. The spec allows assumed capability for the first release, labelled as such. Each will become `measured` or be marked as failing once tested.
- **Source / provenance:** assumed
- **Owner change:**

## D-008 Stocks refill through a delivery delay line
- **Decision:** Stocks are counted in days of normal use. A stock can have a delivery lead time L (rounded up to whole hours; none means 0). A delivery arrives in an hour only if the process that refills the stock was running L hours earlier; before the run starts it counts as running, because a site in steady state has orders on the road. In an hour a delivery arrives, the stock rises at its refill rate (the net gain after normal use) up to capacity. In any other hour it falls by one hour's use while anything still uses it. Every stock starts full.
- **Reasoning:** Orders already placed are in transit, so when ordering stops, deliveries keep arriving for L hours, and when ordering resumes, the first delivery arrives L hours later. Before this rule the engine had no lead time: fuel arrived the same hour ordering resumed, which made recovery look too fast. The delay is symmetric, so both the stop and the recovery come L hours later. Only stocks bought from outside the site have a lead time (diesel D-091, explosives D-092); ore stocks are filled on site and have none. A running site keeps its stocks topped up, so "full" is the normal working level.
- **Source / provenance:** modelling rule (engine, `simulate.ts`)
- **Owner change:** 26 Oct 2026: the owner chose to add delivery lead times (Plan 1 follow-up (a)). Before this, D-008 recorded that the engine had no delivery delay.

## D-009 What runs over the corporate network
- **Decision:** The hosted ERP, cloud identity and the Perth link all reach the site over the corporate network, so cutting the corporate network takes all three down. The two vendors reach the site through the site's own vendor jump host, not the corporate network.
- **Reasoning:** Routing the Perth link over the corporate network makes the precautionary isolation in S4 cut Perth as well. MM-ISAC asks for remote operations to be its own zone with two separate links; the model site has not done that, which is the point S4 shows. Keeping vendor access off the corporate network keeps S3 and S4 independent, and matches MM-ISAC's "brokered, named and temporary" vendor access through a site jump host.
- **Source / provenance:** assumed (design pattern from sourced: mmisac-ref-arch)
- **Owner change:**

## D-010 Fallbacks take over at once unless a delay is given
- **Decision:** `offline-ordering`, `offline-work-orders`, `payroll-continuity` and `local-identity` have no takeover delay. Only `site-authority` has one.
- **Reasoning:** For the four back-office fallbacks and local logins, the manual workaround already covers the first hours to days of the outage, so a takeover delay shorter than that changes nothing. Handing the fleet to site controllers has no such cover, so its delay matters and is stated (D-073).
- **Source / provenance:** assumed
- **Owner change:**

## D-011 The historian supports no process; the jump host takes the tier of what vendors can reach
- **Decision:** No process depends on `site-historian`, so it derives a low tier. No process depends on `vendor-jump-host` either, but the `vendor-monitoring` control relies on it. A detect-and-revoke control protects the processes that depend on the vendor service it watches, and also those that depend on any asset that service can reach (`reaches`: D-097, D-098). So the jump host takes the highest effective tier among the processes that depend on the crusher PLC or the conveyor PLC. Both are needed by crushing, which is high, so the jump host is high.
- **Reasoning:** The historian records plant data; the crusher keeps running without it. It is in the register for S4's list of what keeps running on site, and for the lab. No process needs vendor access to run, so a rule that counted only the processes depending on the watched service left the jump host low, even though in S3 it is what keeps the crusher safe. A vendor connection matters because of what it can reach on the site network, so the tier now follows that reach. Which assets each vendor reaches is a judgement, recorded per service. If a practitioner says the historian should rank higher, record it here.
- **Source / provenance:** assumed (tier rule: engine, `tiers.ts`)
- **Owner change:** 26 Oct 2026: the owner asked for service reach, so the jump host is no longer low. Before this, D-011 recorded both assets as low and named the jump host as a limit of the tier rules.

## D-012 Which scenarios hold their workarounds, and which are projections
- **Decision:** Only `s1-as-reported` sets `workaroundsHold: true` (the manual workarounds last the whole outage, as reported). Only `s1-projection` is labelled a projection. S2, S3 and S4 are model scenarios with a public basis: workarounds last as long as the register says, and they are not labelled projections.
- **Reasoning:** S1 replays a real incident, so it has a faithful version and a clearly labelled "what if". S2 to S4 do not replay what happened at any company; they use a public source only for their shape or duration.
- **Source / provenance:** assumed
- **Owner change:**

## D-013 The Northern Star supplier notice is not cited
- **Decision:** The register does not cite Northern Star's supplier notice about orders moving to email during the Scope outage.
- **Reasoning:** It was seen only in search results and never fetched, so it cannot be verified. Scope's own updates do confirm that customers ran "interim workarounds, such as upcoming payroll, invoicing, and receipts" by hand, and that is cited instead.
- **Source / provenance:** sourced: scope-incident-updates (Northern Star: unverified, not cited)
- **Owner change:**

## D-093 A post-restore hold can keep a dependency lost after its service is back
- **Decision:** A service dependency can carry a post-restore hold. After each outage of the service ends, that dependency alone stays lost for the hold's length, and gives what it gave during the outage: stop, the manual workaround (timed from the outage start), or a fallback. The service itself shows as back. A working `reconcile` control removes the hold. A hold that runs into the next outage joins the two.
- **Reasoning:** A restored system may not be usable at once: Scope told customers to expect a gap of up to one to two days of transactions to reconcile by hand (D-094). Putting the hold on the dependency, not the service, keeps the restore time as the source reports it and applies the hold only where the owner chose: purchasing.
- **Source / provenance:** modelling rule (engine, `simulate.ts`)
- **Owner change:** 26 Oct 2026: the owner chose to model Scope's recovery tail as a hold on new purchase orders (Plan 1 follow-up 1).

# Process tiers

## D-014 Haulage is high tier
- **Path:** processes.haulage.tier
- **Decision:** high
- **Reasoning:** Haulage feeds the crusher with only about half a day of ore on the ROM pad between them, and the autonomous fleet carries a direct safety function (keeping trucks and people apart).
- **Source / provenance:** assumed
- **Owner change:**

## D-015 Crushing is high tier
- **Path:** processes.crushing.tier
- **Decision:** high
- **Reasoning:** Every tonne shipped passes through the crusher. A crusher stop starts drawing down the product stockpile at once.
- **Source / provenance:** assumed
- **Owner change:**

## D-016 Rail is high tier
- **Path:** processes.rail.tier
- **Decision:** high
- **Reasoning:** Rail is the shipping process: production deferred and revenue at risk are counted from it.
- **Source / provenance:** assumed
- **Owner change:**

## D-017 The control room is high tier
- **Path:** processes.control-room.tier
- **Decision:** high
- **Reasoning:** Operators in the site control room run and can safely stop the crushing plant. Without it the crusher stops.
- **Source / provenance:** assumed
- **Owner change:**

## D-018 Remote operations is high tier
- **Path:** processes.remote-operations.tier
- **Decision:** high
- **Reasoning:** Perth supervises the autonomous fleet and controls the rail network (D-003). Losing it parks the fleet within the hour.
- **Source / provenance:** assumed
- **Owner change:**

## D-019 Drill and blast is medium tier
- **Path:** processes.drill-and-blast.tier
- **Decision:** medium
- **Reasoning:** A week of blasted ore in the pit (D-060) means a blasting stop takes days to reach haulage.
- **Source / provenance:** assumed
- **Owner change:**

## D-020 Diesel ordering is medium tier
- **Path:** processes.diesel-ordering.tier
- **Decision:** medium
- **Reasoning:** A week of fuel on site (D-056) buffers an ordering outage, so it is not high on its own. It still matters: MM-ISAC says an outage that stops a mine getting diesel "is still an operational outage", and the fleet parks if the fuel runs out.
- **Source / provenance:** assumed (principle from sourced: mmisac-ref-arch)
- **Owner change:**

## D-021 Explosives ordering is medium tier
- **Path:** processes.explosives-ordering.tier
- **Decision:** medium
- **Reasoning:** Same reasoning as diesel ordering, with the explosives magazine as the buffer.
- **Source / provenance:** assumed
- **Owner change:**

## D-022 Work orders are medium tier
- **Path:** processes.work-orders.tier
- **Decision:** medium
- **Reasoning:** Breakdown work can run on paper for days; planned maintenance slips but nothing stops at once. No physical process in this version depends on it directly.
- **Source / provenance:** assumed
- **Owner change:**

## D-023 Payroll is low tier
- **Path:** processes.payroll.tier
- **Decision:** low
- **Reasoning:** Low for production only: a late pay run does not stop the plant within the scenarios' horizons. It matters a great deal to people, which is why S1 still shows it and why `payroll-continuity` exists.
- **Source / provenance:** assumed
- **Owner change:**

# Dependencies

## D-024 Diesel ordering needs the hosted ERP
- **Path:** processes.diesel-ordering.dependsOn.hosted-erp
- **Decision:** stop, with a manual workaround (D-041) and a 24-hour hold after the restore (D-094)
- **Reasoning:** Purchase orders, approvals and supplier payments run in the hosted ERP. Without it no compliant order can be raised, except by the manual workaround.
- **Source / provenance:** assumed (Scope's customers lost their hosted ERP: sourced: scope-incident-updates)
- **Owner change:**

## D-025 Explosives ordering needs the hosted ERP
- **Path:** processes.explosives-ordering.dependsOn.hosted-erp
- **Decision:** stop, with a manual workaround (D-042) and a 24-hour hold after the restore (D-095)
- **Reasoning:** As for diesel ordering.
- **Source / provenance:** assumed
- **Owner change:**

## D-026 Work orders need the hosted ERP
- **Path:** processes.work-orders.dependsOn.hosted-erp
- **Decision:** stop, with a manual workaround (D-043)
- **Reasoning:** The maintenance system (work orders, parts, history) is a module of the hosted ERP on the model site.
- **Source / provenance:** assumed
- **Owner change:**

## D-027 Payroll needs the hosted ERP
- **Path:** processes.payroll.dependsOn.hosted-erp
- **Decision:** stop, with a manual workaround (D-044)
- **Reasoning:** Payroll runs in the hosted ERP. Scope named payroll among the interim manual workarounds its customers needed.
- **Source / provenance:** sourced: scope-incident-updates
- **Owner change:**

## D-028 Remote operations needs the Perth link
- **Path:** processes.remote-operations.dependsOn.iroc-link
- **Decision:** stop, no manual workaround
- **Reasoning:** Supervision from Perth is impossible without the link. Taking over on site is a prepared control (`site-authority`), not a workaround an unprepared site can improvise.
- **Source / provenance:** assumed
- **Owner change:**

## D-029 The control room needs its HMI
- **Path:** processes.control-room.dependsOn.control-room-hmi
- **Decision:** stop
- **Reasoning:** Operators cannot see or run the plant without the HMI.
- **Source / provenance:** assumed
- **Owner change:**

## D-030 The control room needs cloud logins
- **Path:** processes.control-room.dependsOn.cloud-identity
- **Decision:** stop, with a manual workaround of half a day (D-045)
- **Reasoning:** On the model site, control-room operators sign in with corporate cloud accounts. When the logins go, the current shift stays signed in, but the next shift cannot sign on.
- **Source / provenance:** assumed
- **Owner change:**

## D-031 Drill and blast needs explosives
- **Path:** processes.drill-and-blast.dependsOn.explosives
- **Decision:** stop when the magazine is empty
- **Reasoning:** No explosives, no blasting.
- **Source / provenance:** assumed
- **Owner change:**

## D-032 Haulage needs diesel
- **Path:** processes.haulage.dependsOn.diesel
- **Decision:** stop when the fuel farm is empty
- **Reasoning:** The model site's haul fleet runs on diesel.
- **Source / provenance:** assumed
- **Owner change:**

## D-033 Haulage needs blasted ore
- **Path:** processes.haulage.dependsOn.broken-ore
- **Decision:** stop when no blasted ore is left
- **Reasoning:** The fleet can only haul ore that has been blasted.
- **Source / provenance:** assumed
- **Owner change:**

## D-034 Haulage needs remote operations
- **Path:** processes.haulage.dependsOn.remote-operations
- **Decision:** stop
- **Reasoning:** The AHS fleet parks without supervision (D-003). When site controllers take over, haulage runs at a reduced rate rather than stopping.
- **Source / provenance:** assumed
- **Owner change:**

## D-035 Crushing needs ore on the ROM pad
- **Path:** processes.crushing.dependsOn.rom-pad
- **Decision:** stop when the ROM pad is empty
- **Reasoning:** The crusher is fed from the ROM pad.
- **Source / provenance:** assumed
- **Owner change:**

## D-036 Crushing needs the crusher PLC
- **Path:** processes.crushing.dependsOn.crusher-plc
- **Decision:** stop
- **Reasoning:** The PLC runs the crusher and its interlocks. If it trips, the crusher stops.
- **Source / provenance:** assumed
- **Owner change:**

## D-037 Crushing needs the conveyor PLC
- **Path:** processes.crushing.dependsOn.conveyor-plc
- **Decision:** stop
- **Reasoning:** Crushed ore leaves on the overland conveyor. The crusher cannot run if the conveyor is down.
- **Source / provenance:** assumed
- **Owner change:**

## D-038 Crushing needs the control room
- **Path:** processes.crushing.dependsOn.control-room
- **Decision:** stop
- **Reasoning:** The plant is run from the site control room. A control room that is locked out cannot run it safely.
- **Source / provenance:** assumed
- **Owner change:**

## D-039 Rail needs ore on the stockpile
- **Path:** processes.rail.dependsOn.ore-stockpile
- **Decision:** stop when the stockpile is empty
- **Reasoning:** Trains load from the product stockpile.
- **Source / provenance:** assumed
- **Owner change:**

## D-040 Rail slows without remote operations
- **Path:** processes.rail.dependsOn.remote-operations
- **Decision:** degrade, not stop
- **Reasoning:** Trains on the model site are controlled from Perth, as Rio Tinto's Pilbara trains are. The model assumes a local fallback that keeps trains running more slowly, so losing Perth slows rail rather than stopping it.
- **Source / provenance:** assumed (Perth control of trains: sourced: rio-tinto-wa-operations)
- **Owner change:**

# Vendor reach

## D-097 Vendor A reaches only the crusher PLC
- **Path:** services.vendor-a-access.reaches
- **Decision:** `crusher-plc`
- **Reasoning:** Vendor A is the crusher control vendor. A vendor typically reaches the plant equipment it maintains, and MM-ISAC asks for vendor access to be "brokered, named and temporary". So the site jump host brokers vendor A to the crusher PLC and nothing else (D-009). S3's compromise comes through vendor A and targets the crusher PLC, so the list must include it. Vendor A does not maintain the conveyor PLC or the control-room HMI, so it is not given them. A flatter network, where any vendor on the jump host can reach every PLC, would give both vendors both PLCs. The model site is assumed to broker each vendor to its own equipment. The jump host's tier does not depend on this choice, because both PLCs feed crushing; the judgement only constrains compromise targets and the Plan 3 network overlay.
- **Source / provenance:** assumed (practice from sourced: mmisac-ref-arch)
- **Owner change:** 26 Oct 2026: the owner asked for service reach (D-011).

## D-098 Vendor B reaches only the conveyor PLC
- **Path:** services.vendor-b-access.reaches
- **Decision:** `conveyor-plc`
- **Reasoning:** Vendor B is the conveyor drives vendor. The drives run under the overland conveyor PLC, the only conveyor equipment the register models, so that is what vendor B reaches. As for vendor A (D-097), the jump host brokers it to the equipment it maintains and nothing else. No scenario sends a compromise through vendor B; S3 shows it staying connected while vendor A is cut. The jump host's tier does not depend on this choice, because both PLCs feed crushing; the judgement only constrains compromise targets and the Plan 3 network overlay.
- **Source / provenance:** assumed (practice from sourced: mmisac-ref-arch)
- **Owner change:** 26 Oct 2026: the owner asked for service reach (D-011).

# Manual workarounds (unprepared site)

## D-041 Diesel orders by phone and email hold for 3 days
- **Path:** processes.diesel-ordering.dependsOn.hosted-erp.manualWorkaround.holdsFor
- **Decision:** 3 days
- **Reasoning:** In the real incident the manual workarounds held for all 12 days, and `s1-as-reported` shows that. This number is used only when a scenario lets workarounds run out (the projection). Three days is a judgement of how long suppliers keep delivering on emailed orders while invoices and payments cannot be processed. It is the number most worth challenging.
- **Source / provenance:** assumed
- **Owner change:**

## D-042 Explosives orders by phone and email hold for 3 days
- **Path:** processes.explosives-ordering.dependsOn.hosted-erp.manualWorkaround.holdsFor
- **Decision:** 3 days
- **Reasoning:** Same judgement as diesel (D-041).
- **Source / provenance:** assumed
- **Owner change:**

## D-043 Paper job cards hold for 3 days
- **Path:** processes.work-orders.dependsOn.hosted-erp.manualWorkaround.holdsFor
- **Decision:** 3 days
- **Reasoning:** Breakdown work can run on paper job cards, but after a few days planners lose track of planned work, parts reservations and history.
- **Source / provenance:** assumed
- **Owner change:**

## D-044 Hand-keyed pay holds for 7 days
- **Path:** processes.payroll.dependsOn.hosted-erp.manualWorkaround.holdsFor
- **Decision:** 7 days
- **Reasoning:** The payroll team can key one urgent pay run by hand. With fortnightly pay, about one week is the most it can cover before a second, fuller run is due.
- **Source / provenance:** assumed (payroll workarounds: sourced: scope-incident-updates)
- **Owner change:**

## D-045 The current shift stays signed in for half a day
- **Path:** processes.control-room.dependsOn.cloud-identity.manualWorkaround.holdsFor
- **Decision:** 0.5 days
- **Reasoning:** A 12-hour shift that was already signed in keeps working. The next shift cannot sign on.
- **Source / provenance:** assumed
- **Owner change:**

# Post-restore holds (unprepared site)

## D-094 Diesel orders are held for 24 hours after the ERP is back
- **Path:** processes.diesel-ordering.dependsOn.hosted-erp.afterRestore.holdFor
- **Decision:** 24 hours
- **Reasoning:** Scope told customers to expect a gap of up to one to two days of transactions to reconcile by hand. That is the size of the job, not how long it takes, so the 24 hours is a judgement: a day to match the orders placed by phone and email against what the restored ERP holds. Until that is done, a new purchase order could repeat one already sent, so the unprepared site holds new orders. Work orders and payroll have no hold: the owner scoped this to purchasing.
- **Source / provenance:** assumed (size of the job from sourced: scope-incident-updates)
- **Owner change:** 26 Oct 2026: the owner chose a 24-hour hold on purchasing only.

## D-095 Explosives orders are held for 24 hours after the ERP is back
- **Path:** processes.explosives-ordering.dependsOn.hosted-erp.afterRestore.holdFor
- **Decision:** 24 hours
- **Reasoning:** Same judgement as diesel (D-094).
- **Source / provenance:** assumed (size of the job from sourced: scope-incident-updates)
- **Owner change:** 26 Oct 2026: as D-094.

# Outage limits and recovery targets

## D-046 Diesel ordering: 5 days tolerable, 2 days to recover
- **Path:** processes.diesel-ordering.continuity.maxTolerableOutage
- **Path:** processes.diesel-ordering.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 120 hours; recovery target 48 hours
- **Reasoning:** Seven days of fuel (D-056) less the two-day rationing mark (D-057) gives five days before the fleet slows. Recovering within two days leaves margin.
- **Source / provenance:** assumed
- **Owner change:**

## D-047 Explosives ordering: 5 days tolerable, 2 days to recover
- **Path:** processes.explosives-ordering.continuity.maxTolerableOutage
- **Path:** processes.explosives-ordering.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 120 hours; recovery target 48 hours
- **Reasoning:** Same arithmetic as diesel, on the explosives magazine (D-059).
- **Source / provenance:** assumed
- **Owner change:**

## D-048 Work orders: 3 days tolerable, 1 day to recover
- **Path:** processes.work-orders.continuity.maxTolerableOutage
- **Path:** processes.work-orders.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 72 hours; recovery target 24 hours
- **Reasoning:** Matches the paper job cards' three days (D-043).
- **Source / provenance:** assumed
- **Owner change:**

## D-049 Payroll: 7 days tolerable, 3 days to recover
- **Path:** processes.payroll.continuity.maxTolerableOutage
- **Path:** processes.payroll.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 168 hours; recovery target 72 hours
- **Reasoning:** With fortnightly pay, the next pay day is on average a week away. Three days to recover leaves time to run and check a pay run.
- **Source / provenance:** assumed
- **Owner change:**

## D-050 Remote operations: 4 hours tolerable, 2 hours to recover
- **Path:** processes.remote-operations.continuity.maxTolerableOutage
- **Path:** processes.remote-operations.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 4 hours; recovery target 2 hours
- **Reasoning:** The fleet parks at once without supervision. Two hours matches the site handover delay (D-073). Note that the readiness check counts running under site control as an outage of this process, because remote operations is not doing its job.
- **Source / provenance:** assumed
- **Owner change:**

## D-051 Control room: 4 hours tolerable, 1 hour to recover
- **Path:** processes.control-room.continuity.maxTolerableOutage
- **Path:** processes.control-room.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 4 hours; recovery target 1 hour
- **Reasoning:** The crusher stops when the control room does. A few hours of lost crushing is absorbed by the stockpile; more starts to bite.
- **Source / provenance:** assumed
- **Owner change:**

## D-052 Drill and blast: 5 days tolerable, 2 days to recover
- **Path:** processes.drill-and-blast.continuity.maxTolerableOutage
- **Path:** processes.drill-and-blast.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 120 hours; recovery target 48 hours
- **Reasoning:** A week of blasted ore (D-060) less the two-day low mark (D-061).
- **Source / provenance:** assumed
- **Owner change:**

## D-053 Haulage: 12 hours tolerable, 4 hours to recover
- **Path:** processes.haulage.continuity.maxTolerableOutage
- **Path:** processes.haulage.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 12 hours; recovery target 4 hours
- **Reasoning:** The ROM pad holds half a day of crusher feed (D-063). After that the crusher stops.
- **Source / provenance:** assumed
- **Owner change:**

## D-054 Crushing: 2 days tolerable, 12 hours to recover
- **Path:** processes.crushing.continuity.maxTolerableOutage
- **Path:** processes.crushing.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 48 hours; recovery target 12 hours
- **Reasoning:** Three days on the product stockpile (D-066) less the one-day low mark (D-067).
- **Source / provenance:** assumed
- **Owner change:**

## D-055 Rail: 1 day tolerable, 12 hours to recover
- **Path:** processes.rail.continuity.maxTolerableOutage
- **Path:** processes.rail.continuity.recoveryTarget
- **Decision:** maximum tolerable outage 24 hours; recovery target 12 hours
- **Reasoning:** Missed train paths turn into missed ship loadings within about a day.
- **Source / provenance:** assumed
- **Owner change:**

# Stocks

## D-056 Diesel on site: 7 days of normal use
- **Path:** stocks.diesel.capacity
- **Path:** stocks.diesel.initial
- **Decision:** 7 days, starting full
- **Reasoning:** Fuel comes by road from the coast, hundreds of kilometres away, and wet-season road closures happen. About a week of storage is a judgement, not a figure from any site; a practitioner should check it.
- **Source / provenance:** assumed
- **Owner change:**

## D-057 Diesel rationing starts at 2 days
- **Path:** stocks.diesel.lowThreshold
- **Decision:** 2 days
- **Reasoning:** Below two days the site would ration fuel to essential and safety vehicles, so the haul fleet slows.
- **Source / provenance:** assumed
- **Owner change:**

## D-058 Diesel refills at 1 day per day
- **Path:** stocks.diesel.refillRate
- **Decision:** 1 day of stock gained per day while ordering runs
- **Reasoning:** Deliveries can bring in about twice the daily use, so the fuel farm refills from empty in about a week.
- **Source / provenance:** assumed
- **Owner change:**

## D-059 Explosives in the magazine: 7 days, low at 2 days, refills at 1 day per day
- **Path:** stocks.explosives.capacity
- **Path:** stocks.explosives.initial
- **Path:** stocks.explosives.lowThreshold
- **Path:** stocks.explosives.refillRate
- **Decision:** 7 days, starting full; blasting is rationed below 2 days; refills at 1 day per day
- **Reasoning:** The same week of cover and the same delivery logic as diesel. No public figure was found for a Pilbara magazine.
- **Source / provenance:** assumed
- **Owner change:**

## D-091 Diesel takes 36 hours from order to delivery
- **Path:** stocks.diesel.leadTime
- **Decision:** 36 hours
- **Reasoning:** Bulk diesel for an inland Pilbara mine comes by road train from the coast (Port Hedland), a drive of roughly five to eight hours. Most of the lead time is the supplier's dispatch: an order placed today is usually loaded and sent the next day, and road-train fatigue rules and remote-area scheduling add to that. That puts order to delivery at about one to two days; the model takes the middle, 36 hours. It is a judgement, not a figure from any supplier; a practitioner should check it.
- **Source / provenance:** assumed
- **Owner change:**

## D-092 Explosives take 72 hours from order to delivery
- **Path:** stocks.explosives.leadTime
- **Decision:** 72 hours (3 days)
- **Reasoning:** Bulk explosives (ammonium nitrate and emulsion) come from a licensed supplier and travel as dangerous goods, with licensed carriers, set routes and a booked receipt at the magazine. That makes them slower to arrange than fuel: a few days from order to delivery. The model takes 3 days. No public figure was found for a Pilbara site; a practitioner should check it.
- **Source / provenance:** assumed
- **Owner change:**

## D-060 Blasted ore in the pit: 7 days
- **Path:** stocks.broken-ore.capacity
- **Path:** stocks.broken-ore.initial
- **Decision:** 7 days, starting full
- **Reasoning:** Mines keep blasted ore ahead of the diggers so a blasting delay does not stop haulage. A week is a judgement.
- **Source / provenance:** assumed
- **Owner change:**

## D-061 Blasted ore is low at 2 days
- **Path:** stocks.broken-ore.lowThreshold
- **Decision:** 2 days
- **Reasoning:** Below two days, diggers wait on blasts and haulage slows.
- **Source / provenance:** assumed
- **Owner change:**

## D-062 Blasted ore rebuilds at half a day per day
- **Path:** stocks.broken-ore.refillRate
- **Decision:** 0.5 days per day
- **Reasoning:** Drill and blast can only run modestly ahead of haulage, so the inventory rebuilds slowly.
- **Source / provenance:** assumed
- **Owner change:**

## D-063 The ROM pad holds half a day of crusher feed
- **Path:** stocks.rom-pad.capacity
- **Path:** stocks.rom-pad.initial
- **Decision:** 0.5 days (12 hours), starting full
- **Reasoning:** The ROM pad is a short buffer between trucks and crusher, hours to about a day. Half a day is in that range.
- **Source / provenance:** assumed
- **Owner change:**

## D-064 The ROM pad is low at 3 hours
- **Path:** stocks.rom-pad.lowThreshold
- **Decision:** 0.125 days (3 hours)
- **Reasoning:** With a few hours of feed left, the crusher is run at a reduced rate to stretch it.
- **Source / provenance:** assumed
- **Owner change:**

## D-065 The ROM pad rebuilds at half a day per day
- **Path:** stocks.rom-pad.refillRate
- **Decision:** 0.5 days per day
- **Reasoning:** The fleet can haul somewhat faster than the crusher eats.
- **Source / provenance:** assumed
- **Owner change:**

## D-066 The product stockpile holds 3 days of rail loading
- **Path:** stocks.ore-stockpile.capacity
- **Path:** stocks.ore-stockpile.initial
- **Decision:** 3 days, starting full
- **Reasoning:** A stockpile at the train load-out lets trains keep loading through short crusher stops. Copper Mountain kept shipping from inventory through its five-day shutdown; three days is a judgement for the model site, not taken from that case.
- **Source / provenance:** assumed (stockpile buffering shipments: sourced: kitco-copper-mountain)
- **Owner change:**

## D-067 The product stockpile is low at 1 day
- **Path:** stocks.ore-stockpile.lowThreshold
- **Decision:** 1 day
- **Reasoning:** Below a day, train loadings are cut back to stretch what is left.
- **Source / provenance:** assumed
- **Owner change:**

## D-068 The product stockpile rebuilds at half a day per day
- **Path:** stocks.ore-stockpile.refillRate
- **Decision:** 0.5 days per day
- **Reasoning:** The crusher has some spare capacity over rail's draw.
- **Source / provenance:** assumed
- **Owner change:**

# Controls (prepared site)

## D-069 Offline ordering covers diesel and explosives
- **Decision:** Fallbacks for diesel and explosives ordering when the hosted ERP is lost; no takeover delay (D-010).
- **Reasoning:** MM-ISAC asks sites to keep approved suppliers, specifications, lead times and "authority to place emergency orders" locally, with offline numbering and a way to reconcile later. That is what this control stands for.
- **Source / provenance:** assumed (practice from sourced: mmisac-ref-arch)
- **Owner change:**

## D-070 Offline work orders rely on a site app
- **Decision:** Fallback for work orders when the hosted ERP is lost, relying on the `offline-wo-app` asset.
- **Reasoning:** MM-ISAC lists offline work-order processes among what must stay available locally. If the app is down, the control does not apply.
- **Source / provenance:** assumed (practice from sourced: mmisac-ref-arch)
- **Owner change:**

## D-071 Payroll continuity reuses the last pay run
- **Decision:** Fallback for payroll when the hosted ERP is lost: the last pay file is reused and corrected afterwards.
- **Reasoning:** Staff are paid on time; differences are fixed in the next run.
- **Source / provenance:** assumed
- **Owner change:**

## D-072 The site's own ERP restore takes 2 days
- **Path:** controls.independent-erp-restore.effects[0].duration
- **Decision:** 48 hours
- **Reasoning:** Two days to bring the ERP back from the site's own tested backup on standby hardware, including checking the data. One practitioner was quoted saying miners with their own well-tested backups restored quickly; that is a single quote and gives no number. This is a modelled duration, never a lab timing: a lab restore time for a mock ERP says nothing about a real one. It does not help in S4, where the ERP is down because the corporate network is cut, not because the ERP itself failed. The register's continuity fields describe the baseline (unprepared) site, so the four ERP-backed processes record `independentCopy: false`: the baseline site has no copy of its own. The prepared value is derived, not recorded: on the prepared site, a working control that restores a business application (`enterprise-app`) whose data the process depends on gives the process an independent copy (engine, `continuity.ts`). The application must be a direct dependency, or be reached from one only through other business applications; restoring a network link, identity, remote-ops or vendor-access service is not a copy of anyone's data. So the four ERP-backed processes show an independent copy on the prepared site through this control, and the pack shows both values. A copy covers loss of the ERP itself, not loss of the route to it (see S4 readiness). No restore has been tested yet, so no process records a `lastRestoreTest`.
- **Source / provenance:** assumed (the quote: sourced: miningcom-scope-oped)
- **Owner change:**

## D-073 Site controllers take over the fleet in 2 hours
- **Path:** controls.site-authority.effects[0].delay
- **Decision:** 2 hours
- **Reasoning:** Time for trained site controllers to reach the console, confirm where every truck is and take authority, with only one authority active at a time, as MM-ISAC requires. The fleet stays parked until then.
- **Source / provenance:** assumed (handover requirement from sourced: mmisac-ref-arch)
- **Owner change:**

## D-074 Local logins keep the control room running
- **Decision:** Fallback for the control room when cloud logins are lost, relying on the `site-identity` asset.
- **Reasoning:** MM-ISAC asks for "locally usable identity" on site.
- **Source / provenance:** assumed (practice from sourced: mmisac-ref-arch)
- **Owner change:**

## D-075 Vendor monitoring catches vendor A within 30 minutes
- **Path:** controls.vendor-monitoring.effects[0].duration
- **Decision:** 0.5 hours from the change to vendor A's access being revoked
- **Reasoning:** A monitored jump host can flag an out-of-hours write to a PLC and an on-call engineer can revoke one vendor's session within half an hour. This is the one duration the lab may later measure directly, because detecting and revoking a session is comparable at lab scale.
- **Source / provenance:** assumed
- **Owner change:**

## D-076 Vendor monitoring catches vendor B within 30 minutes
- **Path:** controls.vendor-monitoring.effects[1].duration
- **Decision:** 0.5 hours
- **Reasoning:** The same monitoring covers both vendors. Revoking one vendor leaves the other connected, which S3 shows.
- **Source / provenance:** assumed
- **Owner change:**

## D-096 Duplicate rejection lets ordering restart as soon as the ERP is back
- **Decision:** A `duplicate-rejection` control with `reconcile` effects on the hosted-ERP dependencies of diesel and explosives ordering. It removes their post-restore hold (D-094, D-095). It has no duration and relies on no asset.
- **Reasoning:** MM-ISAC asks sites to "verify that stale or duplicate transactions are rejected" when systems come back. If they are rejected automatically, new orders cannot duplicate old ones, so the site orders at once and reconciles alongside. It is not offline ordering (D-069): that keeps orders going during the outage; this makes ordering safe straight after it. Not yet tested; the lab will count the stale and duplicate transactions rejected on reconnect.
- **Source / provenance:** assumed (requirement from sourced: mmisac-ref-arch)
- **Owner change:** 26 Oct 2026: the owner chose to add this control with the hold.

# Scenarios

## D-077 S1 as reported: the hosted ERP is cut for 12 days
- **Path:** scenarios.s1-as-reported.events[0].restoreAfter
- **Decision:** 288 hours (12 days)
- **Reasoning:** Scope's disruption began in the early hours of 5 May 2026, and "As of Sunday 17 May, all client servers have been restored". Restoration was staged (about 20% on 10 May, 53% on 12 May, 80% on 14 May, 100% on 17 May); the model site is placed in the last group, so it waits the full 12 days.
- **Source / provenance:** sourced: scope-incident-updates
- **Owner change:**

## D-078 S1 as reported starts at hour 0 and runs 14 days
- **Path:** scenarios.s1-as-reported.events[0].at
- **Path:** scenarios.s1-as-reported.horizon
- **Decision:** the cut at hour 0; a 14-day run
- **Reasoning:** The timeline starts with the cut. Two days after the restore show the site settling. Ordering stays on its workaround for a further 24 hours after the restore (assumed, D-094); this tail is not from the public record.
- **Source / provenance:** assumed
- **Owner change:**

## D-079 S1 projection: the same 12 days; only the workarounds change
- **Path:** scenarios.s1-projection.events[0].restoreAfter
- **Decision:** 288 hours (12 days), the same sourced restore as S1 as reported. The only counterfactual is that the manual workarounds run out (D-041 to D-044).
- **Reasoning:** Revenue at risk (about $6.0M) rests on two assumed numbers. Change either and the figure changes (checked against the engine, unprepared, one number changed at a time):
  - How long phone-and-email ordering keeps going without the ERP (`manualWorkaround.holdsFor`, D-041): 3 days. At 0 days, about $25.65M is at risk; from about 3.6 days (87 hours) up, $0.
  - How long new purchase orders are held after the ERP is back (`afterRestore.holdFor`, D-094): 24 hours. Up to 9 hours, $0; any longer hold puts revenue at risk (about $0.14M at 10 hours); at 48 hours, about $8.92M.
  - Outage: the workarounds end at hour 72 and ordering stops, but fuel already on the road keeps arriving for another 36 hours (D-008, D-091). The fuel farm empties and the fleet parks at hour 276, 12 hours before the restore; the crusher stops at hour 288 as the ROM pad runs out.
  - Recovery: the ERP is back at hour 288, but new orders are held for 24 hours (D-094, D-095), so ordering restarts at hour 312. The first diesel arrives 36 hours later: the fleet restarts at hour 349, still rationed, and is not back to normal when the run ends; the crusher restarts at hour 350. The fleet is parked for 73 hours and the crusher for 62.
  - Shipping: the product stockpile falls below its one-day mark at hour 336, so trains are cut back for 43 hours, to a low of about 0.4 days; rail never stops. About $6.0M is at risk unprepared and $0 prepared: the independent restore and offline ordering keep fuel coming; duplicate rejection also lifts the hold.
  - Explosives: the magazine stays full until hour 144 and runs out at hour 312; the first explosives ordered after the hold arrive in hour 384, the run's last, so blasting is stopped at the end.
  - Before the hold: the fleet was parked for 49 hours, the crusher for 38, the stockpile held at about 1.4 days, and revenue at risk was $0.
  - Sensitivity of the hold (run after the result, no value changed): $0 up to 9 hours; revenue at risk above 9 hours; at 48 hours, rail also stops for 15 hours.
  - Lead-time margin: the fleet parks before the restore only while the diesel lead time is under 48 hours; at 48 hours, the top of D-091's range, it parks in the restore hour.
  - An earlier draft lengthened this restore to three weeks so that shipments would be hit; that was tuning to a test and was reverted. Neither the restore nor the run length was changed for the hold.
- **Source / provenance:** sourced: scope-incident-updates
- **Owner change:** 28 Oct 2026: controller correction. Before this, the entry said the revenue at risk came entirely from the 24-hour hold and was $0 below a 10-hour hold. The phone-and-email workaround's 3 days (D-041) moves it as well, and the site's caveat names both, so the entry now says it rests on two assumed numbers. The hold's $0 boundary is 9 hours: a 9.5-hour hold already puts about $0.14M at risk.

## D-080 S1 projection starts at hour 0 and runs 16 days
- **Path:** scenarios.s1-projection.events[0].at
- **Path:** scenarios.s1-projection.horizon
- **Decision:** the cut at hour 0; a 16-day run
- **Reasoning:** The 12-day outage plus the days the fuel farm needs to refill past its rationing mark, chosen so the run ended with haulage back to normal. With the delivery lead times (D-091, D-092) and the post-restore hold (D-094, D-095) it no longer does: the fleet restarts at hour 349 but is still rationed at hour 384, and blasting is stopped, because the first explosives after the hold arrive in the last hour. The run length was not changed for the lead times or the hold.
- **Source / provenance:** assumed
- **Owner change:**

## D-081 S2: the Perth link is lost for a day
- **Path:** scenarios.s2-iroc-lost.events[0].restoreAfter
- **Decision:** 24 hours
- **Reasoning:** No public incident gives a duration for losing a Perth operations link. A day is long enough to show the fleet parking and the site taking over.
- **Source / provenance:** assumed
- **Owner change:**

## D-082 S2 starts at hour 0 and runs 3 days
- **Path:** scenarios.s2-iroc-lost.events[0].at
- **Path:** scenarios.s2-iroc-lost.horizon
- **Decision:** the cut at hour 0; a 3-day run
- **Reasoning:** Covers the outage and two days of recovery.
- **Source / provenance:** assumed
- **Owner change:**

## D-083 S3: the vendor change lands at 2 am
- **Path:** scenarios.s3-vendor-setpoint.events[0].at
- **Decision:** hour 2 (2 am, taking hour 0 as midnight)
- **Reasoning:** Out of hours, when nobody expects a vendor to be working on the crusher.
- **Source / provenance:** assumed
- **Owner change:**

## D-084 S3: an unnoticed setpoint change keeps the crusher down for 12 hours
- **Path:** scenarios.s3-vendor-setpoint.events[0].downFor
- **Decision:** 12 hours
- **Reasoning:** The crusher trips; the plant team then has to find the cause, restore known-good settings and recommission. About a shift. Labelled as an assumption, as the spec requires.
- **Source / provenance:** assumed
- **Owner change:**

## D-085 S3 runs 2 days
- **Path:** scenarios.s3-vendor-setpoint.horizon
- **Decision:** 48 hours
- **Reasoning:** Covers the outage and recovery.
- **Source / provenance:** assumed
- **Owner change:**

## D-086 S4: the corporate network is isolated for 5 days
- **Path:** scenarios.s4-precautionary-isolation.events[0].restoreAfter
- **Decision:** 120 hours (5 days)
- **Reasoning:** Copper Mountain was hit by ransomware on 27 December 2022, shut its mill as a precaution and restarted the primary crusher on 1 January 2023: five days. The model uses that length as a proxy for a precautionary isolation of the corporate network. The source measures the crusher shutdown, not the isolation itself, so the value is labelled assumed. Copper Mountain kept shipping from inventory throughout; the model site's three-day stockpile (D-066) does not stretch that far, which is a property of the model site, not a claim about Copper Mountain.
- **Source / provenance:** assumed (proxy from sourced: kitco-copper-mountain)
- **Owner change:**

## D-087 S4 starts at hour 0 and runs 8 days
- **Path:** scenarios.s4-precautionary-isolation.events[0].at
- **Path:** scenarios.s4-precautionary-isolation.horizon
- **Decision:** the cut at hour 0; an 8-day run
- **Reasoning:** Copper Mountain's mill was at full production on 4 January, eight days after the attack.
- **Source / provenance:** assumed (timing from sourced: kitco-copper-mountain)
- **Owner change:**

# Production

## D-088 The site ships 25 million tonnes a year
- **Path:** production.annualTonnes
- **Decision:** 25 Mt/a
- **Reasoning:** A mid-size Pilbara mine: smaller than the largest hubs, larger than a single small pit. These are wet tonnes, as Pilbara producers report them, while the price (D-089) is per dry tonne, so revenue at risk is on the high side.
- **Source / provenance:** assumed
- **Owner change:**

## D-089 Iron ore price: US$97.70 a tonne
- **Path:** production.price
- **Decision:** 97.7 USD/t
- **Reasoning:** The World Bank Pink Sheet (2 October 2026) gives a September 2026 monthly average of 97.7 US$/dmt for iron ore fines, 62% Fe, spot, CFR China. That is a China benchmark, not a price received at a Pilbara mine: freight and grade discounts are not taken off, so revenue at risk per tonne is on the high side.
- **Source / provenance:** sourced: worldbank-pink-sheet-oct-2026
- **Owner change:**

## D-090 Rail ships half its normal tonnes when degraded
- **Path:** production.degradedOutput
- **Decision:** 0.5
- **Reasoning:** Under local control, or with loadings cut back on a low stockpile, about half the usual trains run.
- **Source / provenance:** assumed
- **Owner change:**

# The website

## D-099 Display rules map engine state to art, never to a number
- **Decision:** The haul fleet is drawn as an illustrative eight trucks: all moving when haulage is normal, four moving and four parked when degraded, none moving when stopped. The train runs at full speed when rail is normal, half speed when degraded, and stands when stopped. The stockpile, ROM pad and fuel-tank fill heights are the stock level over its capacity. No truck count is shown as a number: the panel says "Fleet rationed" or similar, never "3 of 8".
- **Reasoning:** The scene shows state by shape; numbers on screen come only from the register or a run, with their provenance tags. Eight trucks is an illustration, not a modelled fleet size, so it must not read as one.
- **Source / provenance:** assumed
- **Owner change:**

## D-100 The board is 1,600 × 1,000 m
- **Decision:** The board grows from 720 × 480 m to 1,600 × 1,000 m, with zoom and pan and a default framing on the pit, ROM pad and crusher. The rail balloon loop has a radius of at least 200 m, and the explosives magazine sits at least 500 m from the workshop, fuel farm and camp. Plan 2b builds it and updates DESIGN.md's Layout section; Plan 2a's schematic keeps the same proportions.
- **Reasoning:** The 720 × 480 m board forced a rail loop of about 82 m radius and a magazine too close to the workshop, fuel farm and camp, neither of which a real site would have. The new sizes are assumed values, chosen to be credible rather than to match a particular mine.
- **Source / provenance:** assumed
- **Owner change:**

## D-101 Free play is a projection the visitor sets up
- **Decision:** A free-play run is a projection (`projection: true`) with no basis (`basis: []`). The visitor chooses whether manual workarounds hold. Blank free play defaults to "workarounds don't hold". When free play starts from a register scenario, it inherits that scenario's cuts and its `workaroundsHold` (ruling R4). Compromise events are not carried over, so free play is cut-only; while the current register scenario has a compromise event, the free-play controls say "Vendor tampering isn't editable in free play; cuts only." Every value the visitor chooses (each cut's start and length, and the horizon) arrives as an override, so it is labelled "changed by you". The horizon is in days: the latest cut end plus 4 days, clamped to between 1 and 400 days, and 1 day when there are no cuts.
- **Reasoning:** A visitor's what-if is not a public record, so it is never shown as one. Routing the visitor's values through overrides reuses the provenance machinery that already marks edited inputs, rather than inventing a second label. The 4-day margin shows the recovery after the last cut.
- **Source / provenance:** modelling rule (site, `freePlay.ts`)
- **Owner change:**

## D-102 Every service a scenario can cut has its own card and cable
- **Decision:** The stage shows five service cards and five cables: Hosted ERP, Cloud logins, Perth operations link, Corporate network, and Vendor remote access. Vendor remote access is one card and one cable with a row per vendor (vendor A and vendor B), each with its own status line and Cut/Restore button; the shared cable shows the worse of the two states. Card names are the register's service names, except "Hosted ERP" (the register name lists its modules and does not fit a card) and "Vendor remote access" (the card has no register entry of its own). A service brought down by another shows "Down via" the cause the run names.
- **Reasoning:** Controller ruling R3. The corporate network is the lever in the precautionary isolation scenario, so it needs a card the visitor can cut, and the vendor scenario only revokes vendor A, which a single vendor status line would hide.
- **Source / provenance:** modelling rule (site, `serviceGroups.ts`)
- **Owner change:**

## D-103 Guided steps run in hour order within each segment
- **Decision:** Within each segment of the guided run, the steps are sorted by hour, so the clock only ever travels forward; moving between segments is a jump. Each segment's intro line is read before its first step's own caption, never in place of it.
- **Reasoning:** On the prepared site the independent restore brings the ERP back at hour 48, before the fallback moments (fuel ordering at 72, the fleet at 276) taken from the projection. In the brief's order the clock would have had to run backward.
- **Source / provenance:** modelling rule (site, `guided.ts`)
- **Owner change:**
