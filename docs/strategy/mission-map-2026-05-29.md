# Civica Mission Map — 2026-05-29

Canonical strategic reference. Single visual capturing Civica's two-business
structure, three value pillars, monetization layers, distribution paths, and
honest gap inventory as of pre-Monday outreach sprint (2026-05-29).

Use as personal pitch-prep crutch. Sentences at the bottom are reusable in
partner conversations; the ASCII map is the mental model behind them.

---

```
                                CIVICA — MISSION MAP (2026-05-29)
                                ═════════════════════════════════

                "Pre-validated SNAP packets that error 60% less"
                  California-first · Bilingual · CBO-of-record: VoteNow

  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                  THE TWO BUSINESSES (one engineering stack)                    ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ┌────────────────────────────────────┐  ┌────────────────────────────────┐ ║
  ║   │  CIVICA TECH C-CORP                │  │  CIVICA-AS-CBO                 │ ║
  ║   │  (SaaS platform)                   │  │  (operating arm, VoteNow umbr.)│ ║
  ║   │                                    │  │                                │ ║
  ║   │  Sells:    Platform license        │  │  Operates: as own CBO          │ ║
  ║   │  Buyer:    Other CBO orgs          │  │  Serves:   Greenfield          │ ║
  ║   │  Buyer    Their staff fills +      │  │             under-enrolled     │ ║
  ║   │   does:    submits BenefitsCal     │  │  Cohorts:  college students    │ ║
  ║   │                                    │  │            farmworkers         │ ║
  ║   │  Uses:     Mode B (bridge ext      │  │            gig workers         │ ║
  ║   │            in CBO's own browser)   │  │            60+ seniors         │ ║
  ║   │                                    │  │                                │ ║
  ║   │  Revenue:  SaaS subscription       │  │  Uses:     Mode A (when wired) │ ║
  ║   │                                    │  │            + Mode B today      │ ║
  ║   │  Role:     Scale engine            │  │                                │ ║
  ║   │                                    │  │  Revenue:  • Grants / philan-  │ ║
  ║   │  This is the LIONSHARE             │  │              thropy            │ ║
  ║   │  of distribution                   │  │            • County contracts  │ ║
  ║   │                                    │  │            • USDA 50% FFP*     │ ║
  ║   │                                    │  │            • C-corp subsidy    │ ║
  ║   │                                    │  │              (if needed)       │ ║
  ║   │                                    │  │                                │ ║
  ║   │                                    │  │  Role:     PROOF ENGINE        │ ║
  ║   └────────────────────────────────────┘  └────────────────────────────────┘ ║
  ║                                                                                ║
  ║   *50% federal financial participation under 7 CFR 277.4 — CDSS-registered    ║
  ║    Outreach Plan partners can claim. Partner CBOs can too → SaaS selling pt.  ║
  ║                                                                                ║
  ║   ──────────────── BOTH RIDE THE SAME BACKBONE ────────────────                ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                              THE SURFACES                                      ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    ║
  ║   │  iOS app    │  │  Dashboard  │  │  apps/web   │  │ Browser ext     │    ║
  ║   │  (applicant)│  │  (staff)    │  │  (B2C       │  │ (BenefitsCal    │    ║
  ║   │             │  │             │  │   landing   │  │  bridge)        │    ║
  ║   │  3-phase    │  │ /cbo-preview│  │   + Test-   │  │                 │    ║
  ║   │  status     │  │ /county-demo│  │   Flight)   │  │  Mode A ✗ wired │    ║
  ║   │  shell ✓    │  │ /findings   │  │             │  │  (Browserless)  │    ║
  ║   │  EBT live ✓ │  │ /compliance │  │  ◐ deploy   │  │                 │    ║
  ║   │  Marketplace│  │ /qc         │  │   pending   │  │  Mode B ✓ live  │    ║
  ║   │  IntervCoach│  │ /caseworker │  │             │  │  (human submits)│    ║
  ║   │  Recert ◐   │  │  ◐ T1 live  │  │             │  │                 │    ║
  ║   │  7.5/10 UX  │  │             │  │             │  │                 │    ║
  ║   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘    ║
  ║                                                                                ║
  ║   Used by BOTH businesses' applicants + staff                                 ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                              THE BACKBONE                                      ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 ║
  ║   │  Cloudflare  │     │   Python     │     │   Supabase   │                 ║
  ║   │  Worker      │◀───▶│   FastAPI    │◀───▶│   Postgres   │                 ║
  ║   │  enrollment- │     │  (engine,    │     │              │                 ║
  ║   │  api ✓       │     │   PII        │     │  snap_       │                 ║
  ║   │  rate-limit ◐│     │   decrypt) ✓ │     │   enrollment │                 ║
  ║   └──────────────┘     └──────────────┘     └──────────────┘                 ║
  ║                                                                                ║
  ║   Sentry ✓ CF + ✓ Fly + ◐ Vercel       E2E nightly ✓ 14/14                  ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                          THE COMPLIANCE LAYER                                  ║
  ║                 (the error-rate engine's law-of-the-land input)                ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ┌─────────────────────────────────────────────────────────────────────┐    ║
  ║   │                          SOURCES (ingest)                            │    ║
  ║   │                                                                      │    ║
  ║   │   FEDERAL              STATE                  CONSUMER PROTECTION    │    ║
  ║   │   ────────             ─────                  ───────────────────    │    ║
  ║   │   • USDA FNS guidance  • CA CDSS All-County  • FTC enforcement       │    ║
  ║   │     (OBBBA, ABAWD,       Letters (ACLs)        actions               │    ║
  ║   │     advanced auto)     • MA DTA charts        (Argyle, Canvas-       │    ║
  ║   │   • Federal Register   • State plan           class precedents)      │    ║
  ║   │     (7 CFR 273.X)        amendments                                  │    ║
  ║   │                                                                      │    ║
  ║   │   Adapters:                                                          │    ║
  ║   │   ✓ FederalRegisterAdapter    ✓ CdssAclAdapter                       │    ║
  ║   │   ◐ UsdaFnsAdapter (next)    ◐ FtcActionsAdapter (next)              │    ║
  ║   └─────────────────────────────────────────────────────────────────────┘    ║
  ║                                  │                                            ║
  ║                                  ▼                                            ║
  ║   ┌─────────────────────────────────────────────────────────────────────┐    ║
  ║   │                       REGOPS ENGINE (process)                       │    ║
  ║   │                                                                      │    ║
  ║   │   ✓ Polling cron (every 5min, .github/workflows/regops-poll.yml)    │    ║
  ║   │   ✓ Immutable append-only audit log (regops.source_audit_log)        │    ║
  ║   │   ✓ Domain-scoped counsel queue (federal / CA / MA / FTC)            │    ║
  ║   │   ✓ Adversarial gate before publication                              │    ║
  ║   │   ✓ Sentry alert emitter (page on novel policy shift)                │    ║
  ║   │                                                                      │    ║
  ║   │   Counsel reviews → snapshot published → downstream consumers fetch  │    ║
  ║   └─────────────────────────────────────────────────────────────────────┘    ║
  ║                                  │                                            ║
  ║                                  ▼                                            ║
  ║   ┌─────────────────────────────────────────────────────────────────────┐    ║
  ║   │                       CONSUMERS (downstream)                         │    ║
  ║   │                                                                      │    ║
  ║   │   1. ERROR-RATE ENGINE        ← slice weights + PER targets         │    ║
  ║   │   2. SNAP-RULES ENGINE        ← validate packets vs current law     │    ║
  ║   │   3. COMPLIANCE COPY REGISTRY ← user-facing strings regenerate      │    ║
  ║   │   4. COUNSEL DASHBOARD        ← domain-routed review queue          │    ║
  ║   │   5. AUDIT TRAIL              ← regulator-defensible chain          │    ║
  ║   └─────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║   THE MOAT: Civica stays current with law as a product feature, not a         ║
  ║   maintenance burden. A competitor with the same intake data still has        ║
  ║   to keep pace with policy. They don't. We do.                                ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                          THE DATA FLYWHEEL                                     ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ┌─────────────────┐                                                        ║
  ║   │ COMPLIANCE LAYER│──┐                                                     ║
  ║   │ (RegOps engine) │  │                                                     ║
  ║   └─────────────────┘  │                                                     ║
  ║                        ▼                                                     ║
  ║   real outcomes ▶ ┌─────────────────┐ ▶ feeds /qc, /error-risk,             ║
  ║   (when feedback  │ ERROR-RATE      │   snap-rules, retention scorer        ║
  ║   loop closes)    │ ENGINE          │                                        ║
  ║                   └─────────────────┘                                        ║
  ║                            ▲                                                 ║
  ║                            │                                                 ║
  ║                            │     ┌───── ✗ NO CODE PATH ─────┐                ║
  ║                            │     │                          │                ║
  ║                            │     │   ┌──── county adjudicates outcome        ║
  ║                            │     │   │                                       ║
  ║   STAGE 1 (Get In)         │     │   │                                       ║
  ║   intake → screener → draft → error-risk score → prepare-export ─┐         ║
  ║      ✓        ✓         ✓           ✓                    ✓        │         ║
  ║                                                                    ▼         ║
  ║                                                          navigator review    ║
  ║                                                          + portal submit     ║
  ║                                                          Mode B ✓ Mode A ◐  ║
  ║                                                                              ║
  ║   STAGE 2 (Stay Engaged) — the ongoing utility layer (Pillar 2)             ║
  ║   EBT balance ✓ → deposit alerts ✓ → offers ✓ → savings tally ✓ →           ║
  ║   marketplace ✓ → push log ✓ → distress flags ✓                              ║
  ║                                                                              ║
  ║   STAGE 3 (Stay On) — reporting moments (Pillar 3)                          ║
  ║   SAR7 prep → retention risk score ✓ → re-entry assist ✓ → recert prep ◐    ║
  ║   → Interview Coach ✓ → recert outreach (Twilio ◐) → renew or exit          ║
  ║                                                                              ║
  ║   ▼ PITCH-CRITICAL GAP ▼                                                    ║
  ║   The engine is smart and law-current, but it cannot yet measure its own    ║
  ║   lift because the county-outcome loop isn't closed. Cheapest fix:           ║
  ║   POST /webhooks/county-outcome (~1d CC).                                    ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                       THE THREE VALUE PILLARS                                  ║
  ║                       (in user-journey order)                                  ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        ║
  ║   │   PILLAR 1       │ → │   PILLAR 2       │ → │   PILLAR 3       │        ║
  ║   │   GET IN         │   │   STAY ENGAGED   │   │   STAY ON        │        ║
  ║   │   (intake-QC)    │   │   (engagement    │   │   (retention +   │        ║
  ║   │                  │   │    continuity)   │   │    recert assist)│        ║
  ║   └──────────────────┘   └──────────────────┘   └──────────────────┘        ║
  ║                                                                                ║
  ║   ┌────────────────────────────────────────────────────────────────────┐    ║
  ║   │  PILLAR 1: GET IN — Intake-QC                                       │    ║
  ║   │                                                                     │    ║
  ║   │  Goal:    Reduce Type-2 payment error at intake (wrong $ goes out)  │    ║
  ║   │  Target:  Earned-income caseload (~27% of cases, ~2.4× PER)         │    ║
  ║   │  Engine:  scorePacketRisk ✓                                         │    ║
  ║   │  Surface: /qc, /error-risk ✓                                        │    ║
  ║   │  Compliance: stays current via RegOps ✓                             │    ║
  ║   │  Source:  USDA QC methodology + CIVICA_TAM_PROFILE                  │    ║
  ║   │                                                                     │    ║
  ║   │  Buyer pitch: "Catch errors before the county does."                │    ║
  ║   └────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║   ┌────────────────────────────────────────────────────────────────────┐    ║
  ║   │  PILLAR 2: STAY ENGAGED — Engagement Continuity                     │    ║
  ║   │                                                                     │    ║
  ║   │  Goal:    Generate ongoing utility through the benefit cycle so     │    ║
  ║   │           the household stays in active relationship with Civica    │    ║
  ║   │  Target:  All enrolled households (universal — not just earned-inc) │    ║
  ║   │                                                                     │    ║
  ║   │  Surfaces (already shipped):                                        │    ║
  ║   │    ✓ EBT balance dashboard + projection ("will it last?")           │    ║
  ║   │    ✓ Push notifications (deposits, low balance, doc-due)            │    ║
  ║   │    ✓ Partner offer catalog + redemptions (PR #272)                  │    ║
  ║   │    ✓ SavedByCivica tally + user savings UI                          │    ║
  ║   │    ✓ Marketplace job-matching + benefit-impact awareness            │    ║
  ║   │    ✓ Interview Coach (CA + MA question banks)                       │    ║
  ║   │    ✓ Distress-flag → recovery flow handoff                          │    ║
  ║   │                                                                     │    ║
  ║   │  Engine: notification_outlay_events, partner_offers, user_savings_  │    ║
  ║   │          tally, user_redemptions, user_push_log, distress_flags     │    ║
  ║   │                                                                     │    ║
  ║   │  Buyer pitch: "Year-round relationship, not annual intake events."  │    ║
  ║   │                                                                     │    ║
  ║   │  Strategic role: this is what makes Civica feel like a PRODUCT to   │    ║
  ║   │   applicants, not a transaction. Brand-defensible. Drives recommend │    ║
  ║   │   rates. Generates behavioral data that feeds Pillars 1 and 3.      │    ║
  ║   │   Also the monetization engine (see next section).                   │    ║
  ║   └────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║   ┌────────────────────────────────────────────────────────────────────┐    ║
  ║   │  PILLAR 3: STAY ON — Retention + Recert Assist                      │    ║
  ║   │                                                                     │    ║
  ║   │  Goal:    Reduce Type-1 (false-exit) error at reporting moments     │    ║
  ║   │           (SAR7 at 6mo, recert at 12mo)                              │    ║
  ║   │  Target:  Earned-income caseload (where reporting-moment churn      │    ║
  ║   │           concentrates)                                              │    ║
  ║   │                                                                     │    ║
  ║   │  Source:  Unrath (2024) — 16M CA admin panel, 2005-2023              │    ║
  ║   │           ~40%+ of CA spells end at reporting moments                │    ║
  ║   │           2:1 still-eligible exit ratio (Type-1 dominates)           │    ║
  ║   │                                                                     │    ║
  ║   │  Engine:  scoreRetentionRisk ✓ (G1) + re-entry assist ✓ (G2)        │    ║
  ║   │  Surface: G2 re-entry surface ✓, RecertCompanion ◐ flag             │    ║
  ║   │  Compliance: recert ACLs flow through same RegOps adapters ✓        │    ║
  ║   │                                                                     │    ║
  ║   │  Buyer pitch: "Keep eligible households on, not paperwork off."     │    ║
  ║   └────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║   All three pillars target the same engineering substrate, stay law-current   ║
  ║   via the SAME compliance layer, and compound: Pillar 2's engagement data     ║
  ║   feeds Pillars 1 and 3 over time. Three reasons to buy. One stack.           ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                          MONETIZATION LAYERS                                   ║
  ║                    (revenue beyond core SaaS + grants)                         ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   LAYER 1: CORE                                                                ║
  ║   ─────────────                                                                ║
  ║   C-corp:    SaaS subscription license from partner CBOs                       ║
  ║   CBO arm:   Grants + philanthropy + county contracts + USDA 50% FFP           ║
  ║                                                                                ║
  ║                                                                                ║
  ║   LAYER 2: ENGAGEMENT-DRIVEN (Pillar 2 monetization)                          ║
  ║   ───────────────────────────────────────────────────                         ║
  ║                                                                                ║
  ║   ┌─────────────────────────────────────────────────────────────────────┐    ║
  ║   │  EBT-LISTED PARTNER OFFERS                                          │    ║
  ║   │  ◐ Infrastructure live (partner_offers catalog + redemption flow,   │    ║
  ║   │    PR #272), gated by X-T8 catalog requirement                       │    ║
  ║   │                                                                     │    ║
  ║   │  Grocery retailers + EBT-eligible brands pay for featured placement │    ║
  ║   │  in the EBT balance dashboard's offer surface.                      │    ║
  ║   │                                                                     │    ║
  ║   │  Pitch posture: applicant-voluntary discounts, not behavioral       │    ║
  ║   │  retargeting. Users see offers because they're SNAP-relevant, not   │    ║
  ║   │  because their data was sold.                                       │    ║
  ║   └─────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║   ┌─────────────────────────────────────────────────────────────────────┐    ║
  ║   │  MEDICARE ADVANTAGE CROSS-SELL                                      │    ║
  ║   │  ✗ Not built; broker partnership not signed                          │    ║
  ║   │                                                                     │    ║
  ║   │  60+ cohort sits at the SNAP/Medicare intersection. As cohort       │    ║
  ║   │  members approach 65, Civica matches them (with consent) to a       │    ║
  ║   │  licensed Medicare Advantage broker partner.                         │    ║
  ║   │  Commission per enrollment (~$500-700) + ongoing PMPM split.        │    ║
  ║   │                                                                     │    ║
  ║   │  Compliance: CMS rules govern MA marketing. Cannot pre-sell, must   │    ║
  ║   │  use compliant licensed brokers. User consent at point of handoff.  │    ║
  ║   │                                                                     │    ║
  ║   │  Why this works: cleanest revenue layer that subsidizes the         │    ║
  ║   │  operating arm without compromising the SNAP integrity story.       │    ║
  ║   └─────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║                                                                                ║
  ║   LAYER 3: AGGREGATE DATA (long horizon, sensitive)                           ║
  ║   ─────────────────────────────────────────────────                           ║
  ║                                                                                ║
  ║   ┌─────────────────────────────────────────────────────────────────────┐    ║
  ║   │  AGGREGATE OUTCOME LICENSING / RESEARCH PARTNERSHIPS                │    ║
  ║   │  ✗ Not built; requires k-anon / differential privacy infrastructure │    ║
  ║   │                                                                     │    ║
  ║   │  County-level enrollment + error-rate + retention data, suitably    │    ║
  ║   │  anonymized, licensed to:                                           │    ║
  ║   │    • Policy researchers (CBPP, Urban Institute, Brookings)          │    ║
  ║   │    • State agencies / national CBO networks (benchmarking)          │    ║
  ║   │    • Foundations funding SNAP outreach (effect-measurement)         │    ║
  ║   │                                                                     │    ║
  ║   │  Pitch framing: "research partnerships," "policy benchmarking."     │    ║
  ║   │  NOT "selling user data." The distinction matters — CBO partners    │    ║
  ║   │  will recoil at the second framing and applaud the first.           │    ║
  ║   │                                                                     │    ║
  ║   │  Compliance: opt-in user consent + k-anonymity thresholds +         │    ║
  ║   │  differential privacy on outcome statistics. Counsel review of all  │    ║
  ║   │  data products before publication.                                  │    ║
  ║   │                                                                     │    ║
  ║   │  ⚠ RISK: reputation. Any perception of "Civica sells SNAP data"     │    ║
  ║   │  poisons every CBO partnership. Slow, careful, counsel-gated.       │    ║
  ║   └─────────────────────────────────────────────────────────────────────┘    ║
  ║                                                                                ║
  ║   ═══════════════════════════════════════════════════════════════════         ║
  ║   THE COMPOUNDING ARGUMENT                                                    ║
  ║                                                                                ║
  ║   Layer 1 keeps the platform alive.                                           ║
  ║   Layer 2 turns engaged applicants into revenue without compromising trust.   ║
  ║   Layer 3 turns scale into a policy-research moat.                            ║
  ║                                                                                ║
  ║   Pillar 2's engagement → Layer 2 revenue → subsidizes Civica-as-CBO          ║
  ║   → drives more enrollment → larger Layer 3 dataset → policy influence.       ║
  ║                                                                                ║
  ║   This is how Civica reaches long-run financial sustainability without        ║
  ║   becoming dependent on either federal goodwill or grant capriciousness.      ║
  ║                                                                                ║
  ║   SEQUENCING: Layer 1 always first; Layer 2a (EBT offers) second; Layer 2b    ║
  ║   (Medicare cross-sell) third; Layer 3 LAST, only after trust is earned.      ║
  ║   ═══════════════════════════════════════════════════════════════════         ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                          DISTRIBUTION — TWO PATHS                              ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   PATH 1: C-CORP SAAS                       PATH 2: CIVICA-CBO DIRECT          ║
  ║   (lionshare)                               (greenfield cohorts)               ║
  ║                                                                                ║
  ║   ┌────────────────────────────┐            COHORT          CHANNEL            ║
  ║   │ Sales to partner CBO orgs  │            ──────          ───────            ║
  ║   │                            │            College student  Universities /    ║
  ║   │ Named today:               │                             financial-aid?    ║
  ║   │  • Project Bread (MA,      │            Farmworker       UFW               ║
  ║   │    incoming caseworker     │            Gig workers      DoorDash, Uber,   ║
  ║   │    mode design partner)    │             (60+ platforms)  Instacart, Lyft, ║
  ║   │  • [Monday outreach list]  │                              Rover, …         ║
  ║   │                            │            60+ seniors      SEIU 2015 (home  ║
  ║   │ Sales motion:              │                             care), senior     ║
  ║   │  Direct partnerships,      │                             centers, AARP?    ║
  ║   │  RFP responses,            │                                                ║
  ║   │  conference presence       │            ~544K reachable households/yr      ║
  ║   │                            │            → ~$1.0B/yr SNAP household value   ║
  ║   │ Revenue: subscription      │                                                ║
  ║   │  license + 50% USDA FFP    │            Revenue: grants + philanthropy +   ║
  ║   │  for partner CBO (pitch    │             county contracts + 50% USDA FFP   ║
  ║   │  this — partners care)     │             + C-corp subsidy if needed        ║
  ║   └────────────────────────────┘                                                ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                         INTEGRATIONS (data in)                                 ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   Wages:   Argyle ✓        Canvas (dropped)                                  ║
  ║   Addr:    USPS ◐ flag                                                       ║
  ║   Comms:   Twilio ◐ flag    APNs ✓ (EBT push)                                ║
  ║   Submit:  Browserless ◐    (Phase 2 wire-up pending)                        ║
  ║   AI:      Anthropic Claude ✓                                                ║
  ║   Data:    USDA SNAP retailer locator (vendored, CA slice) ✓                 ║
  ║   Policy:  RegOps engine ✓ (Federal Register + CDSS ACL adapters;            ║
  ║              USDA FNS + FTC adapters next)                                    ║
  ║   Verify:  PolicyEngine US (YAML params, fixture outputs only)               ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                       THE HONEST GAPS (pre-Monday)                             ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   ✗  Phase 2 headless submit (Browserless wire-up)                            ║
  ║       └─ workaround: Mode B browser extension works, human clicks submit      ║
  ║                                                                                ║
  ║   ✗  County outcome feedback loop                                             ║
  ║       └─ blocks: "measured PER reduction" claims; ~1d to ship webhook stub    ║
  ║                                                                                ║
  ║   ◐  USDA FNS + FTC adapters (rest of compliance layer)                       ║
  ║       └─ Federal Register + CDSS ACL adapters live; FNS + FTC next            ║
  ║                                                                                ║
  ║   ◐  Operator deploy queue (migrations + secrets + wrangler deploy)           ║
  ║       └─ engineering done; ~30min human action per runbook step               ║
  ║                                                                                ║
  ║   ◐  iOS T3-T7 (Settings sheet, soft ineligibility, iPad, dark mode, DT)      ║
  ║       └─ T7 = 3-4 weeks; T3/T4 = 1 week each. Demo-safe with workarounds.    ║
  ║                                                                                ║
  ║   ✗  The Assignment (named CBO ED for Caseworker Mode build)                  ║
  ║       └─ blocks T2/T5/T14/T15 of Caseworker Mode launch                       ║
  ║                                                                                ║
  ║   ✗  BBCE_REMOVAL_SCENARIO provenance (13.95% TAM number)                     ║
  ║       └─ engine test gates on it; replace TODO-4-spec with CBPP/USDA citation ║
  ║                                                                                ║
  ║   ✗  Layer 2b Medicare Advantage broker partner (revenue path unbuilt)        ║
  ║       └─ requires signed broker contract + CMS-compliant handoff flow         ║
  ║                                                                                ║
  ║   ✗  Layer 3 anonymization infrastructure (k-anon + differential privacy)     ║
  ║       └─ requires opt-in consent flow + counsel review process                ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                    THE FUTURE STATE (deferred, not now)                        ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║                                                                                ║
  ║   PATH 3: B2G DIRECT (Civica → State / County)                                ║
  ║                                                                                ║
  ║   Not pitched in current administration. Unlocks IF:                          ║
  ║     (a) Civica-as-CBO and partner-CBO motions prove efficacy at scale          ║
  ║     (b) State signals willingness to pay for direct integration                ║
  ║     (c) USDA Advanced Automation guidance posture clarifies for non-          ║
  ║         determination automation                                               ║
  ║                                                                                ║
  ║   When unlocked: state pays Civica to integrate into BenefitsCal natively /   ║
  ║   replace selected intake/recert/QC modules. Doesn't change the stack —       ║
  ║   changes the customer.                                                        ║
  ║                                                                                ║
  ╚══════════════════════════════════════════════════════════════════════════════╝

  ═══════════════════════════════════════════════════════════════════════════════
                              LEGEND

      ✓  live in production / merged + verified
      ◐  engineering done, operator action or flag-flip pending
      ✗  no code path / not yet built
  ═══════════════════════════════════════════════════════════════════════════════
```

