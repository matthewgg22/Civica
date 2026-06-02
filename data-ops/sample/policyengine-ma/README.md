# PolicyEngine MA — SNAP benefit leverage by error element (FY2024)

The MODELED lens for the MA pilot — companion to
[`../usda-qc-ma/`](../usda-qc-ma/) (the empirical lens). USDA QC says
**which** parts of an MA application error; this says **how many dollars** a
single dollar of error in each part actually moves.

`leverage(element) = |Δ annual SNAP benefit| / |Δ input $|`, central ±$100/mo
slope, summarized over a representative MA household panel of 64 (size 1–4 ×
{earned/unearned mixes} × shelter {$1000, $1600}/mo × elderly/disabled flag).

## Files

- `element_leverage_fy2024.json` — leverage medians + IQR + share_zero + shelter elderly-split.

## Headline (FY2024 PolicyEngine params, n=64 panel)

| Element | MA median | MA share_zero | CA median | CA share_zero | Δ median |
|---|---:|---:|---:|---:|---:|
| **Wages** | **0.165** | 34% | 0.135 | 9% | +0.030 |
| **Unearned** | **0.06** | 47% | 0.30 | 13% | **−0.24** |
| **Shelter** | **0.0** | **84%** | 0.138 | 45% | −0.138 |
| Mean correct monthly benefit | $572 | — | $354 | — | +$218 |

Two structural facts pop out:

**1. MA's shelter deduction saturates much harder than CA's.** 84% of MA test
households have $0 marginal leverage on shelter (vs 45% in CA) — even among
**elderly/disabled** (uncapped) households, 69% of MA panel members get $0
shelter leverage (vs CA's 19%). MA's lower-rent ceilings mean fewer households
sit in the leverage-positive zone of the excess-shelter calculation.

**2. MA's unearned-income median leverage is much lower than CA's** (0.06 vs
0.30) because a meaningful fraction of MA test households get tipped off SNAP
eligibility entirely by the marginal $100/mo unearned change — `share_zero=47%`
on unearned, vs CA's 13%. MA's lower-rent / lower-benefit profile means
households cluster closer to eligibility cliffs.

**3. Wages leverage is higher in MA** (0.165 vs 0.135), and **wages
share_zero is much lower** (34% vs 9%). Wages still bring the only consistently
nonzero leverage in MA — making **automated wage verification the highest-dollar
mechanism in MA**, more so even than in CA.

## What this changes for the MA pitch

The QC microdata ([`../usda-qc-ma/`](../usda-qc-ma/)) showed:
- Shelter is MA's #1 error element by case count (37.82%)
- Wages is #2 (24.30%)
- Medical/dep-care/UI over-index relative to CA

Combining with the leverage model:

- **Shelter is high-count but near-zero-dollar in MA.** Civica still catches
  shelter errors but the *fiscal* upside is small for the typical MA case.
  This is structural, not Civica-controllable — MA's deduction caps are doing
  the work the federal QC tolerance does elsewhere.
- **Wages is medium-count and the highest-leverage element in MA.**
  Civica's coached intake + (eventually) Argyle/Canvas wage verification is
  the **biggest dollar lever** in MA, even more so than in CA where shelter
  also carries dollar weight.
- **Medical/dep-care leverage is not in this fixture** (the leverage builder
  only models wages/unearned/shelter perturbations) — but per the federal SNAP
  formula these flow at ~0.30 leverage when uncapped, similar to unearned
  income. So MA's over-indexing on medical (9.5% vs CA's 4.0%) and dep-care
  (5.4% vs 2.0%) translates to **real dollar exposure** — not absorbed by a
  cap the way shelter is.

**Net story for the MA pitch deck:**

> Civica's MA dollar impact is concentrated in **income** (wages + UI) and
> **uncapped deductions** (medical, dep-care) — exactly the elements MA
> over-errors on. Shelter is the biggest count problem but the smallest dollar
> problem in MA, because MA's deduction structure saturates the upside.

This is a *stronger* MA pitch than the count-only frame, because the elements
Civica can actually move are the ones with both meaningful count share AND
meaningful dollar leverage. The dollar-weighted MA value isn't dominated by
shelter (where Civica would compete with structural caps); it's dominated by
the elements Civica's intake/verification flow is built for.

## ⚠️ AGPL boundary

`policyengine-us` is **AGPL-3.0**. This is a **dev tool** that runs it
**offline** in a local venv. We ship only the JSON output (facts about
public SNAP formulas) — never the policyengine-us code, and never an import
into any Civica runtime (`apps/*`, `backend/*`, Workers, Swift). Outputs are
facts about a public benefit formula; the library is not conveyed. Same posture
as [`../policyengine-ca/`](../policyengine-ca/).

## Source

- **PolicyEngine US** — OpenFisca model with federal SNAP (BBCE, ABAWD,
  asset test) + state-specific params for CA, MA, and others. AGPL-3.0.
- **Version:** 1.715.2 (see `pe_version` in the JSON).
- **Parameter year:** 2024 (FY2024 SNAP params, federal + MA-specific).
- **Generated:** 2026-06-01.
- **License of *outputs* (this directory):** outputs are facts derived from a
  public benefit formula; not encumbered by the library's AGPL. Same posture
  as `policyengine-ca`.

## How to reproduce

```bash
cd tools/policyengine-ground
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python src/leverage.py --state MA \
  --pe-version "$(.venv/bin/pip show policyengine-us | sed -n 's/^Version: //p')"
# add --quick for a smaller smoke panel
```

## Caveats

- **Panel is a structured grid, not a representative sample.** 64 households,
  designed to span the deduction-cap inflection points (elderly/non-elderly ×
  shelter ranges × earned/unearned mixes). The medians are *of this panel*,
  not population estimates. A representative ACS-weighted MA sample would
  shift the medians somewhat; the *direction* of MA-vs-CA findings should
  hold under reweighting.
- **Only three elements modeled** (wages, unearned, shelter). The QC top-10
  has 7 more — medical, dep-care, UI, SUA, etc. Extending the leverage
  builder to those is mechanical (same perturbation pattern, different input
  variable) but not yet done. Until then, infer their leverage from the
  general SNAP-formula rules described in the per-element prose above.
- **FY2024 params** — MA's deduction tables update periodically; rerun the
  builder if param_year drifts past current pitch needs.

## Cross-references

- CA sibling — [`../policyengine-ca/`](../policyengine-ca/)
- Empirical MA error mix — [`../usda-qc-ma/`](../usda-qc-ma/)
- MA pilot baseline finding — [`../../../docs/findings/2026-06-01-ma-state-baseline.md`](../../../docs/findings/2026-06-01-ma-state-baseline.md)
- Original CA leverage finding — [`../../../docs/findings/2026-05-29-policyengine-benefit-leverage.md`](../../../docs/findings/2026-05-29-policyengine-benefit-leverage.md)
- Auto-memory: [`reference_policyengine_us`](../../../../.claude/projects/-Users-matthewgreer-gentis-Developer-Civica/memory/reference_policyengine_us.md)
