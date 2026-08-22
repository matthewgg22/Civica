"""Projected pilot funnel for the mock quarterly report (page 3).

Policy (CEO review T2 + design review): submitted-basis, LOW and MID scenarios
only. The HIGH scenario is computed nowhere in this module so it cannot leak
into an artifact.
"""

SCENARIOS = ("low", "mid")  # HIGH deliberately absent — see mock_report_policy


def funnel(budget_usd, a):
    """Quarterly funnel per scenario from the versioned assumptions dict."""
    out = {}
    split = a["budget_split"]
    for s in SCENARIOS:
        clicks = (budget_usd * split["google"] / a["cpc_usd"]["google"][s]
                  + budget_usd * split["meta"] / a["cpc_usd"]["meta"][s])
        sessions = clicks * a["rates"]["click_to_session"][s]
        checks = sessions * a["rates"]["session_to_check"][s]
        started = checks * a["rates"]["check_to_app_started"][s]
        submitted = started * a["rates"]["started_to_submitted"]
        approved = submitted * a["rates"]["approval"][s]
        annual_benefit = approved * a["benefit"]["avg_household_monthly_usd"] * 12
        out[s] = {
            "clicks": clicks, "sessions": sessions, "checks": checks,
            "apps_started": started, "apps_submitted": submitted,
            "approved_households": approved, "annual_benefit_usd": annual_benefit,
        }
    return out
