# FailLocal: design

**Status:** draft for approval · 22 October 2026
**Predecessor:** `~/Documents/Hyperresearch/project-ideas/01-mine-site-resilience-map.md` (the original idea and its evidence). Full research report: `~/Documents/Hyperresearch/research/notes/final_report_mining-tech-pain-points-a37b83.md`.

Decisions are tagged **[user]** where the owner decided them in conversation and **[my call]** where they were delegated to the designer. Anything tagged [my call] can be challenged.

---

## 1. Intent

The owner is graduating in cyber security in Perth and wants a place in a major miner's technology graduate program (BHP, Rio Tinto, South32; 2028 intake, applications roughly Feb–Apr 2027). FailLocal is a portfolio project built to get the interview.

The reaction it is designed to produce **[user]**: *"This person is genuinely interested in our industry and has been actively working on something relevant to it. I want to talk to them."* It is not trying to prove production-grade OT security skill. It is trying to show sustained, informed interest, plus enough real technical work that a security interviewer finds something to dig into.

Second job: it gives the owner concrete material for the interview itself (STAR stories, decisions they can defend, a story about changing their mind after practitioner feedback).

### What it is, in one paragraph
A playable website showing an illustrated, animated, **fictional** Pilbara iron ore mine. Visitors cut the outside services the site depends on (hosted ERP, cloud login, the Perth remote operations centre, vendor remote access) and watch what stops, when, and what it costs, then run the same cut on a *prepared* version of the site and see the difference. Under the visuals is a real dependency register, a real propagation engine and a real Docker lab whose test runs supply the measured numbers.

## 2. Audience and how they find it

| Who | What they know | What they need from FailLocal |
|---|---|---|
| In-house recruiters at BHP / Rio / South32 **[user]** | Mining, yes. Cyber/OT security, mostly no. | Get the point in 60–90 seconds, see it looks professional, feel the candidate "gets" mining. |
| Interview panel, often operations-side leaders | Operations deeply | Operational outcomes first: availability, recovery time, production deferred. |
| Technical / security interviewer | OT security | Something real one click deeper: the network view, the register, the lab evidence, the repo. |

Discovery path **[user]**: LinkedIn posts, the owner's personal website, the projects section of their CV. All end in one link a visitor can click and play with in a browser.

**Language rule [user + my call]:** mining vocabulary is welcome on the front (crusher, ROM pad, dispatch, IROC, shutdown). Security vocabulary (CVSS, Purdue levels, zones and conduits, KEV) stays in side panels, the network overlay and the write-up.

## 3. Goals, non-goals, anti-goals

### Goals
1. A visitor who knows mining but not security understands, within ~90 seconds, that an outside-service outage can stop a healthy mine, and that preparation changes the outcome.
2. Every visual is driven by real, inspectable substance (see §5).
3. Demonstrates OT security thinking, not only business continuity: asset-to-process mapping, segmentation / fail-local design, precautionary isolation, control authority, vendor remote access control, consequence-based prioritisation, and one in-control-system detection (§4.4).
4. Produces usable outputs: a continuity data pack (PDF) and an asset-tier table in the shape MM-ISAC's *Mining OT Reference Architecture* asks for.
5. The register format and engine are open source and documented, so someone else could describe their own site and get the same analysis. **[my call, accepted]**
6. Released in public in stages, gathering practitioner feedback before applications open. **[user]**

### Non-goals
- Not a model of any real company's site. It is a fictional mine and says so (§5.1). **[user]**
- Not a compliance tool. Mining is not a SOCI Act sector, so it is not pitched as compliance.
- Not a live, internet-reachable lab. The public site never talks to the lab. **[user agreed]**
- Not a claim that the owner's design would have beaten Scope Systems' real restore. Lab timings are not comparable with a vendor restoring hundreds of client servers.
- Not a full ICS testbed. The lab contains only what the scenarios need.

### Anti-goals: failure even if it technically works [user]
- **Pretty visuals without substance.** If a technical interviewer opens the repo and finds a hand-animated timeline, the project has failed.
- **Breaking in front of a recruiter.** A broken link, a blank canvas on a phone or a 10-second load is worse than no project.
- **Overclaiming.** Implying that a real miner's trucks stopped, presenting a guess as a measurement, or presenting synthetic data as real mine data would undo the credibility the project exists to build.

## 4. The experience

### 4.1 Flow [user]
1. **Welcome page.** A concise explanation of what the visitor is about to see and why it was made, grounded in the research (Scope Systems May 2026, the MM-ISAC reference architecture, BHP/Rio risk disclosures), with links to sources. It states clearly that the site is a fictional model mine and the incidents are examples. It has a "Show me" button and a 2–3 minute video walkthrough as a fallback for visitors who won't click around.
2. **Guided run.** About 60–90 seconds, captioned and skippable. It plays the hero scenario (Hosted ERP lost) on the unprepared site, then the same cut on the prepared site, ending on the revenue-at-risk comparison.
3. **Free play.** Full control: every cut button, the unprepared/prepared toggle, the assumptions editor, the network overlay, the side panels.

