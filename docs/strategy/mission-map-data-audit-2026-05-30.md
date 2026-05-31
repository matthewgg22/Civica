# Mission Map — Data Audit (2026-05-30)

Companion to [`mission-map-2026-05-29.md`](mission-map-2026-05-29.md). Maps every
load-bearing claim in the mission map against the evidence ledger
([`docs/findings/INDEX.md`](../findings/INDEX.md)) — what's **backed**, what's
**thin**, what's **overclaimed** — so prioritization follows the data, not the
deck. Keep-history convention: new date, don't edit in place.

**Legend:** ✅ hard data backing · 🟡 partial / our-own-analysis · ❌ no data ·
⚠️ overclaim vs. the data · ➖ not a data question.

---

## The one thing first

**The evidence has shifted the center of gravity from Pillar 1 to Pillar 3.**
The map leads with the intake-error story (*"packets that error 60% less"*),
which is the **least** data-backed claim (no measured Civica reduction — the
county-outcome loop is open). Meanwhile **Pillar 3 (Stay On / retention) is now
the deepest evidence moat** — five sources including the only *causal* estimate
we own. Lead with retention where evidence is weighed.

---

## Claim-by-claim support matrix

| Mission-map claim | Status | What the data says |
|---|---|---|
| Headline: "packets that error 60% less" | ⚠️ | The "60%" is **composition, not reduction**: shelter+wages = 60.8% of errored cases ([[2026-05-29-usda-qc-ca-grounding]]). The literal "60% less" traces to a **fabricated** §10105 demo value (cohort PER 4.2 vs 10.8). No measured reduction exists ([[2026-05-29-error-rate-readout]]). |
| Pillar 1 — earned-income 27%, ~2.4× PER | ✅ | [[2026-05-28-civica-tam-repositioning]]: 27.3% cohort at 13.95% PER, 2.4× the 10.98% baseline. |
| Pillar 1 — errors are operational/fixable | ✅ | [[2026-05-29-usda-qc-ca-grounding]]: **65/35** operational/client. (Scrub any "80/20" — corrected.) |
| Pillar 1 — income verification is high-leverage | ✅ | [[2026-05-29-policyengine-benefit-leverage]]: income errors cost 24–30¢/$ vs ~0 over-cap shelter. |
| Pillar 2 — engagement (EBT/offers/savings) | ❌ | No data that engagement improves outcomes or that offers convert. [[2026-05-30 ebt-offer-placement-priors]] is explicitly directional, unvalidated. **Hypothesis, not evidence.** |
| Pillar 3 — Unrath: ~40% spells end at reporting moments | ✅✅ | [[2026-05-28-retention-pillar-unrath]] **+** [[2026-05-29-cdss-cf18-churn]] (~330K eligible-loss events/yr, hard CA state data) **+** [[2026-05-29-data-cdss-cf296-denials]] (⅔ denials procedural) **+** [[2026-05-30-data-icpsr-39331-enrollment]] (cross-validates ~60%). |
| Pillar 3 — "keep eligible households on" works | ✅ NEW | [[2026-05-30-regression-burden-participation]]: simplified reporting **+8.9%**, call centers **+6.3%** participation (causal, 51 states × 25 yrs). The strongest new backing — and it lands on Pillar 3. |
| Distribution: ~544K → ~$1.0B/yr | 🟡 | [[2026-05-28-distribution-union-gig-channels]] — our own analysis; hardenable with the CA SNAP-Gap PUMA data. |
| Monetization L2 — EBT offers | 🟡 | Infra shipped; market un-sized (USDA retailer + 2016 spend could size it). |
| Monetization L2 — Medicare cross-sell | ❌ | No data anywhere in the ledger. |
| Monetization L3 — aggregate data licensing | 🟡 | The findings ledger + regression *are* the proof-of-concept of the "policy research" value. |
| Compliance "moat" (RegOps) | ➖ | Architecture argument; no dataset speaks to it. |
| CBO economics — USDA 50% FFP | ➖ | Regulatory/counsel question, not data. |
| 13.95% TAM / BBCE_REMOVAL provenance | ⚠️ | Number used, citation a TODO (map already flags it). |

---

## OBBBA §10105 — the wedge, now grounded

OBBBA §10105 turns the **payment error rate into a state budget liability** —
the provision that makes Civica's error-reduction worth real money. We replaced
the project's all-**fixture** model with real FY2024 data
([[2026-05-30-obbba-10105-grounding]]).

**(a) Legislation ↔ data.** Inputs are now real: CA **PER 10.98%** (FNS QC) ×
real **$12.18B** issuance (FNS monthly) × the §10105 tier → **~$1.83B/yr CA
exposure** (validates the prior $1.72B fixture). The BBCE-removal scenario is
backed *directionally* by the regression (BBCE = +7.6% participation → removal →
churn → PER drift). The expanded ABAWD work requirement maps to the
procedural-churn data (⅔ of denials already procedural).

**(b) Supported / opposed.**
- **Supports:** the wedge is real; ~65% of the liability is operationally
  addressable; OBBBA's burden-adds will worsen churn (the regression run in
  reverse).
- **Opposes:** the **"≥105% of national" trigger is wrong** — real national PER
  is **10.93%**, CA at 10.98% is at the **median (1.005×), not an outlier**. The
  demo's 8.6% national and the 4.2% cohort PER were both fabricated. The real
  mechanism is **absolute PER tiers**.

**(c) Where reduction is hardest** (data-ranked): the ~35% **client-error floor**
(≈3.84pp for CA — the wall) › over-cap shelter (high count, ~0 leverage) ›
volatile earned-income › the brand-new ABAWD work-requirement surface.

**The quantified pitch:** CA dropping the §10105 top tier (15%→10% share) needs
a **0.98pp** PER cut — ~14% of its operational error — and **saves ~$610M/yr**.
Real, defensible, bounded by the client floor.

**The statutory pivot that decides the buyer:** is §10105 **banded** (target
mid-error states near a threshold) or **continuous** (CA's huge base makes every
point valuable)? Not in the data — **settle with counsel.**

---

## Prioritized (ranked)

1. **Reframe the headline.** "Error 60% less" is unbacked (it's a fabricated
   demo value). Swap to the bulletproof retention line: *"~330K eligible CA
   households lose benefits at renewal yearly over paperwork — and cutting that
   paperwork measurably raises enrollment 6–9%."*
2. **Lead with Pillar 3.** Deepest evidence moat (5 sources + the only causal
   estimate). The map cites only Unrath; upgrade it.
3. **Settle §10105 banded-vs-continuous with counsel** — it inverts who you sell
   to and is the load-bearing OBBBA question.
4. **Close the county-outcome loop** (~1d webhook) — the only gap between "we
   target the right errors" and "we measurably reduce them."
5. **Treat Pillar 2 + Layer 2/3 monetization as hypothesis**, not evidence.
6. **Number hygiene:** fix the 13.95% TAM provenance; scrub any "80/20" (it's
   65/35); propagate the §10105 correction to `lib/analytics/transforms.ts`.

---

## Related
- [[2026-05-30-obbba-10105-grounding]] · [[2026-05-30-regression-burden-participation]]
- [[2026-05-29-usda-qc-ca-grounding]] · [[2026-05-29-cdss-cf18-churn]] · [[2026-05-28-retention-pillar-unrath]]
- `data-ops/sample/obbba-scenarios/obbba_rollup.json` · `apps/dashboard/lib/analytics/section10105.ts`
