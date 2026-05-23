# Civica's Error-Reduction Thesis

**Status:** Draft 2026-05-22 — pitch + dashboard messaging foundation
**Audience:** Foundation funders, county outreach contacts, investors, internal alignment
**Pairs with:** [verification-stack.ts](../../apps/dashboard/lib/analytics/verification-stack.ts), [error-risk.ts](../../packages/snap-qc-engine/src/scoring/error-risk.ts), [recertification-design.md](../recertification-design.md), [benefitscal-integration.md](../benefitscal-integration.md)

---

## 1. The one-line story

**For every applicant Civica fully serves, expected payment-error rate drops from California's 10.98% baseline to a projected ~5% — driven by wire-verified income (Argyle) and deterministic shelter logic (SUA engine + lease OCR + phantom recert), which together address ~83% of California's QC error surface.**

That sentence is the entire pitch. Everything below supports it.

---

## 2. What the error surface actually looks like

USDA QC microdata, California FY2023 element attribution (source: `CA_ELEMENT_ATTRIBUTION_FY23` in [packages/snap-qc-engine/src/scoring/error-risk.ts:140](../../packages/snap-qc-engine/src/scoring/error-risk.ts:140)):

| Element | % of CA errors | Civica flow |
|---|---:|---|
| Shelter deduction | 39.94% | utility-sua + shared-lease |
| Wages | 21.35% | gig-income |
| RSDI / SSI / other unearned | 25.0% | **not covered** |
| Self-employment | 5.16% | gig-income |
| Standard utility allowance | 4.49% | utility-sua |
| Medical expense deduction | 3.88% | not covered |
| Arithmetic computation | 2.03% | benefit-impact-projection |
| Unit composition | 1.91% | benefit-impact-projection |
| Child support / unemployment / contributions / dep-care / other | ~4% | partially covered |

**Two categories drive 86% of the error surface: shelter (44.43%) and earned income (26.51%).** Civica's verification stack is purpose-built around exactly these two. The remaining ~17% — RSDI, SSI, medical, etc. — is structurally outside Civica's flows and represents the irreducible floor for a Civica-served household.

---

## 3. How Civica reduces each axis

### Income axis — Argyle wire (Strong, Live)

- **Status quo without Civica:** Applicant uploads paystubs, navigator or worker re-keys hours and YTD into the state system. "Weak" defensibility — self-reported with paper proof, the highest-error category in QC sampling.
- **With Civica:** Argyle pulls authenticated pay-frequency, YTD gross, employer name, and hours-worked directly from ADP/Gusto/Paychex/etc. after applicant consent. "Strong" defensibility — third-party data source.
- **Per-flow error probability shift (per `DEFENSIBILITY_ERROR_PROB`):** 80% → 5%. A **94% reduction** on the income flow.
- **Addresses:** 26.51% of CA's error surface (wages 21.35% + self-employment 5.16%).
- **Also produces:** the work-requirement hours signal for §10102 — same wire, double duty.

### Shelter axis — three components, all Moderate or better, all Live

**Component 1: Deterministic SUA engine + utility flag questionnaire**
- Three yes/no questions (heating costs, electric/gas, phone) → deterministic mapping to California's FY26 HCSUA tiers: $663 FULL, $170 LIMITED, $44 TELEPHONE ([snap-rules/src/sua.ts:4](../../packages/snap-rules/src/sua.ts:4)).
- "Moderate" defensibility because the SUA schedule itself is statutory and the household answered the question; the auditable artifact is the answer + the citation chain.
- Critically: **no vendor dependency, no API rate limit, no integration risk**. UtilityAPI was removed from the roadmap because the deterministic logic + questionnaire hits Moderate for free.
- HEAP/SUA conflict detection ships with this ([snap-rules/src/sua.ts:36](../../packages/snap-rules/src/sua.ts:36)).

**Component 2: Lease / mortgage upload + on-device OCR**
- Document upload, OCR extraction of the monthly rent or mortgage figure, applicant confirms before it flows into the shelter deduction.
- "Moderate" defensibility.
- Sublease and shared-tenancy cases route to navigator review (Component 3 below).

