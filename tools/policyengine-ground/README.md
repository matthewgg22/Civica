# policyengine-ground — the MODELED lens for /findings/error-rate

Computes **CA SNAP benefit leverage by error element**: how many dollars of
benefit a single dollar of error in each part of the application actually moves.
The QC microdata says *which* parts error (shelter, wages, …); this says *how
much each one costs* — the mechanism behind the rate.

`leverage(element) = |Δ annual SNAP benefit| / |Δ input $|`, a central ±$100/mo
slope, summarized over a representative CA household panel.

## Headline (FY2024 params)

- **Unearned income ≈ $0.30 per $1** — counts ~dollar-for-dollar into net income × the 30% benefit-reduction rate. The most expensive thing to get wrong.
- **Wages < that** — the 20% earned-income deduction softens each dollar (structural max ≈ $0.24).
- **Shelter is bimodal** — the excess-shelter deduction is **capped** for non-elderly/non-disabled households, and in high-rent CA almost all of them are already over the cap, so extra rent moves the benefit **$0**. Households with an elderly (60+) or disabled member are **uncapped** (≈ $0.30).

**Implication:** the highest-*dollar*-leverage error is income — exactly the part
automated payroll verification fixes. So the dollar-weighted error tilts toward
income more than the QC case-count shares (shelter-led) suggest.

## ⚠️ AGPL boundary

`policyengine-us` is **AGPL-3.0**. This is a **dev tool** that runs it **offline**
in a local venv. We ship only the JSON **output** (facts) and this harness
source — never the policyengine-us code, and never an import into any Civica
runtime (`apps/*`, `backend/*`, Workers, Swift). Outputs are facts about a public
benefit formula; the library is not conveyed.

## Run

```bash
cd tools/policyengine-ground
python3 -m venv .venv            # .venv is gitignored
.venv/bin/pip install -r requirements.txt
.venv/bin/python src/leverage.py \
  --pe-version "$(.venv/bin/pip show policyengine-us | sed -n 's/^Version: //p')" \
  --out ../../data-ops/sample/policyengine-ca/element_leverage_fy2024.json
# add --quick for a fast smoke run (smaller panel)
```

Output + provenance: `data-ops/sample/policyengine-ca/`. Finding:
`docs/findings/2026-05-29-policyengine-benefit-leverage.md`.
