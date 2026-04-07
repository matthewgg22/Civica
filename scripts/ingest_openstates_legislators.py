#!/usr/bin/env python3
from __future__ import annotations

"""Ingest current state legislators from Open States people repo.

Source of truth:
  https://github.com/openstates/people

Scope:
- Includes only people files in data/{state}/legislature/*.yml.
- Excludes federal (data/us/legislature/*).
- Filters to active legislative roles as-of a given date.

Output:
- Writes normalized JSON array for downstream upsert into Supabase.
"""

import argparse
import io
import json
import re
import tarfile
import urllib.request
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import yaml

DEFAULT_SOURCE_URL = "https://github.com/openstates/people/archive/refs/heads/main.tar.gz"
DEFAULT_OUT_PATH = Path("data/derived/openstates_state_legislators_current.json")
DEFAULT_CACHE_PATH = Path("data/source/openstates/people-main.tar.gz")

STATE_CODES = {
    "al",
    "ak",
    "az",
    "ar",
    "ca",
    "co",
    "ct",
    "de",
    "fl",
    "ga",
    "hi",
    "id",
    "il",
    "in",
    "ia",
    "ks",
    "ky",
    "la",
    "me",
    "md",
    "ma",
    "mi",
    "mn",
    "ms",
    "mo",
    "mt",
    "ne",
    "nv",
    "nh",
    "nj",
    "nm",
    "ny",
    "nc",
    "nd",
    "oh",
    "ok",
    "or",
    "pa",
    "ri",
    "sc",
    "sd",
    "tn",
    "tx",
    "ut",
    "vt",
    "va",
    "wa",
    "wv",
    "wi",
    "wy",
    "dc",
}

TERRITORY_CODES = {"pr", "gu", "vi", "as", "mp"}
LEGISLATIVE_ROLE_TYPES = {"upper", "lower", "legislature"}

LOWER_CHAMBER_FALLBACK_TITLES = {
    "ak": "Representative",
    "al": "Representative",
    "ar": "Representative",
    "az": "Representative",
    "ca": "Assemblymember",
    "co": "Representative",
    "ct": "Representative",
    "dc": "Councilmember",
    "de": "Representative",
    "fl": "Representative",
    "ga": "Representative",
    "hi": "Representative",
    "ia": "Representative",
    "id": "Representative",
    "il": "Representative",
    "in": "Representative",
    "ks": "Representative",
    "ky": "Representative",
    "la": "Representative",
    "ma": "Representative",
    "md": "Delegate",
    "me": "Representative",
    "mi": "Representative",
    "mn": "Representative",
    "mo": "Representative",
    "ms": "Representative",
    "mt": "Representative",
    "nc": "Representative",
    "nd": "Representative",
    "ne": "Senator",
    "nh": "Representative",
    "nj": "Assemblymember",
    "nm": "Representative",
    "nv": "Assemblymember",
    "ny": "Assemblymember",
    "oh": "Representative",
    "ok": "Representative",
    "or": "Representative",
    "pa": "Representative",
    "pr": "Representative",
    "ri": "Representative",
    "sc": "Representative",
    "sd": "Representative",
    "tn": "Representative",
    "tx": "Representative",
    "ut": "Representative",
    "va": "Delegate",
    "vt": "Representative",
    "wa": "Representative",
    "wi": "Representative",
    "wv": "Delegate",
    "wy": "Representative",
}

UPPER_CHAMBER_FALLBACK_TITLE = "Senator"
UNICAMERAL_FALLBACK_TITLE = "Senator"


@dataclass(frozen=True)
class Config:
    source_url: str
    source_tar: Path
    out_path: Path
    as_of: date
    states: set[str]
    no_download: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest current state legislators from Open States")
    parser.add_argument(
        "--source-url",
        default=DEFAULT_SOURCE_URL,
        help=f"Source tarball URL (default: {DEFAULT_SOURCE_URL})",
    )
    parser.add_argument(
        "--source-tar",
        type=Path,
        default=DEFAULT_CACHE_PATH,
        help=f"Local tarball cache path (default: {DEFAULT_CACHE_PATH})",
    )
    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Require --source-tar to already exist; do not fetch from network",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT_PATH,
        help=f"Output JSON path (default: {DEFAULT_OUT_PATH})",
    )
    parser.add_argument(
        "--as-of",
        type=str,
        default=date.today().isoformat(),
        help="Date for current-role filtering in YYYY-MM-DD (default: today)",
    )
    parser.add_argument(
        "--state",
        action="append",
        default=[],
        help="State code filter (repeatable). Example: --state CA --state NY",
    )
    parser.add_argument(
        "--include-territories",
        action="store_true",
        help="Include PR/GU/VI/AS/MP in addition to 50 states + DC",
    )
    return parser.parse_args()


def parse_iso_date(value: str | date | None) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    raw = value.strip()
    if not raw:
        return None

    parts = raw.split("-")
    try:
        if len(parts) == 1:
            return date(int(parts[0]), 1, 1)
        if len(parts) == 2:
            return date(int(parts[0]), int(parts[1]), 1)
        return date.fromisoformat(raw)
    except ValueError:
        return None


