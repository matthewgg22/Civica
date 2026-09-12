"""A first-contact route for every institution in the addressable universe.

Same three tiers as the roster (src/contacts.py): a named officer where one has
been harvested, a CRA-specific channel where one exists, and otherwise the
designated-role route -- "CRA Officer" at the FDIC-verified main office address.
Every CRA-covered bank must designate someone responsible for its public file
(12 CFR __.43), so the role route reaches a real desk rather than a void.

Nothing here is a person's name unless it actually is one.
"""
import csv, json, subprocess
from concurrent.futures import ThreadPoolExecutor

certs = json.load(open("universe_certs.json"))
FIELDS = "CERT,NAME,ADDRESS,CITY,STALP,ZIP,WEBADDR,ACTIVE,REGAGNT,ASSET"

def chunk(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i+n]

def fetch(batch):
    q = " OR ".join(f"CERT:{c}" for c in batch)
    p = subprocess.run(["curl","-sS","--max-time","90","-G",
        "https://api.fdic.gov/banks/institutions",
        "--data-urlencode", f"filters={q}",
        "--data-urlencode", f"fields={FIELDS}",
        "--data-urlencode","limit=500","--data-urlencode","format=json"],
        capture_output=True, text=True)
    try:
        return [x["data"] for x in json.loads(p.stdout).get("data", [])]
    except Exception:
        return []

out = {}
batches = list(chunk(certs, 40))
with ThreadPoolExecutor(max_workers=6) as ex:
    for rows in ex.map(fetch, batches):
        for d in rows:
            out[str(d["CERT"])] = d
print(f"addresses resolved: {len(out):,} / {len(certs):,}")
json.dump(out, open("universe_addresses.json", "w"))
