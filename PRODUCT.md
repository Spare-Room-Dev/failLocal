# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: the owner left the choice to the designer, recorded in `docs/superpowers/specs/2026-10-22-faillocal-design.md` §6. TypeScript + Vite, React for UI chrome and panels, PixiJS for the animated site scene. All art is vector drawn in code (PixiJS graphics / SVG): no bitmap, AI-generated, bought or commissioned imagery. It is a static site on Cloudflare Pages at a subdomain of the owner's personal site (the domain is not yet known).

## Users

- **In-house technology graduate recruiters at BHP, Rio Tinto and South32.** They know mining well but not cyber or OT security. They arrive from a LinkedIn post, the owner's website or a CV link, often on a phone, and give it 60–90 seconds. Their job: decide whether this candidate is worth an interview.
- **Interview panel members, often operations-side leaders.** They think in availability, recovery time and production. They may explore on a laptop before or during an interview.
- **Security / OT interviewers.** They go one click deeper: the network view, the register, the lab evidence, the public repo.

## Product Purpose

FailLocal is a portfolio project by a Perth cyber security graduate applying to mining technology graduate programs (2028 intake). It is a playable model of a **fictional** Pilbara iron ore mine. Visitors cut the outside services the site relies on (hosted ERP, cloud login, the Perth remote operations centre, vendor remote access), watch what stops, when and what it costs, then run the same cut on a prepared version of the site.

Success means a recruiter thinks: "this person is genuinely interested in our industry and has been working on something relevant to it; I want to talk to them."

## Positioning

An open, auditable mining layer for resilience and OT-security thinking. Every visual is computed from a real dependency register and engine, and backed by a real lab. It is not an infographic, and it is not a commercial OT product.

## Operating Context

- Discovery: LinkedIn posts (build-in-public, released in stages), the owner's website, CV project links.
- Flow: welcome page → 60–90 s guided run of the hero scenario (Hosted ERP lost, modelled on the Scope Systems outage, Perth, May 2026) → free play with every cut, the unprepared/prepared toggle, the assumptions editor and the network overlay.
- Supporting pages: How this was tested, Sources, How I built this (honest disclosure of Claude Code use), Limitations.
- Phone: the welcome page, video and guided run work well. Network overlay, assets tab and assumptions editor are desktop-only.

## Capabilities and Constraints

- The site is always labelled a **fictional model mine**. Incidents are examples drawn from public events. No real company is shown or implied to have stopped production.
- Every number on screen is labelled **sourced**, **measured** (dated lab run), **assumed** (with reasoning) or **computed** (engine-derived).
- Wording: "production deferred" and "revenue at risk", never "lost".
- Language: mining vocabulary is welcome on the front (crusher, ROM pad, dispatch, IROC). Security vocabulary (CVSS, Purdue, zones and conduits, KEV) stays in side panels, the network overlay and the write-up.
- The animation renders engine output and is never hand-timed.
- Lab-only. Never point tools at real systems.

## Brand Commitments

- Working name: **FailLocal** (may change).
- Its own visual identity, independent of the owner's personal website, which only links to it.
- It must look like a real industry product, not a student dashboard.

## Evidence on Hand

- Research base: `~/Documents/Hyperresearch/research/notes/final_report_mining-tech-pain-points-a37b83.md` and `~/Documents/Hyperresearch/project-ideas/01-mine-site-resilience-map.md` (Scope Systems timeline, MM-ISAC Mining OT Reference Architecture, BHP and Rio Tinto disclosures, Copper Mountain, Claroty mining survey, Waterfall 2025).
- No real mine OT data exists publicly. All site data is synthetic and must be said to be.
- No testimonials, practitioner endorsements or metrics exist yet. Do not fabricate any.

## Product Principles

1. **Substance under every pixel.** If a visual cannot point to the register, the engine or a lab run, it does not ship.
2. **Never overclaim.** Fictional, labelled, sourced. Credibility is the product.
3. **Operations first, security as the mechanism.** Lead with what stops and what it costs. Show the security reasoning one click deeper.
4. **Sixty seconds to the point.** A busy recruiter on a phone must get it without clicking around.
5. **Never broken in front of a recruiter.** Fast, static, tested on real devices, with a video fallback.

## Accessibility & Inclusion

Best effort, with no formal standard (owner's choice). Sensible defaults still apply: readable contrast, keyboard operation, reduced-motion handling for the animated scene, and status shown by more than colour alone.
