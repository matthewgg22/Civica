#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd


EXPECTED_COLUMNS = [
    "Jurisdiction",
    "Official voter info (EAC)",
    "Request / Apply link",
    "Request deadline (In person)",
    "Request deadline (Online/Email)",
    "Request deadline (By mail)",
    "Deadline source",
    "Notes",
]

PRIMARY_SHEET_NAME = "Absentee Request Deadlines"

JURISDICTION_CODES: dict[str, str] = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "District of Columbia": "DC",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
    "American Samoa": "AS",
    "Guam": "GU",
    "Northern Mariana Islands": "MP",
    "Puerto Rico": "PR",
    "U.S. Virgin Islands": "VI",
}


class ConversionError(ValueError):
    """Raised when the absentee workbook has invalid structure or values."""


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert VoteNow absentee ballot XLSX into normalized JSON."
    )
    parser.add_argument("--input", required=True, help="Path to source XLSX file.")
    parser.add_argument("--out", required=True, help="Output JSON path or directory.")
    parser.add_argument(
        "--bundle-out",
        help="Optional second output path for app-bundled JSON resource.",
    )
    return parser.parse_args(argv)


def convert_workbook(input_path: Path, out_path: Path, bundle_out_path: Path | None = None) -> dict[str, Any]:
    if not input_path.exists():
        raise ConversionError(f"Input workbook not found: {input_path}")
    if input_path.suffix.lower() != ".xlsx":
        raise ConversionError(f"Input workbook must be .xlsx: {input_path}")

    frame = _read_sheet(input_path)
    rows = _normalize_rows(frame)
    if not rows:
        raise ConversionError("Workbook has no data rows after normalization.")

    payload = {
        "metadata": {
            "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "sourceFile": input_path.name,
            "rowCount": len(rows),
            "sheet": PRIMARY_SHEET_NAME,
        },
        "rows": rows,
    }

    final_out = _resolve_out_path(out_path)
    final_out.parent.mkdir(parents=True, exist_ok=True)
    _write_json(final_out, payload)

    if bundle_out_path is not None:
        bundle_out_path.parent.mkdir(parents=True, exist_ok=True)
        _write_json(bundle_out_path, payload)

    return payload


def _resolve_out_path(path: Path) -> Path:
    if path.suffix.lower() == ".json":
        return path
    return path / "absentee_ballot_request_links_deadlines.json"


def _read_sheet(input_path: Path) -> pd.DataFrame:
    try:
        workbook = pd.read_excel(
            input_path,
            sheet_name=None,
            dtype=object,
            engine="openpyxl",
            keep_default_na=False,
        )
    except Exception as exc:  # pragma: no cover
        raise ConversionError(f"Failed reading workbook '{input_path}': {exc}") from exc

    if PRIMARY_SHEET_NAME not in workbook:
        available = ", ".join(sorted(workbook.keys()))
        raise ConversionError(
            f"Required sheet '{PRIMARY_SHEET_NAME}' is missing. Available sheets: {available}"
        )

    frame = workbook[PRIMARY_SHEET_NAME].copy()
    frame.columns = [str(col).strip() for col in frame.columns]
    _validate_columns(frame.columns.tolist())
    frame = frame.dropna(how="all")
    return frame


def _validate_columns(actual_columns: list[str]) -> None:
    actual_set = set(actual_columns)
    expected_set = set(EXPECTED_COLUMNS)
    if actual_set == expected_set:
        return

    missing = sorted(expected_set - actual_set)
    unexpected = sorted(actual_set - expected_set)
    parts = ["Column mismatch in absentee sheet."]
    if missing:
        parts.append("Missing: " + ", ".join(missing))
    if unexpected:
        parts.append("Unexpected: " + ", ".join(unexpected))
    raise ConversionError(" ".join(parts))


def _normalize_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for idx, row in frame.iterrows():
        excel_row = idx + 2
        jurisdiction = _to_nullable_text(row.get("Jurisdiction"))
        if not jurisdiction:
            raise ConversionError(f"Row {excel_row}: Jurisdiction is required.")

        official_info = _to_nullable_text(row.get("Official voter info (EAC)"))
        request_link = _to_nullable_text(row.get("Request / Apply link"))
        if not official_info:
            raise ConversionError(f"Row {excel_row}: Official voter info (EAC) is required.")
        if not request_link:
            raise ConversionError(f"Row {excel_row}: Request / Apply link is required.")

        record = {
            "displayName": jurisdiction,
            "slug": _slugify(jurisdiction),
            "code": JURISDICTION_CODES.get(jurisdiction),
            "officialVoterInfoUrl": official_info,
            "requestApplyUrl": request_link,
            "requestDeadlineInPerson": _to_nullable_text(row.get("Request deadline (In person)")),
            "requestDeadlineOnlineEmail": _to_nullable_text(row.get("Request deadline (Online/Email)")),
            "requestDeadlineByMail": _to_nullable_text(row.get("Request deadline (By mail)")),
            "deadlineSourceUrl": _to_nullable_text(row.get("Deadline source")),
            "notes": _to_nullable_text(row.get("Notes")),
        }
        records.append(record)

    records.sort(key=lambda item: (item["displayName"] or "", item["slug"]))
    return records


def _to_nullable_text(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed if trimmed else None
    text = str(value).strip()
    return text if text else None


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", lowered)
    return normalized.strip("-")


def _write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    input_path = Path(args.input)
    out_path = Path(args.out)
    bundle_out = Path(args.bundle_out) if args.bundle_out else None

    try:
        payload = convert_workbook(input_path=input_path, out_path=out_path, bundle_out_path=bundle_out)
    except ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"Converted {payload['metadata']['rowCount']} jurisdictions to JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