### 4.2 The site view [user: option C, site plan first, detail on click]
- **An illustrated, animated, top-down (or isometric, see §8) iron ore site:** pit with haul trucks on the ramps, ROM pad and crusher, conveyor, stockpile, rail loop with ore trains heading to port, fuel farm, workshop, explosives magazine, offices. Everything moves when healthy. **[user]** It must look polished and professional, not like a student dashboard. **[user]**
- **Process cards** below or beside the scene for the processes that keep the mine supplied: diesel ordering, explosives ordering, work orders / maintenance, payroll, plus dispatch and control. Each has a status (normal / degraded / stopped) and a plain-English line ("Diesel ordering stopped: purchase orders by email").
- **Outside services** along the edge (hosted ERP, cloud login, Perth IROC link, vendor remote access), each with a **cut** control.
- **Day counter:** cutting a service starts simulated time, and effects build up in realistic order: back-office processes fail first, physical operations slow later as stocks run down.
- **Side panel** when any process is clicked: its dependencies (application, login, network, API, provider, hosting tier), maximum tolerable outage, recovery target, whether an independent copy exists, the last restore test and its result, and the accountable owner (the MM-ISAC continuity-pack fields).
- **Unprepared / prepared toggle:** the same site with and without resilience controls (offline work-order path, local identity, standing orders, independently tested restore, brokered vendor access, and so on).
- **Revenue counter [user]:** labelled "production deferred / revenue at risk", not "lost" **[my call]**. Built from visible inputs (mine size in Mtpa, iron ore price, rail/ship rate, stockpile buffer); clicking it shows the working. The headline comparison is the gap between unprepared and prepared ("being prepared protected $X").
- **"Show the network" toggle [my call, accepted]:** overlays zones, links and assets on the illustrated site, so one click turns the recruiter view into the security view.
- **Assets tab:** the network graph view, with each asset tagged by process area, tier and zone, and vulnerabilities ranked by tier × exposure × availability plus KEV matches, following MM-ISAC's "prioritize by operational risk, not CVSS alone". Highlights "the assets that would stop the crusher".
- **Assumptions editor (desktop):** visitors can change key register values (days of diesel on site, mine size, ore price) and watch the outcome change. This is the visible proof that the animation is computed (§5.2).

### 4.3 Supporting pages
- **How this was tested:** per scenario, what was run in the lab, when, what was measured, with logs, detections and short screen recordings. Each scenario on the site carries a line like "measured in lab run, 14 Dec 2026" linking here.
- **Sources:** every public source used, with what was taken from each.
- **How I built this [user]:** short and honest: what the owner decided, what Claude Code wrote, how it was checked, what was learned. Framed as AI usage being a professional skill. Mirrored in the README.
- **Limitations:** synthetic data (no public mine OT data exists, a documented research gap), lab timings not comparable with real vendors, scenarios faithful to the public record but not validated on a mine.

### 4.4 Scenarios [user agreed]

| # | Scenario | Public basis | What the engine shows (unprepared → prepared) | What the lab measures |
|---|---|---|---|---|
| S1 (hero) | **Hosted ERP lost** | Scope Systems, Perth, May 2026: <24 h attacker access, restore from 3 May backups at 20 / 53 / 80 / 100% on 10 / 12 / 14 / 17 May, 1–2 days of transactions reconciled by hand, purchase orders moved to email (Northern Star supplier notice). | Purchasing, explosives, work orders and payroll degrade or stop; if workarounds fail, diesel and explosives stocks run down, the fleet parks, the crusher idles with nothing broken, trains draw down the stockpile. Prepared: offline paths hold, independent restore in hours, stale/duplicate transactions rejected on reconnect. | Restore time of the mock ERP from an independent backup; offline work-order path keeps working during the cut; count of stale/duplicate transactions rejected on reconnect. |
| S2 | **Perth IROC link lost** | MM-ISAC fail-local rule: authority returns to site. Pilbara mines run from Perth, 1,000–1,500 km away. | Unprepared: remote-controlled functions pause and authority is ambiguous. Prepared: clean handover to site, one active authority, stale remote commands rejected. | Handover time; a stale remote command injected after reconnect is rejected. |
| S3 | **Vendor pushes an out-of-hours setpoint change to the crusher PLC** (the in-control-system scenario) | Claroty mining survey (n=46): 76% saw attacks via supplier access; MM-ISAC: vendor access "brokered, named and temporary"; Rio Tinto CISO on active OT controls. | Unprepared: the write goes unnoticed; the crusher trips and is down for a period labelled as an assumption **[my call]**. Prepared: crusher flashes amber, an alert fires, that vendor's access is revoked while the crusher and other vendors keep running. | Time to detect the unusual Modbus write (Zeek/Suricata); time to revoke one vendor; crusher uptime throughout; other vendor unaffected. |
| S4 | **Precautionary IT/OT isolation** | Copper Mountain, Dec 2022: IT ransomware led to isolation and about five days of mill shutdown. Waterfall: ~90% of incidents with physical consequences are indirect. | Unprepared: isolation means shutting everything. Prepared: a pre-computed list of what keeps running in isolation (local login, logging, historian, HMI). | Time to safe isolation; which local services kept working after the enterprise-to-site link was cut. |
| S5 (stretch) | Divestment / permanent severability | MM-ISAC severability goal; BHP on integrating acquired technology. | Site cut cleanly from the parent. | Optional. |

