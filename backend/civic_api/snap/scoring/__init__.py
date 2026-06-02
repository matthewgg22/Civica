"""The shared scoring spine — expected-error-dollars, used by BOTH integrity wings.

Value(unit) = P(error) × $-at-risk × tier_weight   (civica_accurate_number_model §5)

  prevention wing  → ranks INPUT FIELDS (which to clarify, pre-determination)
  error-rate wing  → ranks CASES (which to re-check, post-determination)

The sensitivity primitive is perturb-and-re-run: it re-runs the ONE
EligibilityEngine on perturbed inputs (sensitivity.py). It never re-derives the
benefit math — that stays single-source in the engine. Analytic coefficients are
a fast pre-filter only.

Empirical inputs (p_error, p_flip priors, the §10105 tier slope) are FLAGGED
PLACEHOLDERS until the QC-distribution docs + internal gold standard land — no
rate is published from these (matrix §5).
"""