def normalize_whitespace(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    value = normalize_whitespace(url)
    if not value:
        return None
    return value.rstrip("/")


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    phone = normalize_whitespace(value)
    if not phone:
        return None
    phone = re.sub(r"\s+", " ", phone)
    return phone


def party_name_for_as_of(parties: Any, as_of: date) -> str | None:
    if not isinstance(parties, list):
        return None

    # First pass: pick an active/current party entry.
    for entry in parties:
        if not isinstance(entry, dict):
            continue
        name = normalize_whitespace(entry.get("name"))
        if not name:
            continue
        end_date = parse_iso_date(entry.get("end_date"))
        start_date = parse_iso_date(entry.get("start_date"))
        if start_date and start_date > as_of:
            continue
        if end_date and end_date < as_of:
            continue
        return name

    # Fallback: first named party entry.
    for entry in parties:
        if isinstance(entry, dict):
            name = normalize_whitespace(entry.get("name"))
            if name:
                return name

    return None


def website_from_links(links: Any) -> str | None:
    if not isinstance(links, list):
        return None

    candidates: list[tuple[int, str]] = []
    for link in links:
        if not isinstance(link, dict):
            continue
        url = normalize_url(link.get("url"))
        if not url:
            continue

        note = normalize_whitespace(link.get("note")).lower()
        score = 0
        if ".gov" in url:
            score += 50
        if "homepage" in note:
            score += 35
        if "official" in note:
            score += 25
        if "legislature" in note:
            score += 20
        if "campaign" in note:
            score -= 30
        if "facebook.com" in url or "x.com" in url or "twitter.com" in url:
            score -= 20

        candidates.append((score, url))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][1]


def best_phone_from_offices(offices: Any) -> str | None:
    if not isinstance(offices, list):
        return None

    candidates: list[tuple[int, str]] = []

    for office in offices:
        if not isinstance(office, dict):
            continue

        classification = normalize_whitespace(office.get("classification")).lower()
        office_name = normalize_whitespace(office.get("name")).lower()

        voice = office.get("voice")
        voices: list[str] = []
        if isinstance(voice, str):
            voices = [voice]
        elif isinstance(voice, list):
            voices = [v for v in voice if isinstance(v, str)]

        for item in voices:
            phone = normalize_phone(item)
            if not phone:
                continue

            score = 0
            if classification == "capitol":
                score += 100
            elif classification in {"district", "office"}:
                score += 50

            if "capitol" in office_name or "state house" in office_name:
                score += 30

            if re.search(r"\d", phone):
                score += 10

            candidates.append((score, phone))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][1]


def chamber_from_role_type(role_type: str) -> str:
    # We keep source compatibility with Open States role types.
    if role_type in LEGISLATIVE_ROLE_TYPES:
        return role_type
    return "lower"


def fallback_title(state: str, chamber: str) -> str:
    if chamber == "upper":
        return UPPER_CHAMBER_FALLBACK_TITLE
    if chamber == "legislature":
        return UNICAMERAL_FALLBACK_TITLE
    return LOWER_CHAMBER_FALLBACK_TITLES.get(state, "Representative")


def district_text(role: dict[str, Any]) -> str:
    value = normalize_whitespace(role.get("district"))
    return value or "Unknown"


def slugify_fragment(value: str) -> str:
    lowered = value.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug or "unknown"


def role_is_current(role: dict[str, Any], as_of: date) -> bool:
    role_type = normalize_whitespace(role.get("type")).lower()
    if role_type not in LEGISLATIVE_ROLE_TYPES:
        return False

    current_flag = role.get("current")
    if current_flag is False:
        return False

    start_date = parse_iso_date(role.get("start_date"))
    end_date = parse_iso_date(role.get("end_date"))

    if start_date and start_date > as_of:
        return False
    if end_date and end_date < as_of:
        return False
    return True


def jurisdiction_code_from_ocd(value: str) -> str | None:
    lowered = normalize_whitespace(value).lower()
    if not lowered:
        return None

    # Typical Open Civic Data IDs:
    # - ocd-jurisdiction/country:us/state:ca/government
    # - ocd-jurisdiction/country:us/district:dc/government
    state_match = re.search(r"state:([a-z]{2})", lowered)
    if state_match:
        return state_match.group(1)

    district_match = re.search(r"district:([a-z]{2})", lowered)
    if district_match:
        return district_match.group(1)

    territory_match = re.search(r"territory:([a-z]{2})", lowered)
    if territory_match:
        return territory_match.group(1)

    return None


def should_include_jurisdiction(state: str, configured_states: set[str]) -> bool:
    return state in configured_states


