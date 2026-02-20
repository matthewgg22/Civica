#!/usr/bin/env python3
import argparse
import csv
import json
import re
import uuid
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

STATE_NAME_TO_CODE = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
    "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
    "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    "District of Columbia": "DC", "American Samoa": "AS", "Guam": "GU", "Northern Mariana Islands": "MP",
    "Puerto Rico": "PR", "Virgin Islands": "VI", "U.S. Virgin Islands": "VI",
}

CODE_TO_STATE_NAME = {v: k for k, v in STATE_NAME_TO_CODE.items()}

CONVENTION_PATTERNS = [
    "convention",
    "party convention",
    "minor party convention",
    "state convention",
    "county convention",
    "district convention",
]

SOURCE_NAME = "Ballotpedia Elections Calendar"
SOURCE_URL = "https://ballotpedia.org/Elections_calendar"
VERIFICATION_NOTE_BASE = "Source: Ballotpedia calendar — requires confirmation with official state source"


def normalize_key(k: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (k or "").strip().lower())


def parse_date_to_iso(value: str):
    text = (value or "").strip()
    if not text:
        return None

    fmts = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%B %d, %Y",
        "%b %d, %Y",
    ]
    for fmt in fmts:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def state_to_code(value: str):
    text = (value or "").strip()
    if not text:
        return ""
    if len(text) == 2 and text.upper() in CODE_TO_STATE_NAME:
        return text.upper()
    return STATE_NAME_TO_CODE.get(text, "")


def load_raw_rows(path: Path):
    ext = path.suffix.lower()
    rows = []

    if ext in {".csv", ".tsv"}:
        delim = "\t" if ext == ".tsv" else ","
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f, delimiter=delim)
            for r in reader:
                rows.append(r)
    elif ext == ".json":
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                rows.extend([r for r in data if isinstance(r, dict)])
            else:
                raise ValueError("JSON input must be a list of objects")
    else:
        raise ValueError(f"Unsupported input extension: {ext}")

    return rows


def normalize_raw_row(raw: dict):
    keymap = {normalize_key(k): k for k in raw.keys()}

    def get(*keys):
        for k in keys:
            real = keymap.get(normalize_key(k))
            if real is not None:
                return raw.get(real)
        return ""

    return {
        "State": (get("State", "state", "state_name", "statecode") or "").strip(),
        "District": (get("District", "district", "jurisdiction_name") or "").strip(),
        "Description": (get("Description", "description", "office_or_issue") or "").strip(),
        "Date": (get("Date", "date", "election_date") or "").strip(),
    }


def contains_any(text: str, patterns):
    lower = text.lower()
    return any(p in lower for p in patterns)


def is_specific_local_row(state: str, district: str, description: str):
    dl = district.lower()
    sl = state.lower()
    desc = description.lower()

    if any(t in dl or t in desc for t in ["county", "city", "town", "village", "school district", "public schools", "board", "ward"]):
        return True
    if district and dl != sl and "statewide" not in dl:
        return True
    return False


def is_vague_statewide_description(description: str):
    d = re.sub(r"\s+", " ", description.strip().lower())
    vague_set = {
        "general election",
        "primary election",
        "statewide general election",
        "statewide primary election",
    }
    if d in vague_set:
        return True
    return bool(re.fullmatch(r"([a-z\. ]+ )?(general|primary) election", d))


def classify_jurisdiction_level(state_name: str, district: str, description: str):
    dl = district.lower()
    desc = description.lower()
    sl = state_name.lower()

    if "recall" in desc:
        return "recall"
    if "ballot measure" in desc:
        return "ballot_measure"
    if "u.s. house" in desc:
        return "federal_district"
    if "house of representatives district" in desc or "state senate district" in desc or "state house district" in desc:
        return "state_legislative_district"
    if "supreme court" in desc or "appellate court" in desc or "court of appeals" in desc:
        return "judicial_district"
    if "school district" in dl or "school district" in desc or "public schools" in dl or "public schools" in desc:
        return "school_district"
    if "county" in dl or "county" in desc:
        return "county"
    if "statewide" in desc or "territory-wide" in desc or dl == sl:
        return "statewide"
    if any(x in dl for x in ["district", "ward", "board of regents", "constable", "justice of the peace", "city council district"]):
        return "special_district"
    if district:
        return "city"
    return "statewide"


def classify_election_type(description: str):
    d = description.lower()
    if "ballot measure" in d:
        return "ballot_measure"
    if "recall" in d:
        return "recall"
    if "runoff" in d:
        return "runoff"
    if "special" in d and "primary" in d:
        return "special_primary"
    if "special" in d and ("general" in d or "election" in d):
        return "special_general"
    if "primary" in d:
        return "primary"
    if "general" in d:
        return "general"
    return "general"


