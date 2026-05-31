```
                                CIVICA — MISSION MAP (2026-05-31)
                                ═════════════════════════════════

         "Pre-validated SNAP packets — operational errors caught before the county,
                       eligible households kept on through renewal"

   1 in 4 CA apps denied over paperwork · 65% of error $ operational · friction↓ lifts enrollment 6–9%
                  California-first · Bilingual · CBO-of-record: VoteNow

  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                  THE TWO BUSINESSES (one engineering stack)                    ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   ┌────────────────────────────────────┐  ┌────────────────────────────────┐ ║
  ║   │  CIVICA TECH C-CORP (SaaS)         │  │  CIVICA-AS-CBO (VoteNow umbr.) │ ║
  ║   │  Sells platform license to CBOs    │  │  Operates as own CBO           │ ║
  ║   │  Buyer staff fills+submits          │  │  Greenfield: students, farm-   │ ║
  ║   │   BenefitsCal (Mode B bridge)      │  │   workers, gig, 60+ seniors    │ ║
  ║   │  Revenue: SaaS subscription        │  │  Mode A (when wired) + Mode B  │ ║
  ║   │  Role: SCALE ENGINE (lionshare)    │  │  Rev: grants / county / USDA   │ ║
  ║   │                                    │  │   50% FFP* / C-corp subsidy    │ ║
  ║   │                                    │  │  Role: PROOF ENGINE            │ ║
  ║   └────────────────────────────────────┘  └────────────────────────────────┘ ║
  ║   *50% FFP under 7 CFR 277.4 — CDSS Outreach-Plan partners can claim → SaaS pt.║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │  both ride the same backbone
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                              THE SURFACES                                      ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐      ║
  ║   │ iOS app     │  │ Dashboard   │  │ apps/web    │  │ Browser ext     │      ║
  ║   │ (applicant) │  │ (staff)     │  │ (B2C +      │  │ (BenefitsCal)   │      ║
  ║   │ 3-phase ✓   │  │ /cbo-preview│  │  TestFlight)│  │ Mode A ✗ wired  │      ║
  ║   │ EBT live ✓  │  │ /findings   │  │ ◐ deploy    │  │  (Browserless)  │      ║
  ║   │ Marketplace │  │ /findings/  │  │   pending   │  │ Mode B ✓ live   │      ║
  ║   │ IntervCoach │  │  kpi ✓      │  │             │  │  (human submits)│      ║
  ║   │ Recert ◐    │  │ /compliance │  │             │  │                 │      ║
  ║   │ 7.5/10 UX   │  │ /qc /casewk │  │             │  │                 │      ║
  ║   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘      ║
  ║   /findings serves the evidence ledger + regression panels                    ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                  THE BACKBONE          │          THE COMPLIANCE LAYER         ║
  ╠════════════════════════════════════════╪═══════════════════════════════════════╣
  ║  CF Worker enrollment-api ✓             │  RegOps engine: ingest → process →    ║
  ║  Python FastAPI (engine, PII) ✓         │   counsel queue → publish snapshot    ║
  ║  Supabase Postgres (snap_enrollment,    │  ✓ FederalRegister + CdssAcl adapters ║
  ║   kpi_snapshot, packet_outcomes)        │  ◐ UsdaFns + FtcActions adapters next ║
  ║  Sentry ✓CF ✓Fly ◐Vercel · E2E ✓14/14   │  MOAT: stay law-current as a feature  ║
  ╚════════════════════════════════════════╧═══════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                       ◆ EVIDENCE BASE ◆  (the data behind the claims)          ║
  ║              docs/findings/ ledger · 30 cited findings · reproducible          ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   THE ERROR MAP — operational paperwork loss at EVERY door (all data-backed):  ║
  ║     • Get-in     1 in 4 CA apps procedurally denied ........ #420 ✓ (ICPSR 39331)║
  ║     • Overpay    65/35 operational; shelter|wages 60.8% .... QC FY23 ✓         ║
  ║     • Denial     39.8% of negative actions erroneous ....... CAPER FY24 ✓      ║
  ║     • Renewal    ~330K eligible lost/yr; ~40% spells ....... CF-18 + Unrath ✓✓ ║
  ║                                                                                ║
  ║   REAL REGRESSIONS (not synthetic):                                            ║
  ║     • burden↓ → enrollment +6–9% (causal) ........ #380 ✓ 51 states 1996-2020 ║
  ║     • per-element QC: elderly 3.6× shelter, earners 2.65× ... #417 ✓ (n=867)   ║
  ║     • app-door procedural denial 23.9%, ~⅓ operational ...... #420 ✓ (panel)   ║
  ║     • pre-registered Civica-effect regression ...... 🟡 synthetic until data   ║
  ║                                                                                ║
  ║   GROUNDED $ + LEVERAGE:                                                        ║
  ║     • §10105 exposure: CA ~$1.83B/yr; tier-crossing ~$610M .. #381 ✓ (⚠counsel)║
  ║     • income verification = highest $-leverage fix ......... PolicyEngine 🟡   ║
  ║     • earned-income cohort 13.95% PER (2.4×) .............. TAM 🟡 cite-pending ║
  ║                                                                                ║
  ║   PROOF SPINE: measured PER from QC, fidelity-firewalled (#409/#412/#413) ✓ ·  ║
  ║     "no fabrication" — degenerate models flagged, not hidden. THIS is the moat ║
  ║     a competitor with the same data can't fake.                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                          THE DATA FLYWHEEL                                     ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   COMPLIANCE LAYER ─┐                                                          ║
  ║                     ▼                                                          ║
  ║   real outcomes ▶ ┌─────────────────┐ ▶ feeds /qc, /error-risk, /findings/kpi, ║
  ║   (loop wired,    │ ERROR-RATE      │   snap-rules, retention scorer           ║
  ║    awaiting feed) │ ENGINE + KPI    │   measured PER from QC ✓ (#412)          ║
  ║                   └─────────────────┘                                          ║
  ║                            ▲                                                   ║
  ║                            │   ┌──── ◐ built (awaiting feed) ──┐               ║
  ║                            │   │  POST /webhooks/county-outcome  #413 ✓ code   ║
  ║                            │   │  POST /me/packets/:id/outcome   #409 ✓ code   ║
  ║                            │   └── county adjudicates → packet_outcomes        ║
  ║   STAGE 1 (Get In)         │                                                   ║
  ║   intake → screener → draft → error-risk → prepare-export ─┐                  ║
  ║      ✓        ✓        ✓         ✓              ✓           ▼                  ║
  ║   (1 in 4 apps procedurally denied today — #420)   navigator review +         ║
  ║                                                    portal submit Mode B✓ A◐    ║
  ║                                                                                ║
  ║   STAGE 2 (Stay Engaged) — Pillar 2                                            ║
  ║   EBT bal ✓ → deposit alerts ✓ → offers ✓ → savings ✓ → marketplace ✓ →       ║
  ║   push log ✓ → distress flags ✓        (surfaces shipped; outcome lift 🟥)     ║
  ║                                                                                ║
  ║   STAGE 3 (Stay On) — Pillar 3                                                 ║
  ║   SAR7 prep → retention risk ✓ → re-entry assist ✓ → recert prep ◐ →          ║
  ║   Interview Coach ✓ → recert outreach (Twilio ◐) → renew or exit              ║
  ║                                                                                ║
  ║   ▼ STATUS ▼  County-outcome loop: built (#412/#413), awaiting activation +    ║
  ║   a county feed + production volume. measured_per goes real from internal QC   ║
  ║   the moment ≥30 QC reviews clear (no county dependency, via #412).            ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║              THE THREE VALUE PILLARS  (user-journey order)                     ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   ┌────────────────────────────────────────────────────────────────────┐      ║
  ║   │ PILLAR 1: GET IN — Intake-QC                                        │      ║
  ║   │ Goal:   reduce Type-2 payment error at intake (wrong $ out)         │      ║
  ║   │ Target: earned-income caseload (~27%, ~2.4× PER) 🟡 cite-pending    │      ║
  ║   │ EVIDENCE (real federal data):                                       │      ║
  ║   │   • 65/35 operational; shelter|wages 60.8% of errors (QC FY23) ✓    │      ║
  ║   │   • who errs: elderly 3.6× shelter, earners 2.65× (#417) ✓          │      ║
  ║   │   • 1 in 4 apps procedurally denied, ~⅓ operational (#420) ✓        │      ║
  ║   │   • income verification = highest $-leverage (PolicyEngine) 🟡      │      ║
  ║   │ Engine scorePacketRisk ✓ · Surface /qc /error-risk ✓                │      ║
  ║   │ Buyer pitch: "Catch the operational errors before the county does." │      ║
  ║   └────────────────────────────────────────────────────────────────────┘      ║
  ║   ┌────────────────────────────────────────────────────────────────────┐      ║
  ║   │ PILLAR 2: STAY ENGAGED — Engagement Continuity                      │      ║
  ║   │ Goal:   ongoing utility → active relationship; the monetization arm │      ║
  ║   │ Surfaces shipped ✓: EBT bal, push, offers (#272), savings,          │      ║
  ║   │   marketplace, Interview Coach, distress→recovery                   │      ║
  ║   │ EVIDENCE: surfaces are live, but the engagement→retention LIFT is   │      ║
  ║   │   🟥 a HYPOTHESIS — no conversion/outcome data yet. Roadmap, not    │      ║
  ║   │   proof. (ebt-offer-placement-priors = directional, unvalidated)    │      ║
  ║   │ Buyer pitch: "Year-round relationship, not annual intake events."   │      ║
  ║   └────────────────────────────────────────────────────────────────────┘      ║
  ║   ┌────────────────────────────────────────────────────────────────────┐      ║
  ║   │ PILLAR 3: STAY ON — Retention + Recert Assist  ◀ LEAD HERE          │      ║
  ║   │ Goal:   reduce Type-1 (false-exit) error at reporting moments       │      ║
  ║   │ EVIDENCE (deepest moat — 5 sources + the only causal estimate):     │      ║
  ║   │   • Unrath 2024: ~40%+ spells end at reporting, 2:1 still-eligible ✓✓│      ║
  ║   │   • CF-18: ~330K eligible-loss events/yr (CA state data) ✓          │      ║
  ║   │   • CAUSAL: burden↓ → enrollment +6–9%, +17% by yr3 (#380) ✓        │      ║
  ║   │   • cross-validated: CF-296 + ICPSR 39331 (~⅔ denials procedural) ✓ │      ║
  ║   │ Engine scoreRetentionRisk ✓ + re-entry assist ✓ · RecertCompanion ◐ │      ║
  ║   │ Buyer pitch: "Keep eligible households on, not paperwork off."      │      ║
  ║   └────────────────────────────────────────────────────────────────────┘      ║
  ║   Three reasons to buy. One stack. Pillar 2's data feeds Pillars 1 & 3.        ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                  MONETIZATION LAYERS  (revenue beyond core)                    ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   L1 CORE      C-corp SaaS license · CBO arm grants/county/USDA 50% FFP  🟡    ║
  ║   L2 ENGAGE    EBT partner offers (◐ infra, PR #272) · Medicare x-sell ✗       ║
  ║   L2 GOV       error-rate contracts tied to §10105 — CA ~$1.83B/yr exposure    ║
  ║                (#381 ✓ mechanism real; buyer/pricing asserted 🟡; ⚠counsel)    ║
  ║   L3 DATA      aggregate research licensing ✗ (k-anon/DP infra; counsel-gated) ║
  ║   SEQUENCING   L1 → L2a offers → L2b Medicare → L3 last (after trust earned)   ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                       DISTRIBUTION — TWO PATHS                                 ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   PATH 1: C-CORP SAAS (lionshare)      │  PATH 2: CIVICA-CBO DIRECT            ║
  ║   Sell to partner CBOs                  │  COHORT          CHANNEL             ║
  ║   Named: Project Bread (MA design       │  College student  Universities       ║
  ║    partner) + [Monday outreach list]    │  Farmworker       UFW                ║
  ║   Motion: partnerships, RFPs, conf      │  Gig (60+ plats)  DoorDash/Uber/…    ║
  ║   Rev: subscription + 50% USDA FFP      │  60+ seniors      SEIU 2015 / AARP?  ║
  ║    for partner CBO (they care)          │  ~544K reachable hh/yr → ~$1.0B/yr   ║
  ║                                         │   🟡 PRE-PILOT estimate — conversion ║
  ║                                         │   rates unvalidated, no signed partnr║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                       THE HONEST GAPS                                          ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   ✗  Phase 2 headless submit (Browserless)  └ Mode B works, human clicks       ║
  ║   ◐  County-outcome loop — built (#412/#413); awaiting activation + a county   ║
  ║       feed + production volume                                                 ║
  ║   ◐  measured Civica PER *reduction* — needs ≥30 QC reviews + traffic; the     ║
  ║       mechanism (retention regression) is proven, the lift is not yet measured ║
  ║   ◐  USDA FNS + FTC RegOps adapters (Federal Register + CDSS ACL live)         ║
  ║   ◐  Operator deploy queue (migrations + secrets + wrangler) ~30min/step       ║
  ║   ◐  iOS T3–T7 (settings, soft-inelig, iPad, dark mode) — demo-safe            ║
  ║   ✗  The Assignment (named CBO ED for Caseworker Mode)                         ║
  ║   🟡 BBCE_REMOVAL / 13.95% TAM provenance — replace TODO-4-spec w/ CBPP cite   ║
  ║   🟥 Pillar 2 engagement→outcome lift — HYPOTHESIS, no data                    ║
  ║   ⚠  §10105 banded-vs-continuous — counsel (sets whether CA or a near-         ║
  ║       threshold state is the first buyer)                                      ║
  ║   ✗  Medicare broker partner / L3 anonymization infra (revenue paths unbuilt)  ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                    THE FUTURE STATE (deferred, not now)                        ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║   PATH 3: B2G DIRECT (Civica → State/County) — not pitched this admin.         ║
  ║   The wedge is quantified: §10105 puts ~$1.83B/yr of CA federal cost-share at  ║
  ║   risk on the error rate (#381). Unlocks IF: (a) CBO motions prove efficacy    ║
  ║   at scale, (b) state signals willingness to pay, (c) USDA Advanced-Automation ║
  ║   posture clarifies for non-determination automation.                          ║
  ╚══════════════════════════════════════════════════════════════════════════════╝

  ═══════════════════════════════════════════════════════════════════════════════
   LEGEND   ✓ live/merged+verified   ◐ built, activation/flag pending   ✗ not built
   EVIDENCE ✓ data-backed   🟡 partial/modeled/cite-pending   🟥 hypothesis (no data)
            ⚠ counsel question   #NNN = source PR
  ═══════════════════════════════════════════════════════════════════════════════
```
