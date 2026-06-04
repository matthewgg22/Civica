# openICPSR 194727 — Giannella, Homonoff, Rino & Somerville, "Administrative Burden and Procedural Denials: Experimental Evidence from SNAP"

**Los Angeles SNAP intake field experiment (~65,000 applicants) — randomized
flexible-interview treatment → application approval / procedural-denial
outcomes.** This is the *experimentally identified* micro analogue of the
aggregate CAPER denial-side error series in `../../usda-caper/`.

> **Status: SCAFFOLD (GATED).** Bytes are **not** vendored. Download requires a
> free openICPSR/AEA account and a click-through Terms-of-Use acceptance. No
> login was performed to build this README.

## What it is

- **Authors:** Eric Giannella (Code for America) · Tatiana Homonoff (NYU) · Gwen Rino (Code for America) · Jason Somerville (Federal Reserve Bank of New York).
- **Paper:** *Administrative Burden and Procedural Denials: Experimental Evidence from SNAP*, **American Economic Journal: Economic Policy 16(4): 316–340 (Nov 2024)**. NBER WP 31239; SSRN 4448289. DOI 10.1257/pol.20220701.
- **Setting:** SNAP intake in **Los Angeles**. The intake **interview** is identified as the key procedural barrier to take-up.
- **Design:** a **field experiment** over **~65,000 LA applicants**. Treatment = access to a **flexible, applicant-initiated interview** (vs. the standard scheduled interview). Random assignment ⇒ clean causal identification.
- **Headline results:** flexible interviews **increase approvals by ~6 percentage points**, **double early approvals**, and raise **long-term participation by >2 percentage points** — most of the lost take-up under the standard process is **procedural denial**, not ineligibility.
- **Distributed:** ICPSR, 2024-10-22.

## Regression role for Civica

| Slot | Variable | Notes |
| ---- | -------- | ----- |
| **Treatment / IV** | randomized flexible-interview assignment | Experimental — the gold-standard identifying variation for "does reducing interview burden cut procedural denials?" |
| **Dependent (DV)** | approved vs. **procedurally denied**; early-approval; long-term participation | The application-door error: eligible applicants denied for process, not merits. |
| **Controls** | applicant demographics, office, application channel (as released) | Confirm against the package codebook at download. |

**Why Civica wants it:** it is the strongest published causal evidence that
*intake friction* (not eligibility) produces denials — the experimental backbone
of the **error-attribution → operational** thesis
(`docs/findings/2026-05-28-error-attribution-framework.md`,
`docs/findings/2026-05-29-caper-denial-side-error.md`). CAPER measures the
denial-side error rate in aggregate (CA 39.84% of negative actions carry an
error); 194727 shows a burden-reduction *intervention* moves it, and by how much.
It also directly validates Civica's "perfect application / reduce burden, not
add documentation" ethos (`docs/findings/2026-05-29-guarino-error-rate-metric.md`).

## Manual acquisition (operator steps)

1. Go to the project landing page: **https://www.openicpsr.org/openicpsr/project/194727/version/V1/view**
2. Sign in / create a **free** openICPSR/AEA account (AEA / ICPSR / institutional / Google login). No cost.
3. **Read and accept the Terms of Use / Responsible-Use click-through** (no re-identification; replication use). **A human must accept — do not script the click.**
4. Download **Version V1** (replication package: data + code).
5. Unzip here (preserve upstream layout); `dvc add` data files. **Do not commit raw microdata to git** — vendor only derived/aggregated artifacts + provenance, mirroring `../../usda-qc-ca/`.
6. Write a `provenance.json` (source URL, version, retrieval date, license).

## License / terms

- **License:** openICPSR default **CC-BY 4.0** for data/documents (modified-BSD for code); depositor-selected, AEA-required to permit replication. Confirm on the 194727 landing page at download time.
- **Use agreement:** ICPSR responsible-use click-through (no individual-subject investigation without written ICPSR authorization; no use of inadvertently discovered identities).
- **Citation:** cite the openICPSR DOI **and** AEJ:EP 16(4):316–340 (2024) in any external claim.

## Sources

- Landing page: https://www.openicpsr.org/openicpsr/project/194727/version/V1/view
- AEA article: https://www.aeaweb.org/articles?id=10.1257%2Fpol.20220701
- NBER WP 31239: https://www.nber.org/papers/w31239 · SSRN 4448289: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4448289
- openICPSR / AEA repository terms: https://www.openicpsr.org/openicpsr/aea · https://www.openicpsr.org/openicpsr/faqs