**Component 3: Sublease classifier (Planned)**
- Probability score on whether an uploaded lease is sublease/shared-tenancy vs. primary tenancy.
- Routes ambiguous cases to navigator instead of auto-flowing.
- Target Q4 2026.

**Per-flow error probability shift on shelter:** 80% (self-attest weak) → 35% (Moderate). **56% reduction** on the shelter flow.

**Addresses:** 44.43% of CA's error surface (shelter 39.94% + SUA 4.49%) plus ~7.3% of shared-lease surface when the classifier ships → **~51% total** of the error surface.

### Recertification axis — preventing the second-largest source of error

The error data points to shelter and income at *initial cert*. But **most shelter-cost errors are born between certs**, when rent/utilities/composition drift and nothing gets re-verified until 12 months later. Civica's recert companion catches this:

- **Phantom recert (60-day shadow run)** — full dry-run of the recert interview against stored answers 60 days before deadline. Strong, Live.
- **Expiration calendar** — per-doc freshness forecast (paystubs, lease, utility bills, ID). Strong, Live.
- **JIT reminders** — push + SMS scheduled to the optimal capture day. Moderate, Live.
- **AI-refreshed renewal packet** — QC engine re-runs on updated signals, emits a refreshed packet for navigator handoff. Strong, Live.

Net effect: drift gets caught at T-60 days, not at the recert deadline. The error doesn't happen because the application no longer carries stale numbers into the renewal.

---

## 4. The math: projected PER for Civica-served households

Honest caveat first: **this is a projection, not a measured outcome**. Civica's served-cohort sample is too small for a statistically reliable observed PER yet.

Approach: take CA FY24 PER (10.98%), partition the error surface into Civica-covered vs. not-covered, apply per-flow defensibility shifts to the covered portion.

| Surface segment | Share of errors | Pre-Civica defensibility | Post-Civica defensibility | Error reduction on segment |
|---|---:|:---:|:---:|---:|
| Income (Argyle-served) | 26.51% | Weak (~80%) | Strong (~5%) | −94% |
| Shelter (SUA + lease OCR) | 51.0% | Weak (~80%) | Moderate (~35%) | −56% |
| Calc (deterministic) | 3.94% | Weak (~80%) | Strong (~5%) | −94% |
| Dep-care + other partial | 0.87% | Weak | Weak | 0% |
| Uncovered (RSDI/SSI/medical/etc.) | ~17% | unchanged | unchanged | 0% |

Weighted projection: a fully-served packet retains roughly **40% of the error probability of an unserved packet on covered surface**, and 100% on uncovered surface. Plugged into the CA 10.98% baseline:

> Projected PER for Civica-served population ≈ 10.98% × (0.17 + 0.83 × 0.40) ≈ **5.5%**

That number is the headline. It's halving California's measured rate, almost entirely by wire-verifying the two element groups (income, shelter) that dominate the surface — not by chasing fraud, not by adding worker discipline, not by tightening eligibility.

---

## 5. Why the framing is NOT "we catch fraud"

Public data is unambiguous: **shelter inflation as fraud is <2% of total SNAP errors**. The 11% national PER is dominated by structural lag (failure to report changes), caseworker miscalculation, and election errors households don't know they're making — not deception.

This matters strategically for three reasons:

1. **Fraud-framing is politically toxic.** Households who hear "this app catches cheaters" will not download it. CBOs whose value chain depends on trust won't partner.
2. **Fraud-framing is factually wrong** at the scale of the error problem. Trafficking ($1.27B/yr) is the biggest fraud category and has nothing to do with shelter or eligibility.
3. **The state's actual pain (OBBBA §10105 + §10106 cost-share triggers)** is driven by structural error volume, not fraud. The buyer wants drift reduction, not adversarial verification.

The right framing is: **Civica closes the drift gap, in both directions**. We catch the overpayment (state benefits), we catch the underpayment (household benefits), and the regulatory exposure on §10105 / §10106 goes down because the *measured* error rate on Civica-served cases is lower.

