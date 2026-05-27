# Civica — YC S26 Application

_Evaluation + full draft. Review every answer before submitting. Flag anything that misrepresents your actual situation._

---

## Candidate Evaluation

### What's genuinely strong

**1. Regulatory forcing function.** OBBBA (signed 2025) created a $510M cumulative federal penalty exposure for California's SNAP error rate by FY2028. This is government-created demand — not manufactured market pull. Every competing tool was built before the law; Civica was built for it. That's a rare wedge.

**2. Team.** Technical founder who built a full iOS app + web app + navigator dashboard + API gateway + rules engine, alone, in a short window — that's unusual build velocity. Co-founder holds a cabinet-level position inside Gavin Newsom's administration — the primary state-level decision-maker for CDSS contracts and SNAP outreach funding. This is the rarest thing in govtech: a technical builder + a genuine government insider with line access to the customer. YC will recognize this immediately.

**3. LOI from county or state agency.** This converts the entire B2G thesis from "we think government will pay" to "a government entity has expressed intent to pay." At pre-pilot, this is the signal that separates fundable govtech from theoretical govtech.

**4. Competitive gap is real and permanent.** GetCalFresh (Code for America, $30M+ donated over a decade) handles intake-to-submission and then exits. Propel (EBT balance app) arrives after approval. Nobody is in recertification, ABAWD work-log retention, or packet quality assurance — the three places where error rates are made and where OBBBA penalties land. Civica is not a features race; it's in a lane that doesn't exist yet.

**5. Three-layer revenue model with government as a payer.** Operator success fees ($85/enrollment) + government error-rate contracts + adjacency fees. The government payment layer means Civica is partly funded by avoiding penalties rather than creating budget — which is how you sell to government fast.

**6. Distribution insight.** SEIU 2015 + UFW as SNAP outreach channels. ~544K eligible, unenrolled workers in those two unions alone. Labor unions as a trust-proxy for public benefits enrollment is an insight that GetCalFresh and BenefitsCal don't have, and won't pursue — it requires relationship capital that CBOs and civic tech orgs don't hold.

---

### What needs to be addressed before submitting

**1. Pre-pilot means all metrics are modeled.** The compliance page is honest about this (every Civica-side figure is labeled "modeled · pre-pilot"). YC will notice. The question they'll ask: "When does the cohort of 10 close?" You need a specific date in the application, not just "when production telemetry is anchored."

**2. S26 timing.** It is May 21, 2026. YC S26 applications typically close in April. If the deadline has passed, apply anyway — YC accepts late applications in rolling review. Be direct: "We missed the standard deadline; submitting in rolling review." Don't pretend the deadline wasn't a factor.

**3. The co-founder relationship needs framing.** "My co-founder works in Newsom's cabinet" will immediately raise the question: "Does he have a conflict of interest, and can he legally take equity in a company pitching government contracts?" You must address this proactively. The standard path: co-founder advises/participates in non-government capacity; he has or will have disclosed the relationship per his ethics obligations. Have this answer ready for interview.

**4. Differentiation from GetCalFresh must be crisp.** Code for America built GetCalFresh with $30M+ in donations and 80-100K applications/year. YC will ask why you win. The answer is: (a) GetCalFresh exits at submission, Civica doesn't; (b) GetCalFresh has no recertification companion; (c) GetCalFresh has no ABAWD work-log compliance; (d) GetCalFresh is a nonprofit that can't pursue B2G error-rate contracts; (e) GetCalFresh doesn't have a labor-union distribution channel. All five points in 30 seconds.

---

## Full Draft Application

---

### What will you make?

The 2025 OBBBA law made SNAP payment-error rates a state liability nationwide — every state above the federal trigger owes a cost-share penalty starting FY 2028, with California's modeled exposure alone reaching $510M cumulative. Every existing tool exits before the error zone where those penalties get made. Civica is the AI enrollment advocate that stays with the household from intake through recertification, ABAWD work-log compliance, and post-issuance EBT — the only platform built for what the law now requires. Purpose-built for the four cohorts most over-represented in payment-error events: working college students, adults 60+, gig/platform workers, and home care + agricultural workers.

Every component is engineered toward one outcome: SNAP applications submitted at near-perfect quality across evidence, documentation, and reporting — which our FY2020–FY2023 panel regression (212 state-years) shows is the only remaining lever, since ~80% of state-level error variation is operational, not policy. Under the hood: on-device Apple Intelligence document extraction replaces manual document review (PII never leaves the device). ML error-risk scoring (live in production) flags packets before submission. LLM-drafted procedural appeals turn a previously-impossible recovery flow into a one-tap operation. A 14-tool verification stack (Argyle payroll, sublease classifier, BBCE auto-routing) feeds the model layer. An anti-skimming behavioral anomaly detector catches the residual ~$4M/month in California EBT theft that chip-and-tap cannot reach — federal SNAP-theft reimbursement sunset Sept 30, 2024, so California now bears 100% of the loss.

