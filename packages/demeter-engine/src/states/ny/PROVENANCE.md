# New York pack — provenance

**Created:** 2026-08-07 (Wave 1, state three — `docs/plans/mae-state-corpus-framework.md`).
**Method:** drafted from verbatim source text collected by workflow `wf_450ac2f1-9b8` (5 cluster
fetch agents + independent cross-check) plus live pages captured through a real Chrome session,
then adversarially fact-checked before PR. Verification outcomes are appended below as gates
complete.

## Why New York is the hardest state in the roster
- **Three simultaneous BBCE income tiers** (200% aged-disabled/dependent-care, 150% earned-income,
  130% default) — no scalar income limit can represent NY. `income_pathways` must be an array.
- **First Layer-3 (county) state actually exercised:** NYC HRA runs its own portal (ACCESS HRA, not
  myBenefits), its own interview model (On Demand — HRA will NOT call you), and its own
  implementation timelines. NYC facts are cited ONLY to NYC sources.
- **Regional SUAs** — three dollar values per allowance (NYC / Nassau-Suffolk / Rest of State),
  with different NAMES in NYC ABEL ("Combined Heat/Utility/Phone SUA", "LUA").

## Sources

| Source | Access | Dated |
|---|---|---|
| otda.ny.gov live pages (SNAP program, work-requirements, apply, FAQ) | **real Chrome session** — the host's F5/TSPD bot-challenge blocks curl (plain AND browser-header), WebFetch (ECONNRESET), and headless Chromium; the in-app browser pane was denied navigation | as viewed 2026-08-07; charts stamped "effective October 1, 2025" |
| OTDA PDFs: GIS 25DC059/25DC061/25DC055/25DC056/25DC081/25DC089/26DC012/24DC028/21DC079/25DC005/23DC049; 07-ADM-09, 09-ADM-06, 16-ADM-06, 25-ADM-03(-P), 26-ADM-02, 24-ADM-09, 20-ADM-14, 09-ADM-22, 01-ADM-16; 26-INF-03, 25-INF-08, 25-INF-05; 25-LCM-14; SNAP Source Book (Sept 2025); LDSS-4826 form | **web.archive.org snapshots of the official otda.ny.gov URLs** (mirror, flagged) — CDX digests verified IDENTICAL across multiple snapshot dates (e.g. 25DC059 digest MJJAMGT4 on 9/27, 10/31, 11/7/2025), so staleness risk is low | per-document date + effective-date stamps recorded |
| 18 NYCRR §§387.8/387.9/387.10/387.14/387.17 | LII mirror (**flagged**) — govt.westlaw.com (state-designated, self-labeled "Unofficial") is an unscrapable JS app; §387.12 unobtainable anywhere, cited via Source Book §12 | amendment stamps as shown on mirror |
| NYC county layer: nyc.gov/hra SNAP + ABAWD + interview + locations pages, access.nyc.gov SNAP page, ACCESS HRA resources | plain curl + browser UA (worked) and live Chrome | access.nyc.gov stamped "Last Updated July 6, 2026" |
| mybenefits.ny.gov | live | rendered 2026-08-07 |

## Findings a maintainer must know

1. **Fetch strategy is three-tiered:** otda.ny.gov HTML → real browser only (F5/TSPD challenge is
   TLS-fingerprint bound; replaying cookies through curl fails). OTDA PDFs → Wayback snapshots of
   the official URLs, with the CDX digest-stability check standing in for freshness. NYCRR → LII
   mirror, flagged. nyc.gov → plain curl works.
2. **There is NO 165% eligibility tier.** The 165% column in the standards GIS is the
   elderly-disabled separate-food-unit (purchase-and-prepare) rule — the income test applied to the
   OTHERS in the residence, not an eligibility pathway.