def build_config(args: argparse.Namespace) -> Config:
    as_of = date.fromisoformat(args.as_of)

    base_states = set(STATE_CODES)
    if args.include_territories:
        base_states |= TERRITORY_CODES

    if args.state:
        selected = {code.strip().lower() for code in args.state if code.strip()}
        unknown = sorted(selected - (base_states | TERRITORY_CODES | {"us"}))
        if unknown:
            raise ValueError(f"Unknown state code(s): {', '.join(unknown)}")
        states = selected
    else:
        states = base_states

    return Config(
        source_url=args.source_url,
        source_tar=args.source_tar,
        out_path=args.out,
        as_of=as_of,
        states=states,
        no_download=args.no_download,
    )


def download_if_needed(config: Config) -> bytes:
    if config.source_tar.exists():
        return config.source_tar.read_bytes()

    if config.no_download:
        raise FileNotFoundError(
            f"{config.source_tar} not found and --no-download was set"
        )

    config.source_tar.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(config.source_url) as response:
        payload = response.read()
    config.source_tar.write_bytes(payload)
    return payload


def iter_legislature_files(tar_data: bytes) -> list[tuple[str, str, bytes]]:
    pattern = re.compile(r"^[^/]+/data/([a-z]{2}|us)/legislature/[^/]+\.yml$")
    found: list[tuple[str, str, bytes]] = []

    with tarfile.open(fileobj=io.BytesIO(tar_data), mode="r:gz") as archive:
        for member in archive:
            if not member.isfile():
                continue
            match = pattern.match(member.name)
            if not match:
                continue

            jurisdiction = match.group(1)
            extracted = archive.extractfile(member)
            if extracted is None:
                continue
            found.append((jurisdiction, member.name, extracted.read()))

    return found


def normalize_record(
    person: dict[str, Any],
    role: dict[str, Any],
    state: str,
    source_file: str,
    as_of: date,
) -> dict[str, Any] | None:
    person_id = normalize_whitespace(person.get("id"))
    name = normalize_whitespace(person.get("name"))
    if not person_id or not name:
        return None

    role_type = normalize_whitespace(role.get("type")).lower()
    chamber = chamber_from_role_type(role_type)
    district = district_text(role)

    role_title = normalize_whitespace(role.get("title"))
    title = role_title or fallback_title(state, chamber)

    party = party_name_for_as_of(person.get("party"), as_of)
    website = website_from_links(person.get("links"))
    phone = best_phone_from_offices(person.get("offices"))

    district_key = slugify_fragment(district)
    seat_key = f"{state}:{chamber}:{district_key}"
    legislator_key = f"{person_id}:{state}:{chamber}:{district_key}"

    return {
        "legislator_key": legislator_key,
        "source_person_id": person_id,
        "seat_key": seat_key,
        "state": state.upper(),
        "chamber": chamber,
        "district": district,
        "name": name,
        "title": title,
        "party": party,
        "website": website,
        "phone": phone,
        "source_file": source_file,
    }


def run(config: Config) -> dict[str, Any]:
    tar_data = download_if_needed(config)
    files = iter_legislature_files(tar_data)

    rows: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    skipped_duplicates = 0

    for jurisdiction, source_file, raw in files:
        if jurisdiction == "us":
            continue
        if not should_include_jurisdiction(jurisdiction, config.states):
            continue

        person = yaml.safe_load(raw)
        if not isinstance(person, dict):
            continue

        roles = person.get("roles")
        if not isinstance(roles, list):
            continue

        for role in roles:
            if not isinstance(role, dict):
                continue

            if not role_is_current(role, config.as_of):
                continue

            role_jurisdiction = normalize_whitespace(role.get("jurisdiction"))
            jurisdiction_from_role = jurisdiction_code_from_ocd(role_jurisdiction)
            if jurisdiction_from_role and jurisdiction_from_role != jurisdiction:
                continue

            normalized = normalize_record(person, role, jurisdiction, source_file, config.as_of)
            if not normalized:
                continue

            key = normalized["legislator_key"]
            if key in seen_keys:
                skipped_duplicates += 1
                continue

            seen_keys.add(key)
            rows.append(normalized)

    rows.sort(key=lambda row: (row["state"], row["chamber"], row["district"], row["name"]))

    config.out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "source_url": config.source_url,
            "source_tar": str(config.source_tar),
            "as_of": config.as_of.isoformat(),
            "record_count": len(rows),
            "states_included": sorted(config.states),
            "skipped_duplicate_roles": skipped_duplicates,
        },
        "rows": rows,
    }

    config.out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    per_state: dict[str, int] = {}
    for row in rows:
        per_state[row["state"]] = per_state.get(row["state"], 0) + 1

    return {
        "output": str(config.out_path),
        "records": len(rows),
        "states": len(per_state),
        "per_state": per_state,
        "duplicates_skipped": skipped_duplicates,
    }


def main() -> None:
    args = parse_args()
    config = build_config(args)
    summary = run(config)

    print(f"Wrote {summary['records']} records to {summary['output']}")
    print(f"Included states/jurisdictions: {summary['states']}")
    print(f"Skipped duplicate active roles: {summary['duplicates_skipped']}")


if __name__ == "__main__":
    main()