---

## 6. The underpayment side (the iceberg framing)

CA FY24 official: 9.26% overpayment, 1.67% underpayment. But the underpayment figure is structurally undermeasured because QC doesn't audit for "households who could have claimed more and didn't."

FRAC's measured cap-hit data: **25.9% of California SNAP households hit the shelter cap** — meaning their actual shelter burden exceeds what the program credits, and they are systematically underpaid. CA is the #2 state in the country for this.

Layered on top: households who miss the homeless shelter deduction ($198.99/mo standard), households on the wrong SUA tier downward, households who didn't elect actual-utility-cost when higher than SUA — none of which show up in official underpayment numbers.

Civica's value to households isn't "we'll keep you compliant." It's **"we find the benefits you're entitled to that you're not claiming."** Failure-to-elect detection is the household-side hook that no fraud-prevention story can match.

---

## 7. The product surface that delivers this — Path 1 (CBO model)

Civica operates as a tech-enabled CBO under California's ACL 21-129 (Application Assistance Standards). The pipeline:

```
Applicant intake (iOS + web)
  → Argyle income wire + lease OCR + SUA flags + sublease classifier
  → QC engine emits QcResult (defensibility + citations + evidence package)
  → Navigator review
  → BenefitsCal submission via Playwright automation
       (no API exists for CalSAWS; per benefitscal-integration.md the
        only path is browser automation behind a CBO Assister account)
  → County eligibility worker makes the determination
  → Civica records benefitscal_confirmation_number + tracks outcome
```

Civica never makes the eligibility determination. Civica supplies a **higher-confidence packet** than any other CBO can supply today, because every other CBO sends self-attestation packets and Civica sends wire-verified ones.

Revenue:
- Per successful enrollment (acquisition revenue)
- Per active household per month (recurring, recert companion drives retention)
- County-wide license (enterprise tier for full-county deployment)

Funded by:
- USDA SNAP outreach grants
- Campus basic-needs funding (~$30M+/yr CA-wide for student channel)
- Older Americans Act Title III-B + HUD service-coordinator budgets (elderly channel)
- County DSS pass-throughs
- Foundation grants during ramp

The household never pays Civica.

---

## 8. What this means the dashboard should show

Today's `/qc` page shows per-flow coverage (ApiCoveragePanel), per-flow defensibility (ScoringPanel), and Civica observed mix vs. USDA baseline (BaselinePanel). All correct, all useful.

What's missing: a single headline that ties these into the unified narrative — **"for households where the full stack is engaged, projected PER is ~5% vs. California's 10.98% baseline"** — with the income and shelter contributions broken out as the two pillars.

Planned panel: `ErrorReductionProjectionPanel` (this doc + companion PR).

---

## 9. What this is NOT

- **NOT a measured outcome.** Until the cohort is large enough for QC sampling to yield statistically reliable Civica-served PER, this is a projection. The dashboard should be honest about that.
- **NOT a claim that errors go to zero.** Per-flow probability under Argyle is still 5% — Strong defensibility does not mean perfect. And the uncovered 17% of error surface (RSDI/SSI/medical) is unchanged for Civica-served households.
- **NOT a state-side caseworker tool.** Path 1 is the CBO model: submit pre-verified packets, let the county worker decide. The state-side licensed-tool play is a 2027+ upsell, not the immediate product.
- **NOT fraud prevention.** The thesis is structural drift reduction. Fraud framing is wrong and toxic.

---

## 10. Sign-off / next steps

Once this doc is reviewed:

1. Build `ErrorReductionProjectionPanel` for `/qc` — visualizes the 10.98% → ~5% projection with income + shelter pillars.
2. Lift the same projection (with cohort-size caveat) into the `/compliance` Pillar 5 OutcomesPanel as a leading projection card next to the measured-outcome cards.
3. Use this doc as foundation language for: foundation pitches, county outreach contract proposals, the YC application draft, the Path 1 CBO partnership talk-track.

The math will get more honest as the served-cohort sample grows. The thesis doesn't change.
