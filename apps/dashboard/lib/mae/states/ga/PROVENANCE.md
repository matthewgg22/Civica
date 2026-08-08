# Georgia pack — provenance

**Created:** 2026-08-07 (Wave 2, state one — `docs/plans/mae-state-corpus-framework.md`; GA ships
early so the 130%-BBCE case has live coverage).
**Method:** drafted from verbatim source text collected by workflow `wf_7d90136b-865` (5 cluster
fetch agents + independent cross-check), then adversarially fact-checked before PR. Verification
outcomes are appended below as gates complete.

## Why Georgia matters to the schema
- **The "BBCE ≠ income relief" archetype** — TCOS categorical eligibility keeps the gross screen
  at the federal 130% for regular households — **with a refinement the FNS chart misses:** a 200%
  screen for households whose ADULT members are all elderly/disabled (§3210).
- **Liquid-resources-only state:** vehicles are NEVER counted; real property excluded. The
  `asset_rule.vehicle` field has a "fully excluded" case.
- **Cross-state contrasts now live:** child support is a DEDUCTION here (NY: exclusion); Georgia
  RUNS a $161 Standard Medical Deduction (NY: none; WA: none); E&T (SNAP Works) is VOLUNTARY with
  no sanctions and is not a regaining route.

## Sources

| Source | Access | Dated |
|---|---|---|
| DFCS SNAP Policy Manual on PAMMS (§3000–§3810 + Appendix A) | **plain curl** — pamms.dhs.ga.gov is a static Antora site; the framework's "ODIS JS-app" flag is OUTDATED (odis.dhs.ga.gov redirects there); sitemap lists every section; source mirrored on gitlab.com/gadhs/pamms | per-section header: Effective Date + MT lineage (best-versioned source in the roster) |
| MT transmittal cover letters (MT-84 COLA, MT-85 OBBBA, MT-86/87 March-2026 changes) + form PDFs (297/297A/508/528/47) | plain curl (302 → GitLab raw) | each PDF self-dated |
| dfcs.georgia.gov (SNAP, Senior SNAP, periodic-reporting, ConnectEBT pages) + gateway.ga.gov | plain curl | undated pages, fetched 2026-08-07 |
| FNS BBCE chart (June 2026) + FY26-Q3 ABAWD waiver file | browser-UA curl (**mirror-flagged corroboration only**) | self-dated |

## Findings a maintainer must know

1. **ODIS is dead; PAMMS is the host.** No browser needed, no Wayback needed — plain curl serves
   everything, and the manual's git history is public (gitlab.com/gadhs/pamms).
2. **The FNS BBCE chart under-describes Georgia:** it prints a single 130% row, but §3210 carries
   the 200% TCOS screen for all-adult elderly/disabled households. The manual controls.
3. **Cat-el carve-out worth remembering:** a regular household over 130% that merely CONTAINS an
   elderly/disabled member is not categorically eligible — it falls to the federal net-only path
   (100% net + $4,500 liquid test).
4. **Stale sections exist even on PAMMS:** §3415 (Nov 2019) still counts non-home real property;
   the June 2026 §3405 chart excludes it. §3612's 20% EID page dates to 2019 (still correct).
   The public Senior SNAP web page is stale on the age criterion vs §3725.
5. **March 2, 2026 reset (post-OBBBA):** 24-month certs ended; 6-month default certs; periodic
   reports phased out at each household's next recert; alternate (no-interview) renewals every
   other recert for non-ABAWD households; interviews once/12 months (ABAWDs: every 4).
6. **Aged ABAWD:** Georgia exempts ages 60–65 from the time-limit work requirements (eff.
   7/4/2025), so the ABAWD time limit effectively bites 18–59 even though the definition runs to
   the 66th-birthday month.
7. **Georgia's ABAWD clock has been fixed-window since December 1996** — the roster's longest
   uninterrupted clock lineage; window math is trivially predictable (every 36 months).
8. **Homeless deduction prints $199** (Georgia rounds the federal $198.99). Small, but a
   cross-state value-drift example.
9. **Comparable workfare, not E&T, is the regaining route** — SNAP Works is voluntary, unsanctioned,
   and closed to ABAWDs who need to regain.

## Refresh triggers
- **Oct 2026 COLA** → successor transmittal to MT-84 (Appendix A, SUAs, deductions) — freshness entry.
- **Nov 30, 2026** → fixed ABAWD window rolls; new window Dec 1, 2026 — freshness entry.
- **Waiver status** → re-verify §3355 + FNS quarterly file — freshness entry.
- New MTs touching §3210/§3355/§3617/§3725 → update the affected supplement (cover letters are
  public PDFs; diffable via the GitLab repo).

## Verification log
- **Fetch cross-check (wf_7d90136b-865):** independent skeptic re-fetched all eight pivotal facts.
  **Verdict: 8/8 CONFIRMED — safe to build, zero contradictions.** Confirmed: TCOS BBCE structure
  (incl. the 200% all-adult elderly/disabled screen and its absence from the FNS chart), liquid-only
  resource counting + limits, SUA values + effective mandatoriness, fixed-window clock + no-waiver
  status, expedited 7-day + interview rules, Form 297/Gateway roles, the $161 SMD, and
  child-support-as-deduction.
- **Post-draft adversarial refute (wf_72bdd8fd-00c, 2026-08-07):** 84 claims checked, with LIVE
  re-fetch of manual sections preferred over curated extracts. **Verdict: 79 confirmed / 5 wrong /
  0 unverifiable / 0 fabricated facts.** All corrections applied same day:
  - Transfer-table key stated: bands measure the amount transferred IN EXCESS of the resource
    limit ((transferred value + other resources) − limit), not the raw transfer amount.
  - "SUAs are never prorated" de-quoted (paraphrase) — replaced with §3617's real text ('allow the
    appropriate SUA for each AU separately'; only actuals divide among sharers).
  - MT attribution fixed: the March 2, 2026 certification changes rode MT-87; MT-86 (Jan 3, 2026)
    carried On-Demand interview + Senior SNAP updates. MT-79/MT-81 note dates corrected; §3715
    relabeled "interim changes."
  - Asset-rule "who gets tested" completed (over-130% household containing an elderly/disabled
    member); 75% verification noted as the general rule; $3,000 reversion when the only
    elderly/disabled member is sanctioned; §3405's residual rental-EV sentence footnoted.
  - One-bill SMD unlock completed with the §3614 Example-2 divisor rule (bill ÷ cert months > $35).
  - LSUA/H-C alternate qualifying routes added; 273.9 supersession gains the third route.
  - Aged ABAWDs noted as still work registrants with 4-month certs; education/training scoped to
    work-program components for MEETING (explicit for REGAINING).
  - TSNAP extended to RCA exits; homeless-$199 comparison grounded via NY's GIS 25DC059; quote
    truncations given ellipses; Form 297 dual-revision caveat (PAMMS 11/2025 vs dfcs.georgia.gov
    still serving 10/2024).
  - Notable date-sensitive nuance surfaced by the gate: the Senior SNAP AGE criterion changed
    recently (public page stale; manual current) — the pack deliberately states no age and points
    to §3725.