### 4.5 Mobile [user]
On a phone, the welcome page, the video and the guided run work well, and cut buttons still work. The network overlay, assets tab and assumptions editor are desktop-only, with a "best on a laptop" note.

## 5. Substance rules (hard requirements)

### 5.1 Honesty
- **The site is a fictional model mine.** This is stated on the welcome page and persistently on the site view (e.g. a small "Fictional model site" badge). The incidents are presented as examples drawn from public events. **[user]**
- **The Scope replay is split in two.** "What really happened" (12 days, manual workarounds, no reported production stop) is shown first and sourced. The escalation ("what if the workarounds ran out": fleet parks, trains stop) is clearly labelled as a projection. No real company is shown or implied to have stopped production. **[my call, accepted]**
- **Every number shown is one of three kinds**, and the UI shows which: **sourced** (links to the public document), **measured** (from a dated lab run, links to evidence) or **assumed** (labelled, with reasoning). Nothing is unlabelled.

### 5.2 Computed, not scripted
The animation, process states, day counter and revenue counter are rendered from engine output. Nothing is hand-timed. Changing the register changes what the visitor sees.

### 5.3 The data contract between register, engine, lab and site
This is the single architecture; do not build two.

- **The register** (YAML, documented schema) describes the site: process areas with safety function, production consequence and tier; assets with process area, tier, zone and network attributes; outside services; dependencies between processes, assets and services; stocks and consumption rates (diesel days, explosives, stockpile size); continuity-pack fields (maximum tolerable outage, recovery target, owner, independent copy, last restore test); production parameters for the revenue counter; and resilience controls present in the "prepared" variant. Every value carries provenance (`sourced` + citation, `measured` + lab-run id and date, or `assumed` + reasoning).
- **The engine** (pure function) takes the register, a scenario (which services are cut, and when) and a site variant (unprepared/prepared), and computes a timeline: which processes change state when, stock levels over time, production deferred and revenue at risk. It also derives asset tiers and the risk ranking.
- **The lab** does not drive the site at runtime. The lab harness runs each scenario for real and writes **measured parameters** (detection time, revoke time, restore time, handover time, rejected-transaction count, and which local services stayed up) back into the register with provenance (run id, date, link to evidence artifacts).
- **Measured capability vs. modelled duration [my call].** Lab measurements are small-scale facts about a lab, not real-world durations. The register keeps them apart: a `capability` record per control (works / fails, plus lab-scale measurements such as detection seconds, revoke seconds, rejected-transaction count, with provenance) and a separate `duration` the engine uses on the day-scale timeline (e.g. "independent ERP restore: hours"), which is `assumed` or `sourced`, never silently copied from the lab. Lab-scale values may be shown directly only where the scale is genuinely comparable (detecting and revoking a vendor session) and are labelled as lab-measured. A mock ERP restoring in 40 seconds must never be presented as a real restore time.
- **Before the lab exists**, scenarios ship with `assumed` capability values, labelled as such, and are upgraded to `measured` when the lab lands. This is acceptable for the first playable release.
- **The site** loads the register, runs the engine in the browser, and renders the result. It never replays a lab log. Lab evidence (logs, recordings) appears only on the "How this was tested" page and via provenance links.
- **The CLI** runs the same engine to generate the continuity data pack PDF and the asset-tier table.

## 6. Architecture and tech **[my call unless noted]**

