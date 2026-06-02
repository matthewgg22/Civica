"""L0-minimal citation registry for the rules engine's test outcomes.

Maps each TestOutcome.test_name produced by federal.py / states to the primary
regulatory authority it implements. The assignments are lifted from the
citations the rule methods already declare in their docstrings (federal.py
"Student rule (per 7 CFR 273.5)", states cite CDSS MPP Div 63 / 106 CMR). The
shadow sweep stamps eligibility_rule_trace.citation_id from here so every trace
row is defensible — "which rule, citing which reg."

This is the L0-minimal of docs/plans/snap-rules-matrix.md; the full registry is
the structured YAML described there. State BBCE/MCE variants cite the federal
BBCE enabler (7 CFR 273.2(j)) as the primary authority; the state handbook
(CDSS MPP Div 63 / 106 CMR) is the secondary authority in STATE_AUTHORITY.

⚠ VALIDATE before relying on these in an audit response: the CFR subsection
assignments are lifted from the engine's own docstrings, NOT re-verified against
the live eCFR. Confirm 273.4 (citizenship), 273.5 (students), 273.9(a)(1)/(a)(2)
(gross/net income), 273.8 (resources), and 273.2(j) (BBCE) against primary text.
"""
from __future__ import annotations

# Exact test_name -> primary CFR (or state reg) authority.
_EXACT: dict[str, str] = {
    "citizenship": "7 CFR 273.4",
    "student_rule": "7 CFR 273.5",
    "student_rule_ca": "7 CFR 273.5",
    "student_rule_ma": "106 CMR 362.410",
    "gross_income_130pct_fpl": "7 CFR 273.9(a)(1)",
    "gross_income_200pct_fpl_ca_mce": "7 CFR 273.2(j)",
    "gross_income_200pct_fpl_ma_bbce": "7 CFR 273.2(j)",
    "net_income_100pct_fpl": "7 CFR 273.9(a)(2)",
    "asset_limit": "7 CFR 273.8",
    "asset_limit_waived_ca_mce": "7 CFR 273.2(j)",
    "asset_limit_waived_ma_bbce": "7 CFR 273.2(j)",
    "categorical_eligibility": "7 CFR 273.2(j)(2)(i)",
    "expedited": "7 CFR 273.2(i)",
}

# Fallback by prefix, for test_name variants not enumerated above.
_PREFIX: tuple[tuple[str, str], ...] = (
    ("gross_income", "7 CFR 273.9(a)(1)"),
    ("net_income", "7 CFR 273.9(a)(2)"),
    ("asset_limit", "7 CFR 273.8"),
    ("student_rule", "7 CFR 273.5"),
    ("citizenship", "7 CFR 273.4"),
)

# Secondary state authority for the BBCE/MCE + state-student variants.
STATE_AUTHORITY: dict[str, str] = {
    "gross_income_200pct_fpl_ca_mce": "CDSS MPP Div 63",
    "asset_limit_waived_ca_mce": "CDSS MPP Div 63",
    "student_rule_ca": "CDSS MPP Div 63",
    "gross_income_200pct_fpl_ma_bbce": "106 CMR 365",
    "asset_limit_waived_ma_bbce": "106 CMR 363",
}


def citation_for(test_name: str) -> str | None:
    """Primary regulatory authority for a rule/test id, or None if unmapped."""
    if test_name in _EXACT:
        return _EXACT[test_name]
    for prefix, cite in _PREFIX:
        if test_name.startswith(prefix):
            return cite
    return None
