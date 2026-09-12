# Re-screening the universe on the corrected signal

**2026-08-26.** Output: `data-ops/analysis/bank-pe-mining/rescreen_triage_2026.csv` (193 banks).

## Why a triage and not a screen

Capacity — disclosed per-assessment-area giving — is the axis that decides whether a bank
*can* fund us. It cannot be screened at scale:

- it appears in **no API**; it exists only in the narrative of a PDF
- automated extraction **failed on 6 of 12** attempts, and once lifted a Washington DC
  figure into an unrelated assessment area
- **asset size does not predict it**: r² = 0.02, with a 27× spread

So capacity requires a human PE read, and the only question that can be optimised is
**which PEs to read first**. Branch presence is free from FDIC `/banks/locations`, and
county-level unenrolled population we already hold.

**Ranking metric — branch-weighted exposure:** Σ (branches in county × unenrolled persons
in county). A bank with 400 branches spread across low-need counties ranks below one with
20 branches in Los Angeles and Harris.

## The tiers

| Tier | Meaning | n |
|---|---|---|
| **1** | Documented **Service Test** gap + branch presence | **121** |
| **2** | Service rating unknown — must be read before any pitch | **26** |
| **3** | **Clean** service rating — peer candidates | **46** |

### Tier 1 — read these first

| Bank | Branches | Counties | Exposure | Largest |
|---|---:|---:|---:|---|
| Prosperity Bank | 406 | 97 | 48,579,651 | Harris |
| Regions Bank | 597 | 226 | 25,488,177 | Miami-Dade |
| Bank of Hope | 78 | 21 | 20,856,033 | Los Angeles |
| First Bank | 76 | 20 | 17,010,383 | Los Angeles |
| Bank OZK | 271 | 110 | 16,056,545 | Harris |
| CTBC Bank *(on roster)* | 20 | 7 | 10,601,206 | Los Angeles |
| First American *(on roster)* | 76 | 16 | 9,975,055 | Cook |
| Centennial Bank | 243 | 91 | 9,326,137 | Broward |
| Simmons Bank | 229 | 96 | 9,312,985 | Tarrant |
| PlainsCapital Bank | 57 | 15 | 7,795,354 | Harris |

**Prosperity Bank is the largest unworked target in the universe** — 406 branches across 97
counties, anchored in Harris, with a documented Service Test gap.

### Tier 3 — the 46 the old screen was mispitching

Every one of these has a **clean Service rating and an Investment gap.** Under the gap-only
screen they were targets, and would have received a remediation letter naming a deficiency
that our activity cannot address — a bank does not fix an Investment Test with an outreach
grant, and it does not have a service problem to fix.

| Bank | Branches | Exposure | Largest |
|---|---:|---:|---|
| Hanmi Bank *(on roster — reclassified peer)* | 34 | 15,739,741 | Los Angeles |
| Apple Bank for Savings | 79 | 8,934,224 | Kings |
| PCB Bank | 17 | 8,306,572 | Los Angeles |
| Republic Bank of Chicago | 20 | 4,622,259 | Cook |
| Commercial Bank of California | 10 | 3,230,163 | Los Angeles |
| Western State Bank | 10 | 2,067,882 | Maricopa |

These are not discards. They are **peer candidates** — but the peer pitch requires a
disclosed giving figure, so each still needs its PE read before it can be approached.

### Tier 2 — 26 banks with no service rating on file

These must be read before any pitch. The generator now **refuses** to resolve an archetype
for a bank with an empty `svc_rating`, because the earlier behaviour was to fall through to
`peer` — which would have sent a letter praising giving nobody had verified, justified by a
rating nobody had read. Three banks already on the roster (Ocean, Texas First, Western
Alliance) were caught by that guard and resolved by hand.

## Caveats

- **Exposure is a triage metric, not a forecast.** Branch counts do not measure marketing
  reach, and unenrolled counts are modelled.
- **Branch presence is not assessment-area membership.** It orders a reading queue and
  nothing else. Every AA still comes from the PE itself — the token-presence heuristic was
  tested against 19 verified targets and would have discarded 10 of them.
- **Component ratings from state regulators are not comparable.** Massachusetts has no
  "Low Satisfactory" (see `ma-rating-scale-2026-08-26.md`); NY, CT and RI are unverified.
  Any state-examined institution in this file may be mis-tiered.
- **The 2022–23 CRAPES vintage is defective** — 25.1% Substantial Noncompliance against
  0.1% in every other year. Ratings sourced from that window are unreliable.