```
                 ┌──────────────────────── lab (Docker Compose, private) ───────────────────────┐
                 │ Plant: PLC sim (PyModbus, or OpenPLC Runtime v4 if Modbus TCP works in Docker) │
                 │        crusher / conveyor process model, simple HMI                          │
                 │ Site:  local identity, logging, historian, offline work-order app             │
                 │ DMZ:   vendor jump host(s), backups                                           │
                 │ Ent.:  mock hosted ERP (DB + API), cloud identity stub, IROC link             │
                 │ Mon.:  Zeek + Suricata (Malcolm if RAM allows)                                │
                 │ Harness (Python): cut/restore links, inject events, measure, export JSON      │
                 └──────────────────────────────────┬───────────────────────────────────────────┘
                                                    │ measured params + evidence
                                                    ▼
             register (YAML + schema) ──► engine (TypeScript, pure) ──► CLI: continuity pack PDF, tier table
                                                    │
                                                    ▼
             site (TypeScript, Vite, React for UI, PixiJS for the animated scene), static
             hosted on Cloudflare Pages at a subdomain of the owner's site [user]
```

- **Engine in TypeScript** so the same code runs in the browser (live assumptions editing) and in the CLI.
- **Lab in Docker Compose** on the owner's laptop, or a small cloud VM when testing **[user: a VM is acceptable if monthly cost is modest]**. Never exposed to the internet.
- **The site itself follows good web-security hygiene** (strict Content Security Policy, no third-party trackers, dependency audit), because a security interviewer may look. **[my call]**
- **Repo:** `~/Documents/FailLocal`, its own git repo **[user]**. Private on GitHub while the foundations go in; made public, with full history, at the first playable release (§7 step 2) **[user]**. Open-source licence is the builder's choice (Apache-2.0 suggested, matching Malcolm). Research notes from the Hyperresearch vault are referenced, not copied wholesale.
- **Name:** "FailLocal" for now; easy to change. **[my call]**

## 7. Release: build in public [user]
Ship in usable pieces with a LinkedIn post at each. The owner has said not to plan around hours or time, so no dates are set. The order puts the most valuable pieces first so that whatever exists when applications open (Feb 2027) is complete and presentable on its own:

1. **Write-up post:** what the Scope outage teaches mid-tier miners (no code). Invites practitioner feedback.
2. **First playable release:** register + engine + site with S1 (hero) and the guided run, in the chosen art style.
3. **The OT release:** lab live, S3 detection with evidence on "How this was tested", network overlay and assets tab.
4. **Full launch:** all four scenarios, continuity pack PDF, video, "How I built this", limitations. Ideally after one practitioner review (ECU critical-infrastructure researchers or CS4CA ANZ contacts), with what changed as a result recorded.

Each release must meet the anti-goal bar on its own: nothing half-working goes public.

## 8. Left to the builder
- **Art style:** at the start of the build, show the owner 2–3 styled mockups of the same scene (polished top-down vs isometric at minimum) and let them pick. **[user]** All final art is **vector art drawn in code** (PixiJS graphics / SVG), with no bought, commissioned or AI-generated images **[user]**, so every element can be animated and recoloured for state changes and is fully owned.
- Register schema details, engine propagation algorithm, and PixiJS scene structure.
- Exact revenue formula and default values. Defaults must be sourced or labelled as assumptions (e.g. a mid-size Pilbara mine's Mtpa, a dated iron ore price).
- How "prepared" is represented (a variant file or an overlay of controls on one register), provided it is the same site with controls toggled.
- Video production, analytics choice (privacy-friendly or none) and licence.
- Lab component choices within the constraints above (OpenPLC v4 vs PyModbus after a short spike; Malcolm vs plain Zeek + Suricata by available RAM; the owner's machine is a 16 GB arm64 Mac with Docker, which points to plain Zeek + Suricata).

## 9. Constraints
- **Legal and ethical:** lab only, on the owner's own equipment or VM. Never point tools at real mine, vendor or internet-exposed systems (Criminal Code Part 10.7).
- **Data:** synthetic only, and said so.
- **Cost:** free static hosting; a VM only if monthly cost is modest.
- **Built with Claude Code**, disclosed openly. The owner must be able to explain and defend every part in interview, so prefer understandable designs over clever ones.
- **Owner role: review only [user].** Claude Code builds everything, including register content (asset tiers, dependencies, outage limits, scenario parameters) and detection logic, and the owner signs off at each release. To keep it defensible in interview **[my call]**: (a) every domain judgement (each tier, dependency, outage limit, assumed value, detection rule) is recorded in a plain-English decision log in the repo with its reasoning and source; (b) each release review includes a walkthrough of that log and the architecture so the owner can explain it; (c) any change the owner makes during review, or after practitioner feedback, is recorded as theirs (this feeds the "a practitioner told me I was wrong" story).

## 10. Interview material it should produce
- **Hosted ERP vanished:** replayed a public Perth incident, built and tested an independent restore path and offline workflow, counted transactions lost and reconciled.
- **The crusher stayed up:** detected an out-of-hours setpoint change from a vendor connection and contained it without stopping the simulated crusher.
- **A practitioner told me I was wrong:** what changed after feedback.
- **How I used AI to build it:** what the owner decided, what they checked, and where they overrode the tool.