def extract_district_number(text: str):
    if not text:
        return ""
    m = re.search(r"\bDistrict\s+([A-Za-z0-9-]+)\b", text, flags=re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(r"\bPlace\s+([A-Za-z0-9-]+)\b", text, flags=re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(r"\bWard\s+([A-Za-z0-9-]+)\b", text, flags=re.IGNORECASE)
    if m:
        return m.group(1)
    return ""


def normalize_space(text: str):
    return re.sub(r"\s+", " ", (text or "").strip())


def normalize_jurisdiction_name(state_name: str, district: str, level: str):
    district_clean = normalize_space(district)
    if level == "statewide":
        return "Statewide"
    return district_clean or "Statewide"


def search_tokens(state_name: str, state_code: str, jurisdiction_name: str, district_number: str):
    toks = []
    for src in [jurisdiction_name, district_number, state_name, state_code]:
        if not src:
            continue
        for part in re.split(r"[^A-Za-z0-9]+", src.lower()):
            if part:
                toks.append(part)

    seen = set()
    out = []
    for t in toks:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return ",".join(out)


def extract_template_headers(template_xlsx: Path):
    with zipfile.ZipFile(template_xlsx) as z:
        ws = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        data = ws.find("a:sheetData", NS)
        header_row = data.find("a:row", NS)
        headers = []
        for c in header_row.findall("a:c", NS):
            t = c.attrib.get("t")
            if t == "inlineStr":
                v = c.find("a:is/a:t", NS)
                headers.append(v.text if v is not None else "")
            else:
                v = c.find("a:v", NS)
                headers.append(v.text if v is not None else "")
        return headers


def specificity_score(description: str, jurisdiction_level: str):
    d = description.lower()
    score = 0
    score += len(description)
    if "special" in d:
        score += 40
    if "district" in d:
        score += 30
    if "county" in d or "city" in d:
        score += 20
    if jurisdiction_level != "statewide":
        score += 20
    return score


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="")
    parser.add_argument("--template", default="/Users/matthewgreer-gentis/Downloads/votenow_elections_template.xlsx")
    parser.add_argument("--output-dir", default=".")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    default_candidates = [
        Path("WeVote Information Page/Models/USDetailedElectionEvents2026.json"),
        Path("USDetailedElectionEvents2026.json"),
    ]
    input_path = Path(args.input) if args.input else next((p for p in default_candidates if p.exists()), None)
    if input_path is None or not input_path.exists():
        raise SystemExit("Could not find input dataset. Pass --input path/to/raw.csv|tsv|json")

    template_path = Path(args.template)
    if not template_path.exists():
        raise SystemExit(f"Template file not found: {template_path}")

    raw_rows = load_raw_rows(input_path)
    original_count = len(raw_rows)

    normalized = [normalize_raw_row(r) for r in raw_rows]

    valid = []
    invalid_date_removed = 0
    for r in normalized:
        iso = parse_date_to_iso(r["Date"])
        if not iso:
            invalid_date_removed += 1
            continue
        r["Date"] = iso
        valid.append(r)

    removed_conventions = 0
    after_conventions = []
    for r in valid:
        text = f"{r['District']} {r['Description']}"
        if contains_any(text, CONVENTION_PATTERNS):
            removed_conventions += 1
            continue
        after_conventions.append(r)

    removed_broad_local = 0
    ambiguous_rows = 0
    filtered = []

    by_state_date = defaultdict(list)
    for r in after_conventions:
        by_state_date[(r["State"], r["Date"])].append(r)

    for r in after_conventions:
        state = r["State"]
        district = r["District"]
        desc = r["Description"]
        dl = desc.lower()

        if "local elections" in dl and not is_specific_local_row(state, district, desc):
            removed_broad_local += 1
            continue

        ambiguous = False
        if state.strip().lower() == district.strip().lower() and is_vague_statewide_description(desc):
            group = by_state_date[(state, r["Date"])]
            clearer_exists = any(
                x is not r and x["State"].strip().lower() == x["District"].strip().lower() and (
                    "statewide" in x["Description"].lower() or len(x["Description"]) > len(desc) + 8
                )
                for x in group
            )
            if clearer_exists:
                removed_broad_local += 1
                continue
            ambiguous = True

        r["_ambiguous"] = ambiguous
        if ambiguous:
            ambiguous_rows += 1
        filtered.append(r)

    # transform into template-aligned rows
    transformed = []
    for r in filtered:
        state_name = normalize_space(r["State"])
        state_code = state_to_code(state_name)
        if not state_code:
            # skip unknown state rows rather than fabricating
            continue

        district = normalize_space(r["District"])
        description = normalize_space(r["Description"]).rstrip(".")
        election_date = r["Date"]

        level = classify_jurisdiction_level(state_name, district, description)
        jurisdiction_name = normalize_jurisdiction_name(state_name, district, level)
        district_number = extract_district_number(district or description)
        election_type = classify_election_type(description)

        anomaly_flag = False
        anomaly_notes = []
        month = int(election_date.split("-")[1])

        if level == "statewide" and election_type in {"general", "special_general"} and month not in {11, 12}:
            anomaly_flag = True
            anomaly_notes.append("Unusual statewide general timing")

        if level == "statewide" and election_type in {"primary", "special_primary"} and month in {10, 11, 12}:
            anomaly_flag = True
            anomaly_notes.append("Unusual statewide primary timing")

        verification_note = VERIFICATION_NOTE_BASE
        if r.get("_ambiguous"):
            verification_note += " | Ambiguous statewide listing retained for review"
        if anomaly_notes:
            verification_note += " | " + "; ".join(anomaly_notes)

        location_string = f"{state_code} Statewide" if level == "statewide" else f"{jurisdiction_name}, {state_code}"

        record = {
            "election_id": str(uuid.uuid4()),
            "election_date": election_date,
            "state": state_code,
            "jurisdiction_level": level,
            "jurisdiction_name": jurisdiction_name,
            "office_or_issue": description,
            "district_name": district,
            "district_number": district_number,
            "election_type": election_type,
            "voter_facing": "Y",
            "votenow_location_string": location_string,
            "search_tokens": search_tokens(state_name, state_code, jurisdiction_name, district_number),
            "source_name": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "verification_status": "needs_official_verification",
            "verification_notes": verification_note,
            "last_verified_at": "",
            "anomaly_flag": anomaly_flag,
        }
        transformed.append(record)

    # Deduplicate by requested key: state + jurisdiction_name + election_date + office_or_issue
    dedupe_map = {}
    before_dedupe_count = len(transformed)
    for rec in transformed:
        key = (
            rec["state"],
            rec["jurisdiction_name"].lower(),
            rec["election_date"],
            rec["office_or_issue"].lower(),
        )
        current = dedupe_map.get(key)
        if current is None:
            dedupe_map[key] = rec
            continue

        curr_score = specificity_score(current["office_or_issue"], current["jurisdiction_level"])
        new_score = specificity_score(rec["office_or_issue"], rec["jurisdiction_level"])
        if new_score > curr_score:
            dedupe_map[key] = rec

    deduped = list(dedupe_map.values())
    rows_deduplicated = before_dedupe_count - len(deduped)

    # Remove duplicate statewide records on same date/type unless runoff
    grouped_statewide = defaultdict(list)
    for rec in deduped:
        if rec["jurisdiction_level"] == "statewide":
            grouped_statewide[(rec["state"], rec["election_date"], rec["election_type"])].append(rec)

    keep_ids = set()
    for key, items in grouped_statewide.items():
        if len(items) == 1:
            keep_ids.add(items[0]["election_id"])
            continue

        _, _, etype = key
        if etype == "runoff":
            for item in items:
                keep_ids.add(item["election_id"])
            continue

        best = max(items, key=lambda x: specificity_score(x["office_or_issue"], x["jurisdiction_level"]))
        keep_ids.add(best["election_id"])

    final_rows = []
    for rec in deduped:
        if rec["jurisdiction_level"] != "statewide" or rec["election_id"] in keep_ids:
            final_rows.append(rec)

    template_headers = extract_template_headers(template_path)
    # Append anomaly flag as requested in Step 7.
    output_headers = list(template_headers) + ["anomaly_flag"]

    # Stable sort for deterministic output.
    final_rows.sort(key=lambda r: (r["election_date"], r["state"], r["jurisdiction_name"], r["office_or_issue"]))

    cleaned_csv = output_dir / "votenow_2026_cleaned.csv"
    cleaned_json = output_dir / "votenow_2026_cleaned.json"
    flagged_csv = output_dir / "votenow_2026_flagged_for_review.csv"

    with cleaned_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=output_headers)
        writer.writeheader()
        for rec in final_rows:
            row = {k: rec.get(k, "") for k in output_headers}
            writer.writerow(row)

    with cleaned_json.open("w", encoding="utf-8") as f:
        json.dump(final_rows, f, indent=2)

    flagged_rows = [r for r in final_rows if r.get("anomaly_flag") is True]
    with flagged_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=output_headers)
        writer.writeheader()
        for rec in flagged_rows:
            row = {k: rec.get(k, "") for k in output_headers}
            writer.writerow(row)

    print(f"Input file: {input_path}")
    print(f"Original row count: {original_count}")
    print(f"Rows removed (invalid date): {invalid_date_removed}")
    print(f"Rows removed (conventions): {removed_conventions}")
    print(f"Rows removed (broad local listings / vague dupes): {removed_broad_local}")
    print(f"Rows flagged ambiguous (retained): {ambiguous_rows}")
    print(f"Rows deduplicated: {rows_deduplicated}")
    print(f"Final count: {len(final_rows)}")
    print(f"Rows flagged for review (anomaly_flag=TRUE): {len(flagged_rows)}")
    print(f"Wrote: {cleaned_csv}")
    print(f"Wrote: {cleaned_json}")
    print(f"Wrote: {flagged_csv}")


if __name__ == "__main__":
    main()