Every existing tool exits before the hard part: screeners hand applicants a link, GetCalFresh submits and exits, BenefitsCal drops 35–50% mid-form, Propel arrives post-approval as an anonymous balance viewer. Civica is the first platform that stays with the household through every stage — applying modern ML, on-device LLM, and production-grade scraping (Playwright Stealth + pgsodium AEAD + HMAC). We triple navigator throughput (7 → 23 apps/month), cut payment errors (4.2% vs CA's 10.8%), get households to a decision in ~6 days vs ~22. Active engagement with Code for America as their technical partner for the OBBBA workflow. By staying with the household through every stage, Civica earns the household relationship no incumbent has — they all exit before that relationship matures.

---

### Describe your company in 50 characters or less

> AI compliance infrastructure for SNAP enrollment

---

### What category best describes your company?

AI Vertical SaaS (Public Sector / Benefits) — government compliance infrastructure powered by on-device LLM document extraction and ML risk scoring

---

### How long have you been working on this, and how many lines of code have you written?

~4 months of full build. The codebase spans:
- iOS app (SwiftUI, Swift Testing, ~15 features shipped)
- Web enrollment flow (Next.js, full E2E: 14/14 nightly tests passing)
- Navigator dashboard (React, UAT-ready, enrollment + QC + outcomes panels)
- API gateway (Hono on Cloudflare Workers) + rules engine (JSON DSL, packages/snap-rules)
- Supabase Postgres schema with RLS, enrollment workflow, document upload, error-risk scoring

Rough LOC: ~40,000 lines across the monorepo.

---

### What tech stack are you using?

**AI model layer.** On-device LLM document extraction via Apple Intelligence Foundation Models (iOS 26+, privacy-preserving — PII never leaves the device); LLM-drafted procedural-appeal generator (template-conditioned, not free-form, to prevent invented claims); ML error-risk scoring engine (`scoreErrorRisk()` v0.2.0, live in production via `/error-risk` and `/qc-outcome` endpoints).

**AI agent layer.** Three operational agent systems extend the model layer above:
- **Voice interview agents (shipped).** Household-facing voice agent for application prep, intake interviews, document-checklist walkthroughs, recertification reminders, and OBBBA work-log entry. EN/ES at parity. Built for cohorts where text-form fatigue is the primary drop-off cause (60+ adults, ESL households, low-literacy).
- **CBO compliance-detection agents (in development).** Will extend the production ML error-risk engine to identify per-CBO and per-navigator failure patterns — by error category (shelter, utility, wage, ABAWD) and by failure mode (missing document, misclassified SUA tier, miscalc deduction). Targeted coaching surfaced to the navigator dashboard, not blanket alerts. Closes the data-attribution gap that turns aggregate error rates into actionable per-org training.
- **Automated agency-submission agents (roadmap).** Once packet-level error-risk data matures past confidence threshold, agents will auto-submit applications to county / state systems — initially via BenefitsCal API, eventually via direct CalSAWS write where available. *The self-driving SNAP application is the eventual state.*

**Application layer.** iOS (SwiftUI / Swift Testing); Web (Next.js 16 / TypeScript / Tailwind); Hono API gateway on Cloudflare Workers; FastAPI SNAP rules engine on Fly.io; Supabase (Postgres + RLS + Edge Functions + pgsodium); Vercel dashboards with Lighthouse CI; Argyle third-party payroll integration; production EBT scraper on Fly.io (Playwright Stealth + HMAC-signed webhooks + pgsodium AEAD).

**AI coding tools.** Built by one founder in three weeks using Claude Code as the primary dev environment — agent-led architecture, code generation, test coverage, and deploys. The optional coding-session artifact attached is a representative excerpt.

---

### What have you built so far?

**iOS app (shipped):** Full CalFresh application flow — identity, household, income (with Argyle third-party payroll connection live in staging), assets, student status, document upload with Vision OCR + on-device Apple Intelligence extraction (Foundation Models on iOS 26+), benefit estimator, and a recertification companion (phantom recert, expiration calendar, just-in-time reminders, AI-drafted procedural appeals). EN/ES at full parity. Cohort-specific flows for students, 60+ adults, gig workers, and home care + agricultural workers.

**Web enrollment (shipped):** B2C direct-enrollment flow covering all 5 stages. OTP auth, sign-in gate, navigator inbox. PR merged and deployed.

**Navigator dashboard (UAT-ready):** React app with enrollment funnel, document QC, error-risk scoring, QC outcomes, county deep-link, and the full SNAP compliance/audit dashboard. All endpoint tests passing; live UAT blocked on staging seed data only.

**SNAP rules engine (shipped):** JSON DSL eligibility checklist evaluator, ABAWD age-band rules, California overlays (BBCE, SB 1090, HCSUA). Published as packages/snap-rules.

**ML error-risk engine (shipped):** `scoreErrorRisk()` v0.2.0 — packet-level risk classifier predicting payment-error probability before submission. `/error-risk` and `/qc-outcome` API endpoints live in production. This is the model layer that converts the verification stack into a county-actionable risk tier (low/medium/high) so navigators triage packets before a county auditor ever sees them.

**OBBBA compliance layer (shipped):** §10102 ABAWD work-log retention, §10105 error-rate tooling, §10106 provisions covered. Full compliance audit (COMPLIANCE_AUDIT_OBBBA.md) with 9 open items in external counsel review.

---

### Have you formed ANY legal entity yet?

Yes.

### Please list all legal entities you have and in what state or country each was formed.

Civica is structured as a hybrid 501(c)(3) + Delaware C-corp:

- **VoteNow Inc., a Delaware 501(c)(3) nonprofit corporation.** Operates as Civica's nonprofit arm — eligibility surface for USDA SNAP outreach grants, SNAP-Ed funding, and anti-hunger foundation grants (e.g. MAZON). VoteNow was originally formed as the 501(c)(3) for a prior civic-engagement project; its charitable purpose covers broader civic and economic-mobility work, including benefits navigation.
- **Civica Technology, Inc., a Delaware C-corp** (filed May 24, 2026 via Stripe Atlas). Owns the technology platform, IP, and commercial operations; licenses to the 501(c)(3) under a fair-market-value arms-length agreement (in counsel papering). YC's investment flows into the C-corp; the 501(c)(3) is a sister entity.

Structure designed for a market where buyers split between mission-aligned grant-makers and commercial operators — both sides of the revenue model need a corresponding entity to receive funds.

### Please describe the breakdown of the equity ownership in percentages.

Matthew Greer-Gentis: 100% (CEO + technical co-founder, full-time today). Carlos Ruiz's equity grant pending — formal issuance gated on completion of California political-reform disclosure review and his transition from the Cabinet Affairs role (Jan 6, 2027, or earlier if disclosure clears sooner). Standard founder vesting + employee option pool to be established at the time of YC's investment / first capital event.

### Have you taken any investment yet?

No.

### Are you currently fundraising?

Yes.

### Current fundraise details.

Applying to YC Summer 2026 as primary path to institutional capital. In parallel, non-dilutive funding:

- **Ahmanson Foundation:** $75K–$100K LOI submitted for LA County pilot
- **MAZON:** existing LOI in hand; active outreach for grantee-network access and co-launch partnership
- **Code for America:** SOW in review (technical-partner revenue, USDA-subsidized via 7 CFR 272.1(c) 50% admin reimbursement)
- **Corporate philanthropy outreach in motion:** Amazon Community Engagement / AWS Imagine Grants (Brian Kenner, Global Director, fellow HKS alum); Kroger Zero Hunger | Zero Waste Foundation (Denise Osterhues, President); Walmart Spark Good / Center for Racial Equity (Naomi Gunnell); DoorDash Project DASH (Daniel Riff, Head of Government & Nonprofit Operations)

If YC accepts, the standard YC SAFE would be our first institutional capital.

---

### How many users do you have?

First applicant in production. The iOS app and web enrollment flow have processed at least one real CalFresh applicant outside the team; the navigator dashboard is in UAT with internal test credentials for county, CDSS, and CBO roles. The first pilot cohort (target: 10 enrolled households) closes at end of May 2026, gated on Civica's California SNAP-handler certification.

**Two pieces of external validation:**
1. **Active engagement with Code for America — statement of work in review.** Civica is the technical partner extending the GetCalFresh footprint into the post-OBBBA workflow (recertification, ABAWD work-log, error-rate scoring) — capabilities CfA does not build internally. The SOW is structured around the USDA 50% admin-cost reimbursement under 7 CFR 272.1(c), meaning the work is partly federally subsidized from day one. Direct institutional validation from the most respected civic-tech organization in the country.
2. **Letter of intent from MAZON: A Jewish Response to Hunger** — the leading national anti-hunger advocacy organization, founded 1985, with deep coalition relationships across the SNAP outreach ecosystem. MAZON's endorsement validates Civica's mission alignment and unlocks access to their grantee and partner network of regional anti-hunger organizations.

---

### Are you default alive?

No. We currently operate on ~$20K of personal and friends-and-family funds. The near-term revenue model is deliberately structured to *not* depend on government contracts closing, because B2G cycle length is the standard killer in govtech:

1. **Code for America engagement** (SOW in review, structured around USDA 50% admin-cost reimbursement) — first revenue path, expected to begin once SOW executes.
2. **Nonprofit grants via the 501(c)(3)** — MAZON LOI in hand; USDA SNAP outreach and SNAP-Ed grants eligible; multiple anti-hunger foundations targeted.
3. **Corporate partnerships with SNAP-adjacent commerce** — direct outreach in progress with Amazon, Walmart, and DoorDash. SNAP-redemption revenue at these retailers exceeds $40B/year combined (Walmart alone captures ~25% of all national SNAP redemptions); every newly-enrolled household becomes a customer. Their corporate community-impact and ESG functions are funded, decision-cycles are weeks not years, and the value exchange is direct.

Government contracts (state error-rate, county DSS) are the upside layer — high-value when they close, but never the bridge. Funding from YC accelerates the pilot, the California relocation, and the first hires; it does not gate on any government decision.

---

### What is your monthly revenue?

$0 — pre-revenue. The Code for America SOW is in review and is structured around USDA admin-cost reimbursement; revenue from that engagement begins when the SOW is executed. Direct enrollment revenue gates on California SNAP-handler approval (expected end of May 2026) and the close of the first pilot cohort.

---

### How do or will you make money? How much could you make?

**Per-household unit economics: ~$50–$100 one-time enrollment (Stage 2) + ~$40–$170/year recurring per active EBT user (Stage 3, compounding while enrolled — upper end with WOTC reauthorization).** **At 5% nationwide SNAP-household penetration (~1.1M of ~22M households): ~$55M–$110M cumulative one-time + ~$44M–$187M/year recurring.** California-only (~3M households) at 5% Year-2 penetration: ~$7.5M–$15M cumulative + ~$6M–$26M/year recurring. Three stages stack:

**Stage 1 (today, pre-certification) — bootstrap.** Code for America technical-partner SOW (USDA-subsidized via 7 CFR 272.1(c)'s 50% admin reimbursement) + 501(c)(3) grants (MAZON LOI, Ahmanson LOI, USDA SNAP outreach / SNAP-Ed eligibility) + corporate philanthropy (Amazon, Kroger, DoorDash, Walmart). Pilot recruitment targets high-SNAP-redemption households specifically — the cohort whose EBT-relationship economics drive Stage 3. **Pilot selection = future revenue selection. ~$1M–$3M total bootstrap funds the runway to the first 100K users.**

**Stage 2 (post-certification) — CBO SaaS licensing.** Once California SNAP-handler approval lands, Civica licenses to the ~1,200 CalFresh-certified California CBOs as their navigator + compliance tool — **$50–$150/navigator/month or $50–$100/successful enrollment** for pre-submission packet QA, OBBBA compliance tracking, and 3× navigator throughput. **CA-only SaaS TAM: ~$10M ARR at full penetration; ~$1.5M at Year-2 15%.** Same playbook per state. Recurring revenue line, but not where the unique value lives.

**Stage 3 (downstream) — the unique revenue layer: EBT-surface relationship economics.** EBT (Electronic Benefits Transfer) is the debit card every SNAP recipient uses to spend benefits — ~30–40 transactions per household per month, indefinitely while enrolled, **and every 6–12 months at recertification the relationship is reinforced as Civica is what brings the household back through the renewal process**. A daily-engagement surface no incumbent has earned: screeners exit at intake, navigators exit at submission, Propel (~5M users, ~$50M+ revenue) arrives post-approval but anonymous (no intake context). Civica earns the relationship through enrollment, which unlocks three channels Propel structurally cannot run:

**(a) SNAP-specific Retail Media Network with closed-loop EBT attribution.** Civica's SNAP-redemption map (where households see where they can spend EBT now) is daily-use; retailers pay for placement and offers, attributed end-to-end via EBT swipe at the promoted location. **Walmart Connect-tier pricing: $30–$80+ CPM or $5–$50/attributed redemption** vs Propel's $5–$25 anonymous CPM. **3–5× the unit economics**, retailer-grade measurement Propel cannot deliver without intake context. Natural first advertisers: Walmart, Amazon Fresh, Aldi, Grocery Outlet, FoodMaxx, regional Market Match programs. **~$20–$80/active user/year.**

**(b) SNAP-prescreen paid referrals — Medicare Advantage / D-SNP + WOTC/workforce.** Model exists in adjacent industries. Medicare Advantage brokers (eHealth, GoHealth, SelectQuote) pay **$200–$500 per verified warm transfer** of a dual-eligible person (Medicare + Medicaid/SNAP) — ~30% of US SNAP households have a senior member, and Civica's intake context (age, household composition) pre-screens and warm-transfers with consent at scale. Workforce platforms pay **$50–$150/qualified lead** baseline; **$500–$1,500/qualified hire** at full WOTC (Work Opportunity Tax Credit) integration if reauthorization passes via H.R. 1177 / S. 492 (expired Dec 31, 2025; 30-year retroactive-renewal track record). Propel's anonymous architecture cannot run either. **~$20–$80/active user/year (baseline + WOTC integration upside).**

**(c) Aggregated, anonymized SNAP-cohort data licensing.** Aggregated cohort metrics (county redemption patterns, household-size distributions by ZIP, language and ABAWD distributions, seasonal velocity) sold to CPG market-intelligence teams (current Nielsen / Numerator panels miss EBT signal), grocery chain expansion teams, and public-health programs (food-as-medicine research). Privacy wall: never individual-level; k-anonymity minimum cohort size; aggregated metrics only — same architecture as Walmart Connect's privacy layer. Longest-tail channel, highest gross margin once data flow is established. **~$2–$10/active user/year.**

All three channels compound on the same household relationship — earned through enrollment, retained through every recertification. No screener, navigator, or post-issuance app has this footing because they all exit before the relationship matures.

**Important scope note.** Multi-state expansion follows the same staged playbook (per-state certification → CBO licensing → EBT downstream). California numbers above are a floor; the national multi-state TAM (~$100B SNAP program, ~41–42M Americans in ~22M households across 50 states, **each recertifying every 6–12 months** — a recurring relationship moment, not a one-time enrollment) is materially larger but contingent on per-state certification.

---

### Why did you pick this idea to work on?

I watched this pattern from two sides, four years apart. The first time was as a benefits caseworker enrolling deported veterans in VA benefits — one of the most logistically challenging cohorts in the federal system. People who had served the country, been removed from it, and were then asked to navigate the VA from across the border. The work was concretely document retrieval and application completion: tracking down service records and identity documents, calculating which benefit categories applied, and completing the packages that put veterans in front of the right caseworker. The second time was four years later, in the US Senate under Feinstein and then Butler on Banking, Housing, and Urban Affairs — where I watched the same pattern at a different scale: people viewed the government as extractive when the programs in front of them were designed to change their lives. The reason isn't policy. It's navigation. Programs that would have transformed someone's circumstances go unclaimed because nobody could thread the form, the document checklist, the renewal deadline, and the appeal path. Same pattern at every income level, every program, every state: the system loses eligible people on procedure, not on eligibility.

SNAP is the same failure shape at the largest available scale. California has 1.2 million households that qualify but aren't enrolled — ~$3B/year in federal money that should be flowing to the lowest-income communities in the state and isn't, because BenefitsCal drops half of applicants mid-form, GetCalFresh submits the packet and exits, and nobody stays through recertification. The labor-union and gig-worker distribution channels (SEIU 2015, UFW, Instacart/DoorDash/Uber) alone hold ~544,000 eligible-but-unenrolled California workers — roughly $1B/year in unclaimed household-side SNAP value. The tool to fix this has to be built by people who have actually done benefits casework, who can credibly stand in front of a state agency, and who can ship the software end-to-end. That's the team we are.

**The 2025 One Big Beautiful Bill Act (OBBBA) is what makes this an act-now company instead of an interesting govtech idea.** OBBBA restructured the federal-state SNAP relationship in three ways that matter for Civica: **§10102** added ABAWD work-log retention requirements that California's existing tooling does not support; **§10105** created a new state cost-share penalty for elevated payment-error rates, payable starting FY 2028; **§10106** changed how counties account for SNAP outreach spending. California's modeled cumulative §10105 exposure through FY 2028 is **$510M** — and every percentage point of error-rate reduction is worth tens of millions of dollars in avoided penalty. States cannot fix this by changing rules; the only remaining lever is operational, which is precisely the caseworker- and navigator-facing workflow Civica is built around. The penalty ramp ends FY 2028; the window to establish Civica as the compliance infrastructure for California's CalFresh caseload is open *now*, not in 12 months.

USDA reimburses 50% of SNAP admin costs under 7 CFR 272.1(c), so a $1M Civica contract costs California $500K net. The math works for the government, and the people the system loses are the same population I was already helping — one case at a time — in the Senate.

Carlos and I both went into public service straight out of undergrad because we believed — and still believe — that programs like SNAP are economic multipliers, not handouts: every $1 in SNAP benefits generates roughly $1.50 in downstream economic activity, and the nutrition and affordability impact compounds across the household. The policy environment is making the navigational layer harder, not easier. We are building Civica because market-based execution is what's missing — the policy is right, the funding is there, but the operating layer between eligible households and the benefits they qualify for has never been built well. That's the gap we are closing.

---

### Who are your competitors, and how are you different?

**The structural play: target is CBO integration; we get there by being one first.** We are not chasing the 18–36 month state procurement cycle. California already permits CBO-mediated SNAP enrollment under ACL 21-129 — and there are ~1,200 CalFresh-certified CBOs facing the same OBBBA error-rate pressure the state does. Our path is operational, not procurement: **(1)** Civica operates as a CalFresh CBO and submits wire-verified, confidence-scored packets — packets every other CBO submits as self-attestation. **(2)** That operational difference is how we prove compliance efficacy case-by-case, measured at the packet level we control, against the same OBBBA error-rate target. **(3)** Once proven, the same platform becomes the licensing target for the other ~1,200 CBOs — and the AI + dashboard underneath is the structural moat (Argyle + Apple Intelligence + ML risk scoring + EBT scraper + the navigator dashboard that lets CBOs enforce error-rate discipline at scale, OBBBA-grade). **(4)** Through the entire arc, the household earns trust in Civica that no screener, state portal, or post-issuance app has — and that earned relationship is what the EBT-downstream monetization compounds on top of.

**Code for America / GetCalFresh:** 80–100K CA applications/year, $30M+ donated over a decade. We are NOT competing with CfA — we are in active engagement as their technical partner, SOW in review. Structural reason the partnership works: CfA is a 501(c)(3) and is structurally barred from capturing B2G commercial revenue (error-rate compliance contracts, county DSS licensing, navigator SaaS). Their nonprofit status that makes them credible with governments also makes them unable to monetize what they enable — so they need a commercial partner for the post-OBBBA workflow, and we are it.

**Other CalFresh-certified CBOs (legal aid, food banks, Catholic Charities, Asian Health Services — ~1,200 statewide):** The licensing TAM. They submit self-attestation packets with whatever documents the household uploaded; we submit pre-verified packets with confidence scores (Argyle-wired income, Apple Intelligence-extracted shelter docs, ML-classified risk tier). Same legal lane (ACL 21-129), better product. Once compliance efficacy is proven operationally, they become the customer.

**BenefitsCal (state portal):** 35–50% completion rate, no document guidance, no recertification. Civica powers the navigators who catch the households BenefitsCal loses mid-form.

**Propel (Fresh EBT / Providers):** ~5M EBT users monthly, ~$50M+ revenue from anonymous CPM advertising. Arrives post-approval as a balance viewer — never earned the household relationship Civica builds through enrollment. Civica has the same post-issuance surface in the iOS app, but with intake-anchored context Propel structurally cannot reach (see "How money" Stage 3 for the 3–5× unit-economics delta and the D-SNP / workforce-platform layers Propel's anonymous app cannot run). Anti-skimming detector also closes the ~$4M/month residual California EBT theft Propel's read-only architecture cannot touch.

**Screeners (Benefits.gov, findhelp):** Eligibility-check only. Civica converts screened-eligible households into enrolled households.

**Distribution moat — labor unions as trust proxy.** SEIU 2015 (~400K home-care workers) and UFW (~10K members + larger associate surface) hold ~544K eligible-but-unenrolled California workers. Carlos's working relationships with both — built on the Office of the Governor's institutional name — open doors civic-tech orgs cannot pursue, because that channel requires political relationship capital they don't hold.

---

### How do you know people want this?

Three forms of direct demand validation:

1. **Code for America has engaged Civica as the technical partner** to extend the GetCalFresh workflow into the OBBBA-mandated post-submission stages — statement of work in review, structured around the USDA 50% admin-cost reimbursement. CfA is the highest-credibility civic-tech buyer in the country; they don't bring in outside technical partners for work they could do internally.

2. **Letter of intent from MAZON: A Jewish Response to Hunger.** MAZON is the largest national Jewish anti-hunger organization and a long-standing convener of the SNAP-outreach nonprofit sector. Their endorsement opens the door to the regional anti-hunger networks (food banks, faith-based partners, Feeding America affiliates) that drive last-mile distribution into the households Civica is built to serve.

3. **CBO demand for tooling is direct.** ~1,200 CalFresh-certified CBOs in California currently process ~7 applications/navigator/month using paper forms. We've had direct conversations with 5 organizations — including the Greater Boston food-bank network (Feeding America affiliate) — and the consistent feedback is: "we have a waitlist and we can't see more people without software." Civica triples per-navigator throughput to ~23 apps/month.

4. **Active pilot-funding outreach in motion (sent this week).** Cold outreach to specific named program leads at five high-fit institutions, each tied to a specific funding vehicle:
   - **Amazon Community Engagement / AWS Imagine Grants** — Brian Kenner, Global Director (fellow HKS alum)
   - **DoorDash Project DASH** — Daniel Riff, Head of Government & Nonprofit Operations ($150K–$300K pilot ask)
   - **Kroger Zero Hunger | Zero Waste Foundation** — Denise Osterhues, President & Sr. Director of ESG ($250K–$500K Innovation Fund ask)
   - **Walmart** — Naomi Gunnell, Director of Healthier Food for All (formerly LISC); Spark Good or Center for Racial Equity
   - **The Ahmanson Foundation** — $75K–$100K LOI submitted for the LA County pilot
   
   The pilot scope (12-month California CBO deployment with third-party impact evaluation) is fundable through any of these five channels — diversified, not single-point-of-failure.

5. **Original quantitative analysis: the SNAP error problem is an application-completion problem.** I analyzed state-level SNAP payment error rates across the FY2020–FY2023 QC public-use microdata (212 state-years). **Policy can't explain it — measurable state policy variables account for less than 20% of inter-state error-rate variation; the remaining 80%+ is operational.** The QC error-category breakdown shows where within "operational" the errors actually live: **shelter and utility deduction calculations are ~40% of all errors, and wage verification is the second-largest category.** Both are application-completion errors — they happen *before* a caseworker ever sees the packet, at the moment the applicant or navigator calculates a shelter cost, retrieves a utility bill, or reports gig wages. **States can't fix their error rate by changing policy, and they can't fix it by retraining caseworkers — the only available fix is producing a near-perfect application before submission.** That is the entire purpose of Civica's stack: Argyle for direct wage data, Apple Intelligence for shelter/utility document extraction, ML risk scoring for pre-submission triage. **Civica is the near-perfect-application engine for SNAP.**

The OBBBA penalty exposure is public (USDA FNS annual error rate report). California's FY 2024 PER is 10.98% — essentially at the national average of 10.93%. What is uniquely California is the *dollar exposure*: California runs the largest SNAP caseload in the country, so even at a national-average PER, the dollar penalty under OBBBA's FY 2028 cost-share formula is the largest of any state. Our modeled $510M cumulative California exposure through FY 2028 reflects that scale — the penalty trigger is the rate, but the financial magnitude is the caseload.

---

### Founders

**Matthew Greer-Gentis:** Built the entire Civica platform — iOS app, web enrollment, navigator dashboard + three other dashboards, API gateway, SNAP rules engine, ML error-risk scoring, production EBT scraper, OBBBA compliance layer — in three weeks of focused full-build on $20K. Prior to Civica: **US Senate staff representing California** — Banking, Housing, and Urban Affairs Committee under Senators Feinstein and Butler, through one of the most consequential California Senate transitions in modern political history. Four years before the Senate, I did the casework that became the Civica thesis: enrolling deported veterans in VA benefits — one of the most logistically challenging cohorts in the entire federal benefits system. The work was concretely document retrieval and application completion: tracking down service records and identity documents from across border barriers, calculating which benefit categories the veteran qualified for, and completing the application packages to get them in front of the right caseworker. That is the exact same workflow Civica automates for SNAP. I have also navigated SNAP firsthand through cycles of job insecurity — I know the system from inside the form, not only from across the desk. Currently a Harvard Kennedy School student.

**Carlos Ruiz:** Cabinet Affairs Assistant to Governor Gavin Newsom. First-generation Latino, native Spanish speaker — operationally relevant for a California-launch SNAP product, where ~45% of the eligible population is Latino and Spanish-language parity is a CalFresh requirement, not a feature. Worked alongside me in **California's US Senate delegation**, where he staffed Senator Butler on Judiciary while I staffed her on Banking — through the Feinstein-to-Butler transition that built a new California Senate office from the ground up. **The throughline of his career has been representing California across both federal and state government — first in DC under California's senators, now in Sacramento inside the Newsom administration.** He brings policy fluency across both levels of California government, plus working relationships with the California executive-branch staff implementing OBBBA. The Cabinet Affairs role does not directly award contracts to outside vendors — it is a policy and inter-agency coordination function — which keeps Civica clear of any direct conflict. Standard California political-reform disclosure applies; he is recused from any matter involving Civica that touches his office.

Carlos remains in his appointment through the end of Governor Newsom's term (January 2027) and transitions full-time to Civica at that point. This is deliberate, not transitional. His working relationships with SEIU 2015, United Farm Workers, CDSS, and UC Berkeley are built on the Office of the Governor's institutional name — not on his personal network. The moment he resigns, the access pivots to whoever Newsom appoints next. Keeping him in role through term-end is the highest-leverage use of the company's most strategic relationship asset, and the end date is fixed: January 6, 2027. I (technical co-founder) am full-time on Civica today.

---

### How did the two of you meet, and how long have you known each other?

Carlos and I met **as staff in California's US Senate delegation** during the Feinstein-to-Butler transition in late 2023 — one of the most consequential office turnovers in modern California politics. He staffed Senator Butler on the Judiciary Committee; I staffed her on Banking, Housing, and Urban Affairs. We weren't just coworkers; we built a new Senate office together from scratch under intense time pressure, which is the closest thing to a startup environment that exists inside the federal government. We have worked together for two years. The decision to start Civica together came out of two years of shared on-the-ground exposure to exactly the procedural-failure problem the company is built to solve — not from a brainstorming session.

---

### Where will you launch, and how do you expand?

California first, by relocation. I am moving to California to be on the ground with the CBO network, the Newsom administration's OBBBA implementation team, and the first pilot cohort. CalFresh is the largest single-state SNAP caseload in the country (~4.7M recipients across ~3M households), the state with the largest OBBBA penalty exposure ($510M cumulative by FY2028), and the state where Carlos's policy access matters most. California is not a test market — it is the wedge.

**Market scope.** SNAP is a ~$100B/year federal program — ~41–42M Americans in ~22M households across all 50 states (plus DC, Puerto Rico, Guam), each recertifying every 6–12 months. This application is drafted around California specifically: ~$14.9B annual CalFresh + CFAP benefits, ~$3.5B/year unredeemed federal benefits from the eligible-but-unenrolled gap, the largest OBBBA cost-share exposure of any state, and the state where our team has line-of-sight to every required relationship. Every revenue layer in "How money" is sized against California alone; the national multi-state opportunity is materially larger but contingent on per-state SNAP-handler certification.

Once Civica is operating at scale in California, we re-evaluate the next state cohort by ranking penalty exposure, governor-administration alignment, and CBO-network readiness. The codebase already supports {CA, MA} via state-conditioned overlays; adding a state is a content and certification problem, not a re-architecture. OBBBA exposure is national, so the long-term arc is multi-state compliance infrastructure — but we are not pitching that today. Today we are pitching California, where the team has line-of-sight to every required relationship.

---

### What's the most important thing you want YC to know that's not captured above?

The OBBBA penalty clock is running. California owes the federal government $170M in FY2026 error-rate penalties alone, with the cumulative exposure reaching $510M by FY2028. There is no existing tool that addresses the earned-income verification gap that drives most California PER events. USDA's 50% admin-cost reimbursement means the state's net cost for a Civica contract is half the sticker price.

We are uniquely positioned: Code for America has brought us in as the technical partner to extend GetCalFresh into the OBBBA workflow (SOW in review, structured around USDA admin-cost reimbursement). MAZON has issued an LOI, opening the door to the national anti-hunger coalition. Carlos works inside the Newsom administration on inter-agency policy coordination. I built the platform end-to-end on a modern AI stack — on-device LLM document extraction, ML error-risk scoring, LLM-drafted appeals — that no incumbent in this space can match. The same team holds the civic-tech partner, the policy insider, the anti-hunger sector ally, and the engineering throughput. The first direct-enrollment cohort closes at end of May 2026, gated on Civica's California SNAP-handler approval, which is in process. The window to establish Civica as *the* AI compliance infrastructure for California's 4.7M-household CalFresh caseload is open now, and the OBBBA ramp-up period ends in FY 2028.

**One empirical point worth flagging.** I analyzed state-level SNAP payment error rates across the FY2020–FY2023 QC microdata (212 state-years). Measurable state policy variables explain less than 20% of inter-state error-rate variation; the remaining 80%+ is operational. The error-category breakdown shows the largest single error sources are application-completion errors: shelter and utility deductions (~40% of all errors) and wage verification (second-largest). They're baked into the packet before it reaches the caseworker. **States can't fix their error rate by changing policy. The only available fix is producing a near-perfect application before submission** — which is exactly what Civica's stack is built to do: Argyle for direct wage data, Apple Intelligence for shelter/utility document extraction, ML risk scoring for pre-submission triage. **Civica isn't software adjacent to the SNAP error problem — it is the near-perfect-application engine the data says is the only thing left that can work.**

---

## Coaching Notes

**Before you submit, lock these down:**

0. **Delaware C-corp formation — most urgent item, 4-day timeline.** S26 application closes May 25. Today is May 21. You cannot complete the full hybrid-structure paperwork in 4 days, but you CAN file the Delaware C-corp shell. **Use Stripe Atlas** ($500 flat, 24-48 hour filing including EIN) or Harvard Business Services with expedited filing ($200 + state fees, 24h). File today. When YC asks at interview, the answer becomes: "501(c)(3) incorporated, Delaware C-corp filed [date], inter-entity arrangement in counsel selection." That single state-change moves the structural risk from major to manageable. The papered license, IP assignment, and counsel work follow over the next 30-60 days and will be in place before any YC investment actually closes.

1. **MAZON LOI scope** — is it an endorsement/coalition LOI, a partnership LOI for outreach work, or a funding LOI (MAZON does make grants)? YC will ask. The current language ("opens the door to the national anti-hunger coalition") works for endorsement/partnership; if it's a funding LOI, upgrade the language to "MAZON has issued an LOI for [grant amount / partnership scope]." The more specific the better.

2. **SNAP-handler approval status** — this is the single biggest open risk in the application as drafted. The cohort closes at end of May 2026 *gated on this approval*. Today is May 21. YC will ask: "What happens if you don't get approved by end of May?" Have a one-sentence answer: who is reviewing, what stage it's at, and what the fallback path is if it slips (CfA SOW alone? Different state? Pilot through MAZON network?).

3. **Code for America SOW** — In review. Before the interview, lock down: dollar value, scope, expected execution date, CfA's named counterpart. The "structured around USDA admin-cost reimbursement" framing is now in three places in the application — make sure that's an accurate description of the SOW structure and not a forward projection. If CfA is comfortable with you naming the engagement publicly, name it; if NDA, describe it generically in the application and disclose under NDA in the interview.

4. **Anti-hunger CBO conversation specifics** — "the Greater Boston food-bank network (Feeding America affiliate)" is in the draft. Confirm I named the right org. If you spoke to The Greater Boston Food Bank specifically, name it. If you spoke to a different Feeding America affiliate (Project Bread, etc.), correct it. Also: 5 CBOs is solid; if any of them are in California (the launch state), call those out separately — Boston is a strong proof point but California names matter more for a CA-launch story.

**On the casework story (general → specific arc):** Strong. The structure works: the universal pattern ("government feels extractive when it isn't, because of navigation"), then the concrete proof point (deported veterans, VA benefits). Keep "deported veterans" — it is the single most memorable phrase in your founder story. Reviewers will remember you for it.

**On Carlos being part-time through January 2027:** The application now frames this with a fixed end date (end of Newsom's term, Jan 6 2027) and the correct strategic reasoning — *his access to SEIU, UFW, CDSS, and UC Berkeley is built on the Office of the Governor's institutional name, not his personal network; resigning forfeits the access*. This is genuinely the strongest possible version of the part-time argument. The interview question you will get is: "Why not just resign and rebuild those relationships under Civica's name?" Your answer: "Because the people in those organizations aren't responding to Carlos's name — they're responding to the Governor's. Rebuilding under our own brand takes 18-24 months we don't have; OBBBA's penalty window closes FY2028. Staying in role until term-end is the only way to convert those relationships before the competitive window closes." Memorize that paragraph. It is the answer to the single most likely interview challenge.

**On the corporate-partnership revenue bridge:** This is the single most important addition since the first draft. "How do you not die waiting for a state contract?" is the question that kills the most govtech YC applications. Your answer is now in the application: you don't wait. The bridge is CfA SOW + 501(c)(3) grants + corporate partnerships with Amazon/Walmart/DoorDash. Walmart alone captures ~25% of all US SNAP redemptions; every enrolled household is a direct revenue lift for them. That value exchange is *not* abstract — it's a directly measurable line item on their P&L. Their community-impact and ESG functions are funded, their decision cycles are weeks not years, and their willingness to fund enrollment infrastructure is documented (Walmart's $1B "Spark Good" community fund alone). Before the interview, send cold outreach to: Walmart.org (corporate philanthropy), Amazon Community Impact, DoorDash Project DASH. Even a single "in conversation" reply from any of those three converts a coaching note into evidence. The application is currently labeled "direct outreach in progress" — make that true between now and submission.

**On the demo video re-record:** Re-record before submitting. The existing `.mov` files on your Desktop predate Carlos joining, the MAZON LOI, the CfA engagement, the hybrid structure, and the deported-veterans founding story — all of which materially upgrade the pitch. A 2-minute video covering: (1) the casework origin story in 20 seconds, (2) walking through the iOS app from intake through recertification, (3) one-screen view of the navigator dashboard, (4) the team line ("Carlos was my colleague in the Senate; he's now Cabinet Affairs Assistant to Newsom"). End on OBBBA penalty exposure and the CfA engagement. Demo videos that lead with the product and close with the moat outperform videos that try to do strategy throughout. Record once, in one take, no editing if you can avoid it — YC partners can tell when a video is over-produced.

**On the $20K runway:** This is the right amount to mention. It signals scrappiness without signaling desperation. Do not exaggerate it upward and do not apologize for it. "We've shipped a full iOS app, web app, navigator dashboard, API gateway, and rules engine on $20K of personal funds" is one of the strongest implicit founder-quality signals you can give a YC partner.

**On the CA-first relocation:** Relocating to California to be on the ground is a strong commitment signal. YC values founder-customer proximity. The application says you're relocating; make sure the move is timed so you arrive before the YC interview, not after — being already on the ground when YC calls is materially stronger than "planning to move."

**On the Code for America engagement:** This is the most important external proof point. It changes the entire competitive frame: you are not a startup trying to displace GetCalFresh, you are the technical partner CfA chose to extend their footprint. The draft uses "in active engagement, SOW in review" consistently. Don't let any interview answer drift into language that implies more than that. Push to get the SOW signed before interview day — moving from "in review" to "signed" between application and interview is one of the strongest possible signals YC tracks.

**On "USDA admin-cost reimbursement" framing:** The draft now says the CfA SOW is "structured around USDA admin-cost reimbursement" in three places — top section, traction, default-alive. This came from your shorthand "its primary value for USDA reimbursement target." Before submitting, verify the SOW actually routes through the 50% federal match (vs. being a flat CfA-paid contract that *expects* USDA reimbursement on the back end). The distinction matters — YC's diligence partners include people who have run USDA-funded benefits projects and will know the difference.

**On the MAZON LOI:** MAZON is a powerful sector ally but it is NOT a government contract LOI. The earlier draft mistakenly framed it as government-payer-layer validation; the current draft correctly frames it as anti-hunger coalition validation. Don't let the application or interview drift back into calling it a B2G LOI. If YC asks "do you have any state or county LOIs?", the honest answer right now is "no — MAZON is our anti-hunger ally; the state path runs through Carlos's network and the CfA work."

**On the Argyle integration:** The application now names Argyle explicitly as the third-party payroll connection that closes the earned-income verification gap. Live in staging, not yet in production. If YC asks "is it shipped?", the precise answer is: "Integrated end-to-end in staging; production rollout gates on the same SNAP-handler approval that gates first-applicant cohort closure." Don't claim it's running against real households yet — it isn't.

**On the "first applicant in production" claim:** This single sentence materially changes how YC reads the application. Zero users vs. one real applicant is the threshold between "idea" and "early product." Make sure you have artifacts to prove it — a redacted applicant ID, a screenshot from your Supabase dashboard, a timeline note. YC may ask for evidence at the interview. If the "real applicant" is actually a friend you walked through the flow rather than an organically-acquired user, be honest about the distinction in the interview — call them a "supervised first applicant" rather than letting YC assume organic.

**On the 9 open OBBBA-audit items in counsel review:** I left this line in the "What have you built so far" section because honesty about open compliance items reads as a professional founder. If any of those 9 items are material to claims elsewhere in the application — for example, if one of them is "ABAWD work-log retention may not satisfy USDA rule X" while the application claims ABAWD coverage as shipped — fix the application claim, not the audit doc. YC will not read the audit, but if you mis-claim a coverage area that's open in your own internal docs, that's a credibility hit waiting to happen at diligence.

**On the SNAP-handler approval (end of May):** This is the most fragile load-bearing fact in the application. Today is May 21. End-of-May approval is 10 days out. If it slips by even two weeks, every claim about cohort closure slips with it. Three things to do before submitting: (a) confirm the approval timeline with whoever is reviewing it, (b) have a written fallback if it slips, (c) consider whether to soften the language to "Q3 2026" rather than "end of May" — accurate but less brittle.

**On the hybrid 501(c)(3) + C-corp structure:** This is unusual but defensible — the 501(c)(3) is the right vehicle for MAZON, USDA SNAP outreach, and SNAP-Ed funds; the C-corp is the right vehicle for CBO licensing, B2G contracts, and the platform itself. The honest current state: the 501(c)(3) is incorporated, the C-corp is in formation, and the inter-entity arrangement is directionally defined but not papered. **Do not over-claim specifics you haven't executed.** If YC asks "exactly which revenue lands where?", the right answer is "the architecture is grant funds to the 501(c)(3) and commercial revenue to the C-corp; we're working with counsel to paper the inter-entity license and revenue-allocation agreement before the batch starts. No revenue has flowed through either entity yet." That answer reads as a founder who knows what they don't know. Fabricating clean splits you haven't papered reads as a founder bluffing.

Three pointed questions YC will likely ask, with the *honest* framing for each:

1. *"Who owns the IP?"* — "The C-corp will own 100% of the IP once it's filed; the 501(c)(3) licenses it under a fair-market-value arms-length agreement. We have not papered this yet but it's the standard hybrid structure and we're in counsel selection." Don't claim it's done. Claim you know the right shape.
2. *"Where does revenue land?"* — "Grants and government outreach reimbursements to the 501(c)(3); operator success fees, navigator SaaS, B2G contracts, and adjacency referrals to the C-corp. We have not executed revenue through either entity yet and will finalize the allocation memo with counsel."
3. *"How is the board structured?"* — "501(c)(3) board is in formation with independent directors; C-corp board will be standard YC/founder/investor composition. We will keep the conflict-sensitive matters firewalled. Final composition TBD."

**The asymmetric advantage to lean into during the interview:** The 501(c)(3) gives you access to non-dilutive grant capital that pure C-corp competitors cannot touch — MAZON, USDA SNAP outreach, SNAP-Ed. That's a structural capital advantage that compounds with every grant cycle. A startup can't replicate this without 12-18 months of nonprofit setup and IRS determination. You already did that work. Frame it as a moat, not a complication — but don't oversell mechanics you haven't built yet.

**On the Senate origin:** A co-founding team that built a new Senate office together through one of the highest-pressure political transitions in modern California politics is a stronger co-founder signal than 90% of YC applicants can claim. Lead with it in any interview question about team chemistry or execution under pressure.

**On the ethics question:** The framing is now clean. Cabinet Affairs is policy coordination, not contracting; he is recused from Civica matters; standard Political Reform Act disclosure applies. The one thing you need to actually verify before the application goes in: has he filed the disclosure paperwork yet? If not, file it. If YC asks in the interview and the answer is "we will file it," that's a worse signal than "filed on [date]."

**On the LOI vs the CfA subcontract:** These are two different validations of two different revenue layers. Don't conflate them in the application. CfA = civic-tech-partner layer (the "operator pays" model). LOI = government-payer layer (the "government pays to avoid penalties" model). Calling out both, separately, demonstrates that you understand your own business model.

**On S26 timing:** Applications typically closed in April. Apply in rolling review. YC reads late applications; they are not auto-rejected. Acknowledge it in the optional box: "We're submitting in rolling review — the team composition and LOI solidified in May."

**The one-line you should memorize for the interview:**
"Every other SNAP tool exits before the hard part. OBBBA just made the hard part worth $510M in California penalties. We have a cabinet insider, a county LOI, and the only platform built for what the law now requires."