---

## Pitch sentences (canonical, reusable)

These eight sentences are the verbal version of the map. Each one is
stand-alone and can drop into a partner conversation without setup.

1. **The shape of the business.**
   > "Civica is two things on one stack: a SaaS platform we license to CBOs
   > for SNAP enrollment, and an operating CBO under VoteNow Foundation that
   > serves four greenfield cohorts directly. The operating arm is how we
   > prove the platform works."

2. **The three-pillar narrative.**
   > "We attack failure across the full SNAP lifecycle — Get In, Stay
   > Engaged, Stay On. Three pillars, one engine. Not a scoring model — an
   > applicant-experience platform with auditable engines underneath."

3. **Why Pillar 2 matters.**
   > "Pillar 2 is what makes Civica feel like a product to the applicant,
   > not a transaction they survived. EBT balance, deposit alerts, eligible
   > offers, savings tracking — year-round utility, not annual paperwork."

4. **The CBO economics hook.**
   > "Partner CBOs that license Civica can also claim 50% USDA federal
   > financial participation on their outreach activities. The platform
   > pays for itself."

5. **The moat.**
   > "The error-rate engine has two inputs: real county outcomes (feedback
   > loop, closing this quarter) and the compliance layer — federal, state,
   > and FTC policy ingested live by our RegOps engine. The compliance
   > layer is the moat."

