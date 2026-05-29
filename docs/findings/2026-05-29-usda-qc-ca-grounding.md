---
id: 2026-05-29-usda-qc-ca-grounding
date: 2026-05-29
scope: [analytics, snap-qc-engine, pitch]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: dataset
    ref: "USDA SNAP QC Public-Use File FY2023 (snapqcdata.net/datafiles → qcfy2023_csv.zip)"
    note: "43,776 sampled cases nationally; California subsample = 867 cases (STATE=6). Public-use, free, no agreement. Codebook: FY2023 Tech Doc Ch. V."
  - kind: file
    ref: tools/usda-qc-ingest/src/ca_aggregates.py
    note: "Reproducible computation — filters CA, weights by FYWGT, element shares (errored-cases-citing / errored-cases), and the dollar-weighted agency-vs-client split using the codebook AGENCY map."
  - kind: file
    ref: data-ops/sample/usda-qc-ca/ca_qc_fy2023.json
    note: "Vendored CA aggregate + provenance."
  - kind: file
    ref: packages/snap-qc-engine/src/scoring/error-risk.ts
    note: "CA_ELEMENT_ATTRIBUTION_FY23 — the engine constants this validates."
---

## What we found

We pulled the real USDA SNAP QC FY2023 public-use microdata (43,776 cases; CA
subsample 867) and recomputed CA's error structure from scratch. Three results:

**1. The engine's element attribution is real.** Computed straight from the file
(weighted, errored-cases-citing-element / errored-cases), the engine constants
reproduce within ~1.5pp:

| Element | Microdata | Engine |
| --- | --- | --- |
| Shelter | 41.5% | 39.94% |
| Wages | 22.2% | 21.35% |
| RSDI | 11.5% | 11.06% |
| SSI | 7.95% | 7.65% |
| Other unearned | 6.49% | 6.25% |
| Self-employment | 5.11% | 5.16% |
| SUA | 4.92% | 4.49% |
| Medical | 4.03% | 3.88% |

So the reference layer on `/findings/error-rate` is no longer "trust our
constants" — it is "here is the federal file and the query, and it matches."

**2. "6 of 10" is confirmed.** Shelter OR wages appears in **60.8%** of CA
errored cases.

**3. Operational vs client = ~65% / 35%** (dollar-weighted variance, agency vs
client responsibility; 61% / 34% / 5%-"other" before excluding the other/excluded
codes). This **corrects the recalled "80/20."** Errors are mostly operational —
roughly 2:1 — but it is 65/35, not 80/20. And there is **no "policy" bucket**:
QC classifies every error as *agency* (operational — failed to verify, miscalc,
data entry, even "policy incorrectly applied" by a worker) or *client*
(household did not report). "Operational vs policy" was the wrong dichotomy; the
real one is agency vs client.

## Why it matters

- **It hardens the pitch from claim to citation.** The element/TAM story now
  traces to a public federal file anyone can re-run — the strongest version of
  the auditable-claims posture.
- **Operational-dominant = tool-fixable.** ~65% of error dollars are agency/
  operational (verification, computation, follow-up) — exactly what software
  removes. You do not need a policy change; you need the hard parts verified.
- **Honesty in action.** The recalled 80/20 was directionally right but wrong on
  the number; grounding it produced the real 65/35. That is the system working.

## What changes

- `/findings/error-rate` "operational, not policy" section gets the real **65/35**
  (replacing the placeholder), and the element table can carry a
  "matches federal microdata" note.
- Vendored `data-ops/sample/usda-qc-ca/ca_qc_fy2023.json` + the reproducible
  `ca_aggregates.py`. The raw 65MB file is not committed (regenerate via the
  README download).

## Open questions

- **Dollar-weighted total PER** recompute (needs the QC tolerance methodology +
  the issuance base) to validate the 13.40% CA FY2023 headline — deferred.
- The **"other" (code 99) 5%** of variance dollars — unclassified; small.
- **Multi-year** (FY2021/FY2022 files are available) trend + stability of the
  65/35 split.

Related: [[2026-05-29-error-rate-truth-point]] · [[2026-05-29-error-rate-readout]]
