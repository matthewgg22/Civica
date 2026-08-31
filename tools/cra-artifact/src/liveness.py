"""Is this bank still a bank?

The FDIC's CRAPES system reports every institution as active. All 18,902 records
in the national sweep carried INST_FIN_ACTV_FLG = "Y", including Signature Bank,
which failed in March 2023. Six closed institutions surfaced while working the
2022-vintage data -- two of them, HomeStreet ($9.3B) and Berkshire ($11.7B),
closed recently enough to look entirely plausible in a pitch list.

So liveness is checked against FDIC BankFind (ACTIVE / ENDEFYMD), never CRAPES,
and the result is STORED on the bank record. The network call lives here; the
enforcement lives in a test that reads the stored answer offline, so CI never
depends on a third-party API being up.

Run:  python3 -m src.liveness            # check every loaded bank, report
      python3 -m src.liveness --write    # ...and record the result
"""
import argparse
import datetime
import json
import urllib.parse
import urllib.request
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
INPUTS = TOOL_ROOT / "inputs" / "assessment_areas.json"

# banks.data.fdic.gov now 301s here; follow the move rather than the redirect.
API = "https://api.fdic.gov/banks/institutions"
FAR_FUTURE = "12/31/9999"   # BankFind's sentinel for "still open"


class DeadInstitutionError(Exception):
    """Raised when a bank we are pitching no longer exists."""


def parse_end_date(value):
    """BankFind writes the sentinel 12/31/9999 rather than null for an open
    institution. Reading it literally would mark every live bank as closed."""
    return None if value in (None, "", FAR_FUTURE) else value


def _get(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": "civica-cra-artifact"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def check_cert(cert, timeout=45):
    """Return {'found','active','end_date','name'} for one FDIC certificate."""
    q = urllib.parse.urlencode({
        "filters": f"CERT:{cert}",
        "fields": "NAME,CERT,ACTIVE,ENDEFYMD",
        "limit": 1,
    })
    rows = _get(f"{API}?{q}", timeout).get("data", [])
    if not rows:
        return {"found": False, "active": False, "end_date": None, "name": None}
    d = rows[0]["data"]
    return {
        "found": True,
        "active": str(d.get("ACTIVE")) == "1",
        "end_date": parse_end_date(d.get("ENDEFYMD")),
        "name": d.get("NAME"),
    }


def check_banks(banks, timeout=45):
    """Check every bank. Returns {key: result}; never raises on a dead bank."""
    out = {}
    for key, bank in banks.items():
        cert = str(bank.get("cert") or "").strip()
        if not cert:
            out[key] = {"found": False, "active": False, "end_date": None,
                        "name": None, "error": "no cert on record"}
            continue
        try:
            out[key] = check_cert(cert, timeout)
        except Exception as exc:                      # network, not data
            out[key] = {"found": None, "active": None, "end_date": None,
                        "name": None, "error": f"{type(exc).__name__}: {exc}"}
    return out


def assert_alive(key, bank):
    """Enforce the STORED answer. Offline -- this is what tests call."""
    if bank.get("active") is not True:
        raise DeadInstitutionError(
            f"{key}: not recorded as an active institution "
            f"(active={bank.get('active')!r}, checked={bank.get('active_checked')!r}). "
            "Run `python3 -m src.liveness --write`.")
    if bank.get("active_end_date"):
        raise DeadInstitutionError(
            f"{key}: closed on {bank['active_end_date']} — remove it from the roster")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true", help="record results on the bank records")
    args = ap.parse_args(argv)

    doc = json.loads(INPUTS.read_text())
    banks = doc["banks"]
    results = check_banks(banks)
    today = datetime.date.today().isoformat()

    dead, errors = [], []
    for key, r in sorted(results.items()):
        if r.get("error"):
            errors.append((key, r["error"])); status = f"ERROR {r['error'][:40]}"
        elif not r["found"]:
            dead.append(key); status = "NOT FOUND in BankFind"
        elif not r["active"]:
            dead.append(key); status = f"CLOSED {r['end_date'] or ''}"
        else:
            status = "active"
        print(f"{key:26} {status}")
        if args.write and not r.get("error"):
            banks[key]["active"] = bool(r["found"] and r["active"])
            banks[key]["active_end_date"] = r["end_date"]
            banks[key]["active_checked"] = today

    if args.write:
        INPUTS.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        print(f"\nrecorded {len(results) - len(errors)} results ({today})")
    if errors:
        print(f"\n{len(errors)} could not be checked (network) — nothing recorded for these")
    if dead:
        print(f"\nDEAD OR MISSING: {', '.join(dead)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
