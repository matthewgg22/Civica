#!/usr/bin/env python3
from __future__ import annotations

"""Review and optionally apply U.S. reps roster updates.

This script compares local app data files against current Congress.gov members:
- WeVote Information Page/Models/USSenators.json
- WeVote Information Page/Models/USHouseMembers.json

Usage:
  python3 scripts/review_reps_updates.py --review
  python3 scripts/review_reps_updates.py --apply

Notes:
- Requires CONGRESS_GOV_API_KEY in environment.
- --apply performs safe updates for matched seats and simple one-to-one Senate swaps.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SENATORS_PATH = REPO_ROOT / "WeVote Information Page/Models/USSenators.json"
HOUSE_PATH = REPO_ROOT / "WeVote Information Page/Models/USHouseMembers.json"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.civic_api.congress_client import CongressGovClient

DELEGATE_CODES = {"AS", "DC", "GU", "MP", "VI"}
SUPPORTED_CHAMBERS = {"senate", "house"}


@dataclass(frozen=True)
class SourceMember:
    chamber: str
    state_code: str
    district_key: str | None
    name: str
    party: str | None
    phone: str | None
    website: str | None
    contact_form: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Review/apply reps roster updates from Congress.gov")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--review", action="store_true", help="Only review and print changes (default)")
    mode.add_argument("--apply", action="store_true", help="Apply safe updates to local JSON files")
    parser.add_argument("--congress", type=int, default=119, help="Congress number to query (default: 119)")
    parser.add_argument(
        "--report-file",
        type=Path,
        default=None,
        help="Optional path for markdown report output",
    )
    return parser.parse_args()


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} expected JSON array")
    return data


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
        f.write("\n")


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def canonical_person_name(name: str) -> str:
    value = normalize_space(name)
    if "," in value:
        last, first = [normalize_space(token) for token in value.split(",", 1)]
        value = normalize_space(f"{first} {last}")
    value = value.lower()
    value = re.sub(r"[^a-z0-9 ]+", " ", value)
    value = normalize_space(value)
    return value


def raw_name_from_full_name(name: str) -> str:
    parts = [token for token in normalize_space(name).split(" ") if token]
    if len(parts) < 2:
        return name
    last = parts[-1]
    first = " ".join(parts[:-1])
    return f"{last}, {first}"


def house_display_name_from_full_name(name: str) -> str:
    return raw_name_from_full_name(name)


def normalized_party_code(party: str | None) -> str | None:
    if not party:
        return None
    lower = party.lower()
    if lower.startswith("democrat"):
        return "D"
    if lower.startswith("republic"):
        return "R"
    if "independent" in lower:
        return "I"
    if "libertarian" in lower:
        return "L"
    return party[:1].upper()


def normalized_contact_url(url: str | None) -> str | None:
    if not url:
        return None
    normalized = url.strip()
    if not normalized:
        return None
    return normalized.rstrip("/")


def normalize_district_key(state_code: str, district: Any) -> str:
    raw = "" if district is None else normalize_space(str(district))
    lower = raw.lower()

    if not raw or lower in {"at large", "at-large", "al"}:
        if state_code == "PR":
            return "resident_commissioner"
        if state_code in DELEGATE_CODES:
            return "delegate"
        return "at_large"

    if "resident" in lower:
        return "resident_commissioner"
    if "delegate" in lower:
        return "delegate"

    digits = re.sub(r"[^0-9]", "", raw)
    if digits:
        number = int(digits)
        if number == 0:
            if state_code == "PR":
                return "resident_commissioner"
            if state_code in DELEGATE_CODES:
                return "delegate"
            return "at_large"
        return str(number)

    return lower.replace(" ", "_")


def sort_house_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def key_for(row: dict[str, Any]) -> tuple[str, int, str]:
        state = str(row.get("state_code") or "")
        district_key = str(row.get("district_key") or "")
        if district_key.isdigit():
            return (state, 0, f"{int(district_key):03d}")
        special_rank = {"at_large": 1, "delegate": 2, "resident_commissioner": 3}.get(district_key, 4)
        return (state, special_rank, district_key)

    return sorted(rows, key=key_for)


def sort_senator_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def key_for(row: dict[str, Any]) -> tuple[str, str, str]:
        state = str(row.get("state_code") or "")
        senate_class = str(row.get("senate_class") or "")
        name = canonical_person_name(str(row.get("name") or ""))
        return (state, senate_class, name)

    return sorted(rows, key=key_for)


def fetch_source_members(states: set[str], congress: int) -> list[SourceMember]:
    client = CongressGovClient()
    if not client.is_configured:
        raise RuntimeError("CONGRESS_GOV_API_KEY is not set. Export it before running this script.")

    profiles = client.getMembersByCongress(congress=congress, currentMember=True)
    members: list[SourceMember] = []

    for profile in profiles:
        chamber = (profile.chamber or "").strip().lower()
        state_code = (profile.state or "").strip().upper()
        if chamber not in SUPPORTED_CHAMBERS:
            continue
        if state_code not in states:
            continue

        district_key: str | None = None
        if chamber == "house":
            district_key = normalize_district_key(state_code, profile.district)

        members.append(
            SourceMember(
                chamber=chamber,
                state_code=state_code,
                district_key=district_key,
                name=normalize_space(profile.name or ""),
                party=normalize_space(profile.party or "") or None,
                phone=normalize_space(profile.phone or "") or None,
                website=normalized_contact_url(profile.website),
                contact_form=normalized_contact_url(profile.contact_form),
            )
        )

    return members


def review_and_optionally_apply(
    senators: list[dict[str, Any]],
    house: list[dict[str, Any]],
    source_members: list[SourceMember],
    apply_updates: bool,
) -> tuple[list[str], bool]:
    report: list[str] = []
    has_changes = False

    source_senators_by_state: dict[str, list[SourceMember]] = defaultdict(list)
    source_house_by_key: dict[tuple[str, str], SourceMember] = {}

    for member in source_members:
        if member.chamber == "senate":
            source_senators_by_state[member.state_code].append(member)
        elif member.chamber == "house" and member.district_key:
            source_house_by_key[(member.state_code, member.district_key)] = member

    report.append("## Senators")
    senators_by_state: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in senators:
        senators_by_state[str(row.get("state_code") or "").upper()].append(row)

    for state_code in sorted(set(senators_by_state.keys()) | set(source_senators_by_state.keys())):
        local_rows = senators_by_state.get(state_code, [])
        source_rows = source_senators_by_state.get(state_code, [])
        source_by_name = {canonical_person_name(item.name): item for item in source_rows}

        unmatched_local: list[dict[str, Any]] = []
        unmatched_source: list[SourceMember] = []

        for local in local_rows:
            local_name = canonical_person_name(str(local.get("name") or ""))
            source = source_by_name.get(local_name)
            if source is None:
                unmatched_local.append(local)
                continue

            changed_fields: list[str] = []
            if source.party and local.get("party") != source.party:
                changed_fields.append(f"party: '{local.get('party')}' -> '{source.party}'")
                if apply_updates:
                    local["party"] = source.party
            if source.website and normalized_contact_url(local.get("url")) != source.website:
                changed_fields.append(f"url: '{local.get('url')}' -> '{source.website}'")
                if apply_updates:
                    local["url"] = source.website + "/"
            if source.phone and normalize_space(str(local.get("phone") or "")) != source.phone:
                changed_fields.append(f"phone: '{local.get('phone')}' -> '{source.phone}'")
                if apply_updates:
                    local["phone"] = source.phone
            if source.contact_form and normalized_contact_url(local.get("contact_form_url")) != source.contact_form:
                changed_fields.append(f"contact_form_url: '{local.get('contact_form_url')}' -> '{source.contact_form}'")
                if apply_updates:
                    local["contact_form_url"] = source.contact_form + "/"

            if changed_fields:
                has_changes = True
                report.append(f"- {state_code}: Updated matched senator {source.name}")
                for field_line in changed_fields:
                    report.append(f"  - {field_line}")

        local_names = {canonical_person_name(str(item.get("name") or "")) for item in local_rows}
        for source in source_rows:
            if canonical_person_name(source.name) not in local_names:
                unmatched_source.append(source)

        if unmatched_local or unmatched_source:
            has_changes = True
            if apply_updates and len(unmatched_local) == 1 and len(unmatched_source) == 1:
                old_row = unmatched_local[0]
                new_member = unmatched_source[0]
                old_name = str(old_row.get("name") or "")
                old_row["name"] = new_member.name
                old_row["raw_name"] = raw_name_from_full_name(new_member.name)
                if new_member.party:
                    old_row["party"] = new_member.party
                if new_member.website:
                    old_row["url"] = new_member.website + "/"
                if new_member.phone:
                    old_row["phone"] = new_member.phone
                if new_member.contact_form:
                    old_row["contact_form_url"] = new_member.contact_form + "/"
                report.append(f"- {state_code}: Replaced senator '{old_name}' -> '{new_member.name}'")
            else:
                if unmatched_local:
                    local_names_only = ", ".join(str(item.get("name") or "") for item in unmatched_local)
                    report.append(f"- {state_code}: Local-only senators: {local_names_only}")
                if unmatched_source:
                    source_names_only = ", ".join(item.name for item in unmatched_source)
                    report.append(f"- {state_code}: Source-only senators: {source_names_only}")

    report.append("")
    report.append("## House")

    local_house_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in house:
        state_code = str(row.get("state_code") or "").upper()
        district_key = str(row.get("district_key") or "")
        local_house_by_key[(state_code, district_key)] = row

    all_house_keys = sorted(set(local_house_by_key.keys()) | set(source_house_by_key.keys()))
    for key in all_house_keys:
        local = local_house_by_key.get(key)
        source = source_house_by_key.get(key)
        state_code, district_key = key
        label = f"{state_code}-{district_key}"

        if local is None and source is not None:
            has_changes = True
            report.append(f"- {label}: Source-only seat/member: {source.name}")
            if apply_updates:
                party_code = normalized_party_code(source.party)
                house.append(
                    {
                        "state_code": state_code,
                        "state_name": state_code,
                        "district": district_key if district_key.isdigit() else district_key.replace("_", " "),
                        "district_key": district_key,
                        "name": house_display_name_from_full_name(source.name),
                        "party": source.party or "",
                        "party_code": party_code or "",
                        "office_room": "",
                        "phone": source.phone or "",
                        "committee_assignment": "",
                        "vacancy_flagged": False,
                        "url": (source.website + "/") if source.website else "",
                        "contact_form_url": (source.contact_form + "/") if source.contact_form else "",
                    }
                )
            continue

        if local is not None and source is None:
            has_changes = True
            report.append(f"- {label}: Local-only seat/member: {local.get('name')}")
            continue

        assert local is not None and source is not None

        changed_fields: list[str] = []

        expected_name = house_display_name_from_full_name(source.name)
        if canonical_person_name(str(local.get("name") or "")) != canonical_person_name(expected_name):
            changed_fields.append(f"name: '{local.get('name')}' -> '{expected_name}'")
            if apply_updates:
                local["name"] = expected_name

        if source.party and local.get("party") != source.party:
            changed_fields.append(f"party: '{local.get('party')}' -> '{source.party}'")
            if apply_updates:
                local["party"] = source.party
            party_code = normalized_party_code(source.party)
            if party_code and local.get("party_code") != party_code:
                changed_fields.append(f"party_code: '{local.get('party_code')}' -> '{party_code}'")
                if apply_updates:
                    local["party_code"] = party_code

        if source.phone and normalize_space(str(local.get("phone") or "")) != source.phone:
            changed_fields.append(f"phone: '{local.get('phone')}' -> '{source.phone}'")
            if apply_updates:
                local["phone"] = source.phone

        if source.website and normalized_contact_url(local.get("url")) != source.website:
            changed_fields.append(f"url: '{local.get('url')}' -> '{source.website}'")
            if apply_updates:
                local["url"] = source.website + "/"

        if source.contact_form and normalized_contact_url(local.get("contact_form_url")) != source.contact_form:
            changed_fields.append(f"contact_form_url: '{local.get('contact_form_url')}' -> '{source.contact_form}'")
            if apply_updates:
                local["contact_form_url"] = source.contact_form + "/"

        if changed_fields:
            has_changes = True
            report.append(f"- {label}: Updated {source.name}")
            for field_line in changed_fields:
                report.append(f"  - {field_line}")

    if not has_changes:
        report.append("- No differences detected.")

    return report, has_changes


def main() -> int:
    args = parse_args()
    apply_updates = bool(args.apply)

    if not SENATORS_PATH.exists() or not HOUSE_PATH.exists():
        print("Expected reps JSON files were not found. Run from repo root.")
        return 2

    senators = load_json(SENATORS_PATH)
    house = load_json(HOUSE_PATH)

    states = {
        str(item.get("state_code") or "").upper()
        for item in senators + house
        if str(item.get("state_code") or "").strip()
    }

    try:
        source_members = fetch_source_members(states=states, congress=args.congress)
    except Exception as exc:
        print(f"Failed to fetch Congress source data: {exc}")
        if "CONGRESS_GOV_API_KEY" not in os.environ:
            print("Hint: export CONGRESS_GOV_API_KEY first.")
        return 2

    report_lines, has_changes = review_and_optionally_apply(
        senators=senators,
        house=house,
        source_members=source_members,
        apply_updates=apply_updates,
    )

    if apply_updates and has_changes:
        write_json(SENATORS_PATH, sort_senator_rows(senators))
        write_json(HOUSE_PATH, sort_house_rows(house))

    report_text = "\n".join(report_lines).strip() + "\n"
    if args.report_file:
        args.report_file.parent.mkdir(parents=True, exist_ok=True)
        args.report_file.write_text(report_text, encoding="utf-8")

    print(report_text)

    if has_changes:
        print("Differences found.")
        if not apply_updates:
            print("Run with --apply to auto-apply safe updates.")
        return 1

    print("No updates required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
