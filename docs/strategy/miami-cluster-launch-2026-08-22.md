# Miami cluster launch — Miami-Dade, Broward, Orange

**Built 2026-08-22.** First cluster to go. Three banks, one shared assessment area, **$40,000 pooled.**
**Artifacts:** `out/helm_bank.pdf` · `out/banco_do_brasil_americas.pdf` · `out/ocean_bank.pdf`
**Context:** [county-bank-map](../../data-ops/analysis/county-bank-map/) ·
[bank-pe-mining](bank-pe-mining-2026-08-22.md)

**Why this cluster first:** not the largest need — Harris TX (205,366 unenrolled households) and
Maricopa AZ (154,213) are both bigger. This one goes first because **three pressured banks share one
assessment area**, so the money stacks, one artifact family serves all three, and one state
registration unlocks the whole cluster. Need here is still large: **Miami-Dade 90,893 · Broward
84,038 · Orange 51,257** eligible-unenrolled households.

---

## The sequencing changed once component ratings were read

Our prior order led with Helm on the strength of its quadruple signal. **Reading the component
ratings inverts it.**

| Bank | Overall | Lending | Investment | Service | Exam | Ask |
|---|---|---|---|---|---|---|
| **Ocean Bank** | Satisfactory | High Sat | **Low Satisfactory** | **Low Satisfactory** | 6/2023 | **$25,000** |
| **Banco do Brasil Americas** | **Needs to Improve** | **NTI** | High Sat | **Low Satisfactory** | 5/2025 | **$10,000** |
| **Helm Bank USA** | **Needs to Improve** | **NTI** | — | — *(CD Test **Satisfactory**)* | 6/2025 | **$5,000** |

**Ocean Bank goes first, despite being the only one not rated NTI.** It is the only bank in the
cluster with a documented weakness in *both* tests our activity feeds — the Investment Test, where a
grant counts, and the Service Test, where community development services count. Overall rating is
the wrong screen; component ratings are the right one.

**Helm goes last, and the reason is honesty.** Helm's overall NTI is driven by a **Lending Test**
rated Needs to Improve, while its **Community Development Test is Satisfactory.** A grant does not
fix what is wrong at Helm. That was already recorded as a bright line in the call guide, and the
sequencing now reflects it.

---

## 🏆 The opener, from Ocean Bank's own evaluation

Their Investment Test finding, verbatim:

> "The institution has an adequate level of qualified community development investments and grants,
> **although rarely in a leadership position.**"

That is the pitch, and they wrote it. Anchor-funding a new county programme *is* a leadership
position — first money into something that did not exist, in their own assessment area, with a
report that documents it. No other line in this project matches a documented criticism to an offer
this precisely.

**Ocean opener:** *"Your last evaluation says your community development investments are adequate but
rarely in a leadership position, and your Service Test is Low Satisfactory. We are launching a
benefits-access programme across Miami-Dade, Broward and Orange, where 226,188 income-eligible
households are not receiving SNAP. $25,000 makes you the anchor funder — first in, named as such,
with a quarterly report written for your file."*

**Banco do Brasil opener:** third consecutive NTI, and a **Service Test rated Low Satisfactory**.
Lead with the Service Test, because that is the one a community development service actually moves —
and be plain that the Lending Test is not something we affect.

**Helm opener:** join an existing programme. Their CD Test is already Satisfactory, so the honest
frame is participation and cost-sharing, not remediation.

---

## Pooled economics

$25,000 + $10,000 + $5,000 = **$40,000** across three counties, which clears the
[minimum viable grant floor](minimum-viable-grant-2026-08-22.md) comfortably where none of the three
does alone at Helm's or BdB's level.

Shares: Ocean **63%**, BdB **25%**, Helm **13%**. Generate pooled reports with
`--pool-total 40000 --pool-members "ocean_bank,banco_do_brasil_americas,helm_bank"`. Every figure is
cut to share, no bank is shown another's households, and naming stays off until each consents in
writing.

**Sequence the asks, not the pool.** You cannot pitch a pool that does not exist. Ocean is asked
solo, as anchor. BdB and Helm are then asked to join a programme that is already running — which is
a materially easier conversation than asking anyone to fund a concept.

---

## Blockers, in the order they bite

1. **FDACS-10100 charitable-solicitation registration is unfiled and legally gates Florida
   solicitation.** $10–$75, roughly 2–4 weeks. Budget-in-lieu-of-990 is acceptable. **Nothing in this
   cluster can be sent until it is filed** — this is the critical path, not the artifacts.
2. **All three banks are `verified: false`.** `--send` refuses. Re-read each PE's assessment-area
   delineation and flip the flag. The AAs here are already PE-sourced, so this is confirmation rather
   than research.
3. **Spreadsheet oracle check** against the printed ORACLE CHECK figures — Helm 633,773 / BdB 499,630
   / Ocean 466,871 unenrolled persons.
4. **Meta ad-category placement unconfirmed.** Miami-Dade at 1,946 sq mi absorbs a 15-mile radius, so
   the cluster is workable even under the special-category floor — but confirm before spending.

---

## What is true and what is not, for this cluster

- Disproportionality ratios are **0.93–0.96**, below the 1.15 display threshold, so the artifacts
  correctly suppress that line. **Do not claim these banks' areas are disproportionately underserved
  — they are not.** The case is absolute unmet need, which is large.
- The credit-score research is cited version-stamped as preliminary, direction only.
- Helm's rating will not be fixed by a grant, and the materials must not imply otherwise.