3. **12-ADM-06 is NOT the BBCE directive** (it's a Flexible Fund for Family Services directive).
   The real lineage: 07-ADM-09 (130% general + 200% aged/disabled, eff. 1/1/2008) → 09-ADM-06
   (dependent-care to 200%) → 16-ADM-06 (earned-income to 150%, eff. 7/1/2016); codified at
   18 NYCRR §387.14.
4. **Regulation text is stale where it matters:** §387.9 prints $2,000/$3,000 resource limits
   (current: $3,000/$4,500 per GIS 25DC059); §387.10 retains pre-BBCE income standards; one Source
   Book line still prints a "5 days" expedited figure against the operative 7-calendar-day
   standard. Directives/GIS control over both regulation and Source Book.
5. **ABAWD waiver whiplash — cite by date:** FNS terminated NY's waiver eff. 11/2/2025
   (25-ADM-03-P) → litigation reinstated it through 2/28/2026 (GIS 25DC081) → statewide operation
   since 3/1/2026 with only Tuscarora + Poospatuck reservations waived through 2/28/2027
   (GIS 26DC012). November 2025 is not countable anywhere (GIS 25DC089, federal shutdown). NYC is
   NOT waived (HRA implemented 11/1/2025, compliance from 3/1/2026 — NYC source).
6. **Two-portal reality:** myBenefits.ny.gov statewide EXCEPT NYC; NYC uses ACCESS HRA and
   myBenefits appears nowhere on NYC's SNAP pages. NYC interviews are on-demand — the client must
   call (929-273-1872); HRA will not call them.
7. **Child support is an income EXCLUSION in NY** (subtracted before the gross tests, and during
   expedited screening) — not merely a deduction. NY has NO standard medical deduction (actuals
   over $35 only). Dependent care is uncapped AND independently moves the household to the 200%
   tier.
8. **Minimum-benefit drift:** 24-ADM-09 prints "$23" (pre-COLA); the FFY 2026 minimum is $24
   (GIS 25DC059). Quote the standards GIS, not older ADMs, for dollar values.

## Refresh triggers
- **Oct 2026 COLA** → successor standards GIS replaces 25DC059 (income tiers, SUAs, deductions,
  minimum) — freshness entry.
- **Oct 1, 2026** → NEW fixed ABAWD window begins; all countable months reset — freshness entry.
- **Feb 28, 2027** → reservation waivers expire — freshness entry.
- New ADM/GIS on OBBBA implementation (non-citizen rules per 26DC019 were pending at build time) →
  update the affected supplement.

## Verification log
- **Fetch cross-check (wf_450ac2f1-9b8):** independent skeptic re-fetched all seven pivotal facts.
  **Verdict: 7/7 CONFIRMED — safe to build.** Confirmed: the three-pathway structure + directive
  lineage (and the 12-ADM-06 miscitation), resource-test elimination + survivals, regional SUA
  values, fixed-window clock + current waiver status (reservations only), ESAP status + 36-month
  certs, LDSS-4826 + the two-portal split, and no-standard-medical-deduction.
- **Post-draft adversarial refute (wf_99aadb4a-a52, 2026-08-07):** 94 claims checked against the
  raw source text on disk (not just curated extracts), plus targeted re-fetches. **Verdict: 86
  confirmed / 6 wrong / 2 unverifiable / 0 fabricated facts.** All corrections applied same day:
  - **Saratoga County carve-out** (the sharpest catch): the litigation-reinstated waiver covered
    every county EXCEPT Saratoga — countable-month tracking began there Dec 1, 2025, not March
    2026; abawd supplement, the 273.24 supersession, and two GIS notes re-scoped.
  - Sanctioned-household test battery corrected: aged/disabled sanctioned households face only the
    net + resource tests; dependent-care sanctioned households get a 150% gross test (SNAPSB §11.1).
  - Cooling attestation precision: a VERIFIED electricity bill + attestation suffices (not bare
    attestation); no-strip rule is "based solely on"; cooling check is "should confirm."
  - Child-support quotes re-attributed to Source Book §13 (not §12); 20% EID re-attributed to
    §12.C (GIS 25DC059 contains no EID percentage); §387.12 dropped from the citation line
    (unobtainable anywhere — kept in known-cites with its flag).
  - "Documented access barrier" replaced with the sourced 07-ADM-09 worker-verification sentence.
  - EBT photo removal scoped to TA recipients' new/replacement cards.
  - Nuances folded in: periodic-reporting-failure BBCE disqualifier; ABAWD time-out ≠ sanctioned;
    per-INDIVIDUAL grace period; workfare divisor = higher of federal/state minimum wage, rounded
    down; "$217.50 or more"; "seven FULL months"; ABAWD hours-report also mandatory mid-cert and
    during TBA; expedited reuse conditioned on cleared postponed verification; LDSS-3151 =
    "SNAP Change Report Form"; HRA's expedited FAQ internally inconsistent (5 vs 7 days);
    718-SNAP-Now = recert-interview line; Helping Hands text now embedded in notices (12-INF-12);
    165% GIT appears in the Source Book's five-test list but never gates a household's own
    eligibility; homeless deduction requires a non-zero expense; §10103 pinpoint marked as the
    federal overlay's terminology (OTDA cites only "H.R. 1").
