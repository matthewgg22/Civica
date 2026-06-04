#!/usr/bin/env python3
"""Pull Census SAIPE county poverty + median household income for California.

The SAIPE timeseries API is keyless for small calls, so no key is required for a
single-year, all-CA-counties request. This script loops a year range and writes
a tidy CA county x year CSV (the control layer for Civica's county-level error
regressions).

Stdlib only (urllib) so it runs under the task venv or any python3 without pip.

Usage:
    python pull_saipe_ca.py --years 2015-2024 --out ca_county_poverty_saipe.csv
    python pull_saipe_ca.py --years 2022                       # single year -> stdout-safe CSV

If a large loop ever returns HTTP 429, get a free key at
https://api.census.gov/data/key_signup.html and pass --key YOUR_KEY.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request

API = "https://api.census.gov/data/timeseries/poverty/saipe"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
# state=06 is California. Variables: poverty rate (all ages) + count + median HH income, each with MOE.
GET_VARS = [
    "NAME",
    "SAEPOVRTALL_PT",
    "SAEPOVRTALL_MOE",
    "SAEPOVALL_PT",
    "SAEMHI_PT",
    "SAEMHI_MOE",
]


def parse_year_range(spec: str) -> list[int]:
    spec = spec.strip()
    if "-" in spec:
        lo, hi = spec.split("-", 1)
        return list(range(int(lo), int(hi) + 1))
    return [int(spec)]


def fetch_year(year: int, key: str | None) -> list[list[str]]:
    params = {
        "get": ",".join(GET_VARS),
        "for": "county:*",
        "in": "state:06",
        "time": str(year),
    }
    if key:
        params["key"] = key
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (trusted gov host)
        body = resp.read().decode("utf-8")
    data = json.loads(body)  # [[header...],[row...],...]
    if not data or not isinstance(data, list):
        raise RuntimeError(f"unexpected SAIPE response for {year}: {body[:200]!r}")
    return data


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--years", default="2015-2024", help="single year or LO-HI range")
    ap.add_argument("--out", default="ca_county_poverty_saipe.csv")
    ap.add_argument("--key", default=None, help="optional Census API key (only for large loops)")
    ap.add_argument("--sleep", type=float, default=0.3, help="seconds between year calls")
    args = ap.parse_args()

    years = parse_year_range(args.years)
    out_header = [*GET_VARS, "state", "county", "year"]
    rows: list[list[str]] = []

    for yr in years:
        payload = fetch_year(yr, args.key)
        header, *body = payload
        idx = {name: header.index(name) for name in header}
        for r in body:
            rows.append(
                [r[idx[v]] for v in GET_VARS]
                + [r[idx["state"]], r[idx["county"]], str(yr)]
            )
        print(f"SAIPE {yr}: {len(body)} CA counties", file=sys.stderr)
        time.sleep(args.sleep)

    with open(args.out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(out_header)
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
