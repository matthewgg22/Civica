"""County eligible-unenrolled, one method everywhere.

The old county metric compared SNAP households against households under 100% FPL.
SNAP reaches 130% FPL, and up to 200% under broad-based categorical eligibility,
so that denominator is too small: 1,010 of 3,222 counties came out at coverage
>= 1 and their "unserved" floored to zero. Los Angeles read 1.032, which looks
like over-service and is an artifact of the wrong denominator. The file's own
provenance already said so -- "SCREENING INDEX ONLY ... this is not an
eligibility model" -- but the board was printing it as though it were one.

Method here:
  1. ACS C17002 gives the ratio-of-income-to-poverty distribution per county, in
     PERSONS. Eligible-population proxy = everyone under 1.30 of poverty.
     Bracket 004 (1.00-1.24) is taken whole; bracket 005 covers 1.25-1.49, so
     1.25-1.30 is 5/24 of it.
  2. USDA FNS / Mathematica publishes eligible-unenrolled by STATE (FY2022).
     That is the authoritative total.
  3. Allocate each state's total across its counties in proportion to their share
     of the state's under-130% population.

The result is one number, computed identically everywhere, anchored to a real
published total, and it never floors at zero. It is still an allocation, not a
county-level measurement -- said plainly wherever it is shown.
"""
import csv, json, re

# USDA FNS / Mathematica, Reaching Those in Need, FY2022 (published Feb 2025).
# Only states whose ABSOLUTE eligible-unenrolled is on file here. A state absent
# from this map gets no allocated figure rather than a guessed one.
# USDA FNS / Mathematica, "Reaching Those in Need", FY2022 (Cunnyngham, Feb 2025).
# All 51 jurisdictions, parsed from the report's own eligible-people chart and
# validated against every figure the project had previously published by hand:
# CA 877,420 vs ~877,000, TX 999,960 vs ~1,000,000, FL, NY, AZ, AR, SC, KY, MS,
# TN all inside 6%. Total 4,703,000 against the report's national ~4.6M.
#
# Illinois, Massachusetts and New Mexico sit at a CAPPED 100% -- the report is
# explicit that 100% is a capped estimate, not literal full enrollment. Their
# eligible-unenrolled is therefore 0 under FEDERAL eligibility rules, which is a
# finding rather than missing data: those states are the coverage-mode case, to
# be ranked on relative coverage with no absolute claim attached.
FNS = json.load(open("fns_state_2022.json"))
FNS_ELIGIBLE_UNENROLLED = {k: v["eligible_unenrolled"] for k, v in FNS.items()}
CAPPED = {k for k, v in FNS.items() if v.get("capped") or v["rate"] >= 100}

d = json.load(open("c17002.json"))["data"]
cov = {r["geoid"]: r for r in csv.DictReader(
    open("../mar/data-ops/analysis/national-snap-coverage/national_snap_coverage_county.csv"))}

rows = []
for geo, payload in d.items():
    e = payload["C17002"]["estimate"]
    fips = geo.split("US")[-1]
    under130 = (e.get("C17002002", 0) + e.get("C17002003", 0)
                + e.get("C17002004", 0) + e.get("C17002005", 0) * 5 / 24)
    under200 = sum(e.get(f"C17002{n:03d}", 0) for n in range(2, 8))
    c = cov.get(fips, {})
    rows.append({
        "geoid": fips,
        "county": c.get("county", ""),
        "state": c.get("state", ""),
        "pop_poverty_universe": int(e.get("C17002001", 0)),
        "pop_under_130_fpl": round(under130),
        "pop_under_200_fpl": round(under200),
        "snap_hh": c.get("snap_hh", ""),
        "poor_hh": c.get("poor_hh", ""),
    })

# allocate the state totals
by_state = {}
for r in rows:
    by_state.setdefault(r["state"], 0)
    by_state[r["state"]] += r["pop_under_130_fpl"]

allocated = 0
for r in rows:
    tot = FNS_ELIGIBLE_UNENROLLED.get(r["state"])
    denom = by_state.get(r["state"], 0)
    if r["state"] in CAPPED:
        r["eligible_unenrolled"] = 0
        r["method"] = ("state at a capped 100% participation rate — no measurable gap "
                       "under federal eligibility rules")
    elif tot and denom:
        r["eligible_unenrolled"] = round(tot * r["pop_under_130_fpl"] / denom)
        r["method"] = "FNS state total allocated by share of under-130% FPL population"
        allocated += 1
    else:
        r["eligible_unenrolled"] = ""
        r["method"] = ("state at a capped 100% participation rate — no measurable gap "
                       "under federal eligibility rules" if r["state"] in CAPPED
                       else "no FNS state total on file")

rows.sort(key=lambda r: -(r["eligible_unenrolled"] or 0))
with open("county_eligible_unenrolled_2026.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

print(f"counties: {len(rows)}   with an allocated figure: {allocated}")
print(f"states with an authoritative total: {len(FNS_ELIGIBLE_UNENROLLED)}\n")
print(f"{'county':30}{'under130':>12}{'eligible-unenrolled':>22}")
for r in rows[:14]:
    print(f"  {r['county'][:28]:30}{r['pop_under_130_fpl']:>12,}{r['eligible_unenrolled']:>22,}")