6. **The monetization stack.**
   > "Civica monetizes in three layers: core SaaS license to partner CBOs,
   > engagement-driven cross-sell from the EBT and Medicare-eligible
   > cohorts, and aggregate outcome data licensed to policy research
   > partners. Each layer compounds the others."

7. **Trust posture on monetization.**
   > "Pillar 2 isn't just user value — it's the monetization engine. EBT
   > offer placements, Medicare Advantage cross-sell to the 60+ cohort,
   > all opt-in, all compatible with the trust posture. The platform pays
   > for itself without ever selling user data."

8. **The B2G horizon.**
   > "Direct state integration is Phase 3 — not on our current roadmap; we
   > earn it by proving the first two paths."

---

## How to use this doc

- Read the map start-to-finish before each new partner meeting.
- Pick 2-3 pitch sentences that match the audience (CBO ED vs. county vs.
  channel partner).
- Update gap inventory as items move ◐ → ✓ or ✗ → ◐.
- When a new strategic element lands, regenerate this map with the date in
  the filename. Don't edit in place — keep history.

## Related docs

- `docs/audits/civica-ios-product-audit-2026-05-29.md` — iOS quality audit
  (7 passes, 18 fork decisions, 10 implementation tasks)
- `docs/runbooks/prod-activation-2026-05.md` — operator queue for prod
  activation (migrations, secrets, deploys)
- `docs/findings/INDEX.md` — evidence ledger; canonical strategic findings
- `docs/strategy/civica-flywheel.html` — earlier flywheel visualization
- `docs/outreach/counsel-batch-2026-05-19.md` — counsel outreach drafts
  (hard deadline 2026-06-02)
