"""A first-contact route for every bank on the roster — named person or not.

The dashboard's first goal is an exhaustive list of institutions AND a best
contact "even if a starting place". Named CRA officers exist for a minority
(17 of 42 when this was written) and no scalable source publishes the rest:
performance evaluations do not name them, and FDIC BankFind carries no phone
field.

What IS authoritative and complete is the institution's main office address, and
the fact that every CRA-covered bank must designate someone responsible for its
public file. So the fallback is a real, addressable route rather than a blank:

    CRA Officer
    <Legal name>
    <Main office address>

That is a starting place in the user's sense -- it reaches a designated role at a
verified address -- and it is marked as a role route, never dressed up as a named
contact. Where a named officer exists it always wins.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1]
ANALYSIS = TOOL.parents[1] / "data-ops/analysis/bank-pe-mining"


def load_cba_officers() -> dict:
    """CRA officers named on the Consumer Bankers Association's Community
    Reinvestment Committee roster, matched to roster records by EXACT token set.

    Substring matching put Citizens Financial Group's head of community
    development against both First-Citizens Bank & Trust and Citizens Business
    Bank -- three unrelated institutions. A wrong name on a letter is worse than
    no name, so only an exact match counts and eight banks whose names are shared
    by unrelated institutions are held back entirely.
    """
    p = ANALYSIS / "roster_officer_matches.json"
    return json.loads(p.read_text()) if p.exists() else {}


def load_named() -> dict:
    p = ANALYSIS / "bank_contacts_2026.csv"
    if not p.exists():
        return {}
    return {r["bank_key"]: r for r in csv.DictReader(p.open())}


def load_addresses() -> dict:
    p = ANALYSIS / "bankfind_addresses.json"
    return json.loads(p.read_text()) if p.exists() else {}


def route_for(bank_key: str, bank: dict, named: dict, addr: dict) -> dict:
    """Best available first-contact route, in three honest tiers.

    An earlier count reported "17 banks with a contact" by counting ROWS in the
    harvest file. Only four of those rows carry a name. Several of the rest carry
    a real channel with no name -- a CRA mailbox, a switchboard, a public-file
    page -- which is a better route than a generic address and a worse one than a
    person. Three tiers, labelled for what they are:

        named    a person, with a channel
        channel  a CRA-specific mailbox, phone or public-file page, no name
        role     CRA Officer at the verified main office address
    """
    n = named.get(bank_key) or {}
    person = (n.get("contact_name") or "").strip()
    channel = (n.get("contact_channel") or "").strip()

    # A CRA officer named on the CBA committee roster outranks a harvested guess.
    cba = load_cba_officers().get(bank_key)
    if cba:
        return {"kind": "named", "name": cba["name"], "title": cba["title"],
                "channel": channel, "address": n.get("address", ""),
                "confidence": "HIGH",
                "source": "Consumer Bankers Association, Community Reinvestment "
                          "Committee roster, retrieved 2026-08-26"}

    if person:
        return {"kind": "named", "name": person, "title": n.get("contact_title", ""),
                "channel": channel, "address": n.get("address", ""),
                "confidence": n.get("confidence", ""), "source": n.get("source", "")}

    if channel and channel.lower() not in ("not published", "none", "-"):
        return {"kind": "channel", "name": "CRA Officer",
                "title": f"no name published; reach the role at this channel",
                "channel": channel, "address": n.get("address", ""),
                "confidence": n.get("confidence", "") or "CHANNEL-ONLY",
                "source": n.get("source", "") or "harvested from the bank's CRA public-file page"}

    a = addr.get(str(bank.get("cert") or ""))
    if a:
        line = ", ".join(x for x in [a.get("ADDRESS"), a.get("CITY"),
                                     f"{a.get('STALP','')} {a.get('ZIP','')}".strip()] if x)
        return {"kind": "role", "name": "CRA Officer",
                "title": f"designated public-file contact, {a.get('NAME', bank.get('name',''))}",
                "channel": a.get("WEBADDR", ""), "address": line,
                "confidence": "ROLE-ROUTE",
                "source": "FDIC BankFind main office address; the CRA public-file contact is a "
                          "role every covered bank must designate (12 CFR __.43)"}

    return {"kind": "none", "name": "", "title": "", "channel": "", "address": "",
            "confidence": "MISSING", "source": ""}


def build(banks: dict) -> dict:
    named, addr = load_named(), load_addresses()
    return {k: route_for(k, v, named, addr) for k, v in banks.items()}


def write_register(banks: dict, out_path: Path) -> dict:
    routes = build(banks)
    rows = []
    for k, b in sorted(banks.items()):
        r = routes[k]
        rows.append({
            "bank_key": k, "bank": b.get("name", ""), "state": b.get("state", ""),
            "ask_usd": b.get("ask_usd", ""), "route": r["kind"],
            "contact": r["name"], "title": r["title"], "channel": r["channel"],
            "address": r["address"], "confidence": r["confidence"], "source": r["source"],
        })
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    from collections import Counter
    return Counter(r["route"] for r in rows)
