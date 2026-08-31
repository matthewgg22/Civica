"""Enumerate the OCC CRA universe.

This closes what the board called a "permanent blind spot". The OCC does publish
a searchable database -- apps.occ.gov/crasearch -- backed by a public JSON API at
Occ.DataServices.WebApi.Public/api/CraEvaluations. What made it look absent is
that the UI's own default, rating="all", returns ZERO rows; only a specific
rating value returns anything, so every casual probe came back empty.

Partition by state x rating, because state=all caps out.
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

API = ("https://apps.occ.gov/Occ.DataServices.WebApi.Public/api/CraEvaluations"
       "/Search/Options")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
RATINGS = ["Outstanding", "Satisfactory", "Needs to Improve", "Substantial Noncompliance"]

states = json.loads(subprocess.run(
    ["curl","-sS","--max-time","40","-A",UA,"-H","Accept: application/json",
     "https://apps.occ.gov/Occ.DataServices.WebApi.Public/api/CraEvaluations/Retrieve/States"],
    capture_output=True, text=True).stdout)
STATES = [s["State"] for s in states]

def q(job):
    st, rating = job
    body = json.dumps({"q":"","rating":rating,"state":st,
                       "eFromDate":"","eToDate":"","pFromDate":"","pToDate":""})
    p = subprocess.run(["curl","-sS","--max-time","70","-A",UA,
        "-H","Accept: application/json","-H","Content-Type: application/json",
        "-X","POST",API,"-d",body], capture_output=True, text=True)
    try:
        rows = json.loads(p.stdout)
        return job, rows if isinstance(rows, list) else []
    except Exception:
        return job, []

jobs = [(s, r) for s in STATES for r in RATINGS]
seen = {}
with ThreadPoolExecutor(max_workers=6) as ex:
    for (st, rating), rows in ex.map(q, jobs):
        for r in rows:
            seen[(r.get("Charter"), r.get("eDte"))] = r
        if rows:
            print(f"  {st:26} {rating:26} {len(rows):>4}", file=sys.stderr)

json.dump(list(seen.values()), open("occ_all_pes.json","w"))
charters = {r["Charter"] for r in seen.values()}
print(f"\nOCC evaluations: {len(seen):,}   distinct charters: {len(charters):,}")
