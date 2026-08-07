# Texas pack — provenance

**Created:** 2026-08-06 (Wave 1, state two — `docs/plans/mae-state-corpus-framework.md`).
**Method:** drafted from verbatim source text collected by workflow `wf_02815617-1ce` (4 fetch
agents; browser-header strategy for the 403-blocked handbook host; local FOIA primary documents
read from disk), then independently cross-checked and adversarially fact-checked before PR.
Verification outcomes are appended below as gates complete.

## Why Texas is the schema-breaker state
- **BBCE with an asset test.** TANF-NC categorical eligibility at 165% FPL **keeps** a $5,000
  resource limit (liquid + excess vehicle value). `bbce` can never be modeled as "no asset test."
- **Two-tier vehicle rule:** $22,500 FMV exempt on the highest-valued vehicle, $8,700 on each
  additional; excess counts toward the $5,000. The widely repeated "$22,000" figure is **wrong**
  (TWH A-1238; 1 TAC §372.355(d)(6); Tex. Hum. Res. Code §33.021, HB 1287).
- **Rolling ABAWD clock.** No fixed statewide window exists — the 36-month period is per-person,
  beginning "the first month an ABAWD fails to meet the ABAWD work requirement." Clock TYPE
  (fixed vs rolling) is a per-state fact.

## Sources

| Source | Access | Dated |
|---|---|---|
| Texas Works Handbook (A-140/A-141, A-1210/A-1212/A-1220/A-1230/A-1238, A-1341, A-1420/A-1427/A-1428/A-1429, A-1910/A-1940/A-1960, A-2324, B-431/B-432, B-471, B-475/B-477, B-621, C-121, C-331) | **browser-headers** (hhs.texas.gov 403s plain clients) | per-section revision stamps |
| 1 TAC §372.355, §372.410, §372.654, §372.957 | via handbook reproductions + Appian portal (SOS web viewer decommissioned) | §372.355 amended eff. 2/12/2026 |
| **LOCAL FOIA (HHSC ORR A05292026.0450037):** Form H1805 rev 11/25; MEPD & TW Bulletins 25-16 & 26-08; R121 TF0001 render; S1 TF0001 print; SNAP Work Rules Informing Script | read from disk | Bulletin 25-16 (Oct 2025); H1805 rev 11/2025 |

## Findings a maintainer must know

1. **The online handbook is stale and the bulletins control.** Verified Aug 2026: A-1910 (Rev 24-4)
   and A-1940 still print "18 through 54" — the post-OBBBA 18–64 policy lives in Bulletins
   25-16/26-08 and TIERS. Our local FOIA copies of those bulletins beat the live website.
2. **The cutover is TIERS-keyed:** policy effective with Bulletin 25-16's release, but TIERS
   applies the new age/exception rules to **file dates on or after Nov. 1, 2025**, with a federal
   transitional exemption before that.
3. **S1 TF0001 print artifact:** an older S1 print renders the pre-OBBBA bands ("between 18 and
   54"); the R121 render is authoritative.
4. **TAC mirror trap:** §372.355's $22,500/$8,700 figures entered the TAC only on 2/12/2026 —
   mirrors snapshotted earlier (public.law, Justia, some LII pages) serve the old text.
5. **Texas vocabulary:** "streamlined reporting" (SR 1 / SR 2), no "IRT"; the 1/3/6-month ladder is
   the E&T/basic-work-rules sanction, **not** the ABAWD time limit.
6. **Expedited is same-day-if-possible / next business day** — stricter than the federal 7 days.
7. **Section-map traps:** the income-limits DOLLAR TABLE lives in **C-121** (A-1341 states the tests
   and points there); SNAP-CAP is **B-475** and TSAP is **B-477** (B-476 is joint SSI–SNAP
   applications); the A-1900 slug is `a-1900-federal-time-limits` and A-2324 lives on the
   `a-2320-eligibility-dates-benefit-amounts` page.
8. **Quote discipline:** the refute gate caught three quotes that spliced two sections or
   paraphrased ('plus'/'exceeds' for 'and'/'is over'; 'sharing a residence' for 'sharing utility
   costs'; a paraphrase inside TSAP quote marks). Rule: quotation marks only around text verbatim
   from a single section.

## Refresh triggers
- **Oct 2026 COLA** → A-1341 table + SUA/BUA/phone + SME (freshness entry).
- **C-331 waiver table** → re-verify with the FNS quarterly file (freshness entry).
- New MEPD & TW bulletins or TIERS releases touching SNAP → update the affected supplement.
- When the online handbook catches up on ABAWD ages → soften the staleness warning in the abawd
  supplement (keep the bulletins-control rule).

## Verification log
- **Fetch cross-check (wf_02815617-1ce):** first run received a mangled prompt (template-literal
  bug) and was discarded; resumed with the repaired script (fetch agents replayed from cache).
  **Verdict: SAFE_TO_BUILD — 6 confirmed / 1 contradicted / 0 unreachable.** The contradiction was
  the research brief's "$22,000" vehicle figure; the pack already carried the correct **$22,500**,
  now triple-sourced (TWH A-1238 Rev 24-2; HB 1287 enrolled, Hum. Res. Code §33.021; 1 TAC
  §372.355(d)(6) as amended eff. 2/12/2026 — whose bracketed prior text shows the OLD TAC values
  were $15,000/$4,650, i.e. "$22,000" was never the rule).
- **Post-draft adversarial refute (wf_caf2af53-78d, 2026-08-06):** 72 claims checked against the
  fetched primary pages, local FOIA documents, HB 1287 enrolled text, the Texas Register archive,
  and live re-fetches. **Verdict: 61 confirmed / 11 must-fix / 0 fabricated facts.** All 11 applied
  same day: three quote-splice/paraphrase fixes (A-1220 resource sentence, A-1429 'sharing utility
  costs', TSAP auto-test sentence); income table relocated to C-121; transfer penalty re-keyed to
  amount OVER the limit (and post-certification transfers added); SR 1 trigger gained 'two
  consecutive months' + ABAWD-hours and lottery reportables (B-621 Rev 26-1); TSAP criteria
  completed (no earned income, no SNAP-CAP member — B-477.2); expedited screening forms corrected
  to H0011/H0011-R + H1010/H1010-R (A-140/A-141); SNAP-CAP re-cited to B-475; two 404 source URLs
  repaired (a-1900-federal-time-limits, a-2320-eligibility-dates-benefit-amounts). Also applied the
  gate's verified completeness additions: the Bulletin 25-16 Native American ABAWD exception,
  non-E&T-county residents 'not subject to SNAP FTLs' (Bulletin 26-08), A-1960 regain nuances, the
  A-1427 homeless-standard forfeiture, and the H1805 stale 10th-day formulation note.
