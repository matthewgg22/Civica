# Florida pack — provenance

**Created:** 2026-08-11 (Wave 2 continued — `docs/plans/mae-state-corpus-framework.md`; picked because it
already has `packages/snap-rules` engine constants from the #619 Tranche-1 pass, closing the same
"engine math exists, corpus pack doesn't" gap Illinois had — the exact same-session precedent that made
this state tractable to cross-check for staleness the way IL was).

**Method:** direct fetch of the ACCESS Florida Program Policy Manual's Food-Stamps-relevant chapters
(ffic.myflfamilies.com/manual/*.pdf, plain curl — stable, but the exact numeric filename pattern took
trial-and-error to discover: 4-digit FS-specific codes like `1610.pdf`/`1810.pdf` work directly, but most
chapters are only published under their 3-digit PARENT group code with NO leading zero, e.g. `2400.pdf`
not `2410.pdf` and not `02400.pdf` — a web search of `site:ffic.myflfamilies.com` search-result titles was
what actually revealed the pattern after several dead-end guesses) + Florida Administrative Code Rule
65A-1.603 (flrules.org, browser-header curl — plain curl 403s) + the DCF ABAWD FAQ page + USDA FNA's
authoritative Restaurant Meals Program state list and ABAWD waiver-response file index, cross-checked
against the already-verified #619 engine sourcing, then adversarially fact-checked before PR.

## Why Florida matters to the schema

- **A flat 200% BBCE screen — no elderly/disabled asymmetric tier.** Contrasts directly with Illinois
  (165%/200% two-tier) and Michigan/Georgia (asymmetric elderly-disabled tiers) — proof the framework's
  roster doesn't force every state into the same BBCE shape even among the four 200%-flavored states.
- **A cleaner 3-tier SUA ladder that maps exactly onto this engine's {HCSUA, LUA, phone} shape**, unlike
  Illinois'/Ohio's/Georgia's undermodeled 4th tiers — a useful "this engine's shape is sometimes exactly
  right, not always too narrow" counterexample for the roster.
- **Child support as an ordinary net deduction**, contrasting directly with Illinois' income-exclusion
  mechanism for the identical federal authority (7 CFR 273.9(d)(4)-(5)) — the SAME cross-state contrast
  this pack's own dependent-care-child-support supplement calls out explicitly.
- **A genuinely distinct disqualification category** (certain violent/sexual felons not in compliance with
  sentence terms) this pack did not find an equivalent for in any other state built so far — flagged as
  Florida-specific, not assumed to generalize.
- **A distinctively short 4-month certification period for ABAWD-only households** — no other state in
  this roster has a certification-period length keyed specifically to ABAWD status.
- **Three real production findings, one of them entirely new to this pass.** See below.

## Sources

| Source | Access | Dated |
|---|---|---|
| ACCESS Florida Program Policy Manual chapters 200, 600, 800, 1430, 1610, 1810, 2000, 2200, 2400, 2600, 3200 | plain curl, `ffic.myflfamilies.com/manual/<code>.pdf` | no visible per-chapter revision date found in this pass (unlike IL's MR stamps or MI's BPB stamps) — a gap flagged below |
| F.A.C. 65A-1.603, Food Assistance Program Income and Expenses | browser-header curl (plain curl 403s), flrules.org | effective 2/5/2025; a NEW amendment PROPOSED 8/10/2026 — see freshness.json |
| Fla. Stat. § 414.095(1) | reused from the #619 engine pass, verified there against flsenate.gov — not re-fetched this session | current statute |
| DCF ABAWD FAQ (myflfamilies.com/services/public-assistance/abawd) | plain curl | undated page, fetched 2026-08-11 |
| USDA FNA RMP state list + ABAWD waiver-response file index | browser-header curl, fna.usda.gov | undated page (RMP list); file index covers FY2025-2029, fetched 2026-08-11 |

## Findings a maintainer must know

1. **F.A.C. 65A-1.603 is mid-revision RIGHT NOW.** The rule that carries FL's SUA/BUA/telephone/shelter
   figures has a new amendment PROPOSED 8/10/2026 — the day before this pack was built — with an earlier
   development-stage notice from 7/22/2026. The currently-effective version (2/5/2025) is what this pack
   and the existing engine constant both cite, but expect it to be superseded on a timeline of weeks to a
   few months, not the usual annual October cycle most other states in this roster follow. This is a
   genuinely different refresh cadence from every other state built so far — Florida's utility standards
   do NOT ride the federal COLA calendar.
2. **`packages/snap-rules`'s `FL.abawd_waiver_avail` may be stale — FILED (#708), not fixed.** No
   ABAWD waiver-response file exists for Florida in USDA's FY2025-2029 index (every comparison state
   checked — AZ, IL, MI, WA — has at least one), and a secondary source states Florida held no waiver as
   of FY2024 Q4. Not confirmed against a direct FNA quarterly PDF (JS-rendered link list, not fetched this
   pass) — the next concrete step, not a dead end. Same bug class and same direction-of-error risk as
   #701 (a stale `true` over-approves an ABAWD household that doesn't actually hold a waiver).
3. **`packages/snap-rules`'s `FL.rmp_operated: false` is CONFIRMED correct**, the one RMP check this
   session that did NOT surface a discrepancy — USDA's authoritative RMP state list does not include
   Florida. Worth recording precisely because two other RMP checks this same session (Illinois #704,
   Washington #707) both found the opposite.
4. **A genuinely new, unplanned finding: `packages/snap-rules`'s `WA.rmp_operated: true` may ALSO be
   wrong — filed as #707**, discovered as a byproduct of checking FL's RMP status against the same
   authoritative USDA list. WA's own corpus pack has no restaurant-meals-program supplement at all, and
   the engine's `true` value has no supporting comment (unlike CA's AB 942 citation) — an unverified claim
   contradicted by the only primary source now on file for it.
5. **This pack's biggest sourcing gap: no per-passage revision-date stamp was found** in the ACCESS
   Florida manual, unlike Illinois' MR-numbered TOC or Michigan's BPB-stamped page headers. Every dollar
   figure in this pack is dated via ITS OWN separate source (F.A.C. 65A-1.603's effective date), not via
   the manual chapter it's discussed in — a maintainer re-verifying this pack should re-check the F.A.C.
   rule directly, not assume the manual PDF's fetch date reflects the content's last revision.

## Refresh triggers

- **F.A.C. 65A-1.603's pending amendment (proposed 8/10/2026)** → check flrules.org for adoption; update
  SUA/BUA/telephone/shelter-cap figures the moment it takes effect — do not wait for an annual cycle.
- **ABAWD waiver status** → resolve issue #708 by fetching a direct FNA quarterly waiver-status PDF.
- New F.A.C. 65A-1 rule amendments, or ACCESS Florida manual chapter updates → re-fetch the affected
  chapter PDF and diff against this pack's quoted text.

## Verification log

- **Draft-time source discipline:** every FS passage traces to its own manual chapter PDF; every dollar
  figure traces to F.A.C. 65A-1.603 directly (reused citation from #619, independently re-checked this
  pass for currency, not blindly trusted). 305 ILCS-style reuse discipline applied to Fla. Stat. §
  414.095 — explicitly marked REUSED, not re-derived, in both `authorities.json` and the
  criminal-justice-disqualifications supplement.
- **Three production findings surfaced while cross-checking against `packages/snap-rules`** — one
  confirming the existing constant (RMP), one flagging a possibly-stale existing constant (FL's ABAWD
  waiver, #708), and one entirely unplanned discovery in a DIFFERENT state's constant found as a byproduct
  of this state's own research (WA's RMP, #707). All three logged above with full citation trails.
- **Self-conducted adversarial refute pass (2026-08-11, no Agent/Workflow spawned):** re-read every claim
  in `supplements.json` against the originally fetched manual/rule text before committing. 2 corrections
  found and applied:
  1. **`dependent-care-child-support` was drafted generically instead of from the actual fetched body
     text.** The first draft had only read the section TOC titles (FS 2410.0323/.0329) and wrote plausible,
     generic deduction language — the same class of error the IL pack's refute pass caught (inferring
     content from a title, not the actual text). The real FS 2410.0323/.0324/.0329/.0330/.0331 body text
     (already fetched, just not yet read) contains real Florida-specific detail the draft completely
     missed: a $200/child verification-required threshold with a real dollar-capped fallback if
     unverified; kindergarten/transportation/vendor-payment exclusions; a mandatory attendant-care
     tie-breaker (medical, not dependent care); and — the single most Florida-specific fact in this
     pack — the child support deduction is budgeted ONLY if the non-custodial parent affirmatively
     REQUESTS it (FS 2410.0331), unlike states where a verified obligation applies automatically. Rewrote
     the entry from the actual text.
  2. **Overclaimed that the 8/22/1996 drug-trafficking date qualifier appears in two separate manual
     passages.** First draft asserted the date-limited framing "appears in both the simplified-reporting
     passage and the categorical-eligibility passage." Re-checking both fetched passages: FS 2010.0202
     (categorical eligibility) DOES carry the date qualifier; FS 0810.0200 (simplified reporting) lists
     the same disqualification categories but does NOT repeat the date clause in that specific passage.
     Corrected to state the date qualifier is confirmed only at FS 2010.0202, not to assume it's restated
     everywhere the disqualification list appears.
  No fabricated citations were found — both corrections were mischaracterizations of source text already
  in hand (one from reading a title instead of the body, one from over-generalizing a single confirmed
  fact to a second, unverified location), not sourcing failures.
