#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

import pandas as pd


EXPECTED_SCHEMAS: dict[str, list[str]] = {
    "Metric_Catalog": [
        "metric_id",
        "display_name",
        "category",
        "driver",
        "definition",
        "calculation",
        "unit",
        "primary_sources",
        "update_frequency",
        "geo_coverage",
    ],
    "Metric_Copy_Blocks": [
        "metric_id",
        "ui_title",
        "payoff_hook",
        "why_it_matters",
        "how_to_read",
        "watch_out_for",
        "recommended_viz",
        "suggested_cta",
        "primary_sources",
        "update_frequency",
        "geo_coverage",
    ],
    "Geos": [
        "geo_name",
        "code",
        "fips",
        "type",
    ],
    "Geo_Metric_Long": [
        "geo_code",
        "metric_id",
        "value",
        "value_unit",
        "value_year",
        "source_url",
        "notes",
    ],
    "State_Figures_2024": [
        "geo_code",
        "geo_name",
        "type",
        "turnout_vep_last",
        "turnout_trend_same_type",
        "pres_midterm_gap",
        "early_voting_days",
        "no_excuse_absentee",
        "online_reg_available",
        "polling_places_per_10k_reg",
        "mail_ballot_reject_rate",
        "provisional_reject_rate",
        "mil_overseas_ballot_success",
        "dropboxes_per_100k",
    ],
}

COPY_BLOCK_PROVENANCE_RENAMES = {
    "primary_sources": "copy_primary_sources",
    "update_frequency": "copy_update_frequency",
    "geo_coverage": "copy_geo_coverage",
}


class IngestError(ValueError):
    """Raised when workbook validation fails."""


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest VoteNow voter participation workbook and publish JSON artifacts."
    )
    parser.add_argument("--input", required=True, help="Path to source xlsx workbook.")
    parser.add_argument("--out", required=True, help="Output directory for derived artifacts.")
    return parser.parse_args(argv)


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def ingest_workbook(input_path: Path, out_dir: Path) -> dict[str, Any]:
    if not input_path.exists():
        raise IngestError(f"Input workbook not found: {input_path}")
    if input_path.suffix.lower() != ".xlsx":
        raise IngestError(f"Input workbook must be an .xlsx file: {input_path}")

    sheets = _read_and_validate_workbook(input_path)

    metric_catalog = sheets["Metric_Catalog"]
    metric_copy_blocks = sheets["Metric_Copy_Blocks"]
    geos = sheets["Geos"]
    geo_metric_long = sheets["Geo_Metric_Long"]
    state_figures = sheets["State_Figures_2024"]

    _validate_unique_metric_ids(metric_catalog, "Metric_Catalog")
    _validate_unique_metric_ids(metric_copy_blocks, "Metric_Copy_Blocks")
    _validate_metric_join(metric_catalog, metric_copy_blocks)
    geo_metric_long = _validate_and_type_geo_metric_long(geo_metric_long)

    metric_copy_blocks = metric_copy_blocks.rename(columns=COPY_BLOCK_PROVENANCE_RENAMES)
    metrics = metric_catalog.merge(
        metric_copy_blocks,
        on="metric_id",
        how="inner",
        validate="one_to_one",
    )

    metrics = metrics.sort_values(by=["metric_id"], kind="stable")
    geos = geos.sort_values(by=["code", "geo_name"], kind="stable")
    geo_metric_long = geo_metric_long.sort_values(
        by=["geo_code", "metric_id", "value_year"], kind="stable"
    )
    state_figures = state_figures.sort_values(by=["geo_code", "geo_name"], kind="stable")

    metrics_records = _frame_to_records(metrics)
    geos_records = _frame_to_records(geos)
    geo_metric_records = _frame_to_records(geo_metric_long)
    state_records = _frame_to_records(state_figures)

    out_dir.mkdir(parents=True, exist_ok=True)

    metrics_path = out_dir / "metrics.json"
    geos_path = out_dir / "geos.json"
    geo_metric_path = out_dir / "geo_metric_long.jsonl"
    state_figures_path = out_dir / "state_figures_2024.json"
    manifest_path = out_dir / "manifest.json"

    _write_json(metrics_path, metrics_records)
    _write_json(geos_path, geos_records)
    _write_jsonl(geo_metric_path, geo_metric_records)
    _write_json(state_figures_path, state_records)

    manifest = {
        "input_file": str(input_path),
        "input_filename": input_path.name,
        "input_sha256": sha256_file(input_path),
        "created_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sheet_rows": {name: int(len(df)) for name, df in sheets.items()},
        "output_rows": {
            "metrics.json": len(metrics_records),
            "geos.json": len(geos_records),
            "geo_metric_long.jsonl": len(geo_metric_records),
            "state_figures_2024.json": len(state_records),
        },
    }
    _write_json(manifest_path, manifest)
    return manifest


def _read_and_validate_workbook(input_path: Path) -> dict[str, pd.DataFrame]:
    try:
        workbook = pd.read_excel(
            input_path,
            sheet_name=None,
            dtype=object,
            engine="openpyxl",
        )
    except Exception as exc:  # pragma: no cover - pandas/openpyxl handles detail
        raise IngestError(f"Failed to read workbook '{input_path}': {exc}") from exc

    missing_sheets = sorted(set(EXPECTED_SCHEMAS) - set(workbook))
    if missing_sheets:
        raise IngestError(
            "Workbook is missing required sheet(s): " + ", ".join(missing_sheets)
        )

    parsed: dict[str, pd.DataFrame] = {}
    for sheet_name, expected_columns in EXPECTED_SCHEMAS.items():
        frame = workbook[sheet_name].copy()
        frame.columns = [str(col).strip() for col in frame.columns]
        _validate_columns(sheet_name, frame.columns.tolist(), expected_columns)
        frame = frame.dropna(how="all").copy()
        frame = _strip_whitespace(frame, excluded_columns={"source_url", "notes"})
        frame = _normalize_geo_columns(frame)
        parsed[sheet_name] = frame

    return parsed


def _validate_columns(
    sheet_name: str, actual_columns: list[str], expected_columns: list[str]
) -> None:
    actual_set = set(actual_columns)
    expected_set = set(expected_columns)
    if actual_set == expected_set:
        return

    missing = sorted(expected_set - actual_set)
    unexpected = sorted(actual_set - expected_set)
    parts: list[str] = [f"Column mismatch in sheet '{sheet_name}'."]
    if missing:
        parts.append("Missing: " + ", ".join(missing))
    if unexpected:
        parts.append("Unexpected: " + ", ".join(unexpected))
    raise IngestError(" ".join(parts))


def _strip_whitespace(
    frame: pd.DataFrame, excluded_columns: set[str] | None = None
) -> pd.DataFrame:
    excluded = excluded_columns or set()
    cleaned = frame.copy()
    for col in cleaned.columns:
        if col in excluded:
            continue
        cleaned[col] = cleaned[col].apply(
            lambda value: value.strip() if isinstance(value, str) else value
        )
    return cleaned


def _normalize_geo_columns(frame: pd.DataFrame) -> pd.DataFrame:
    normalized = frame.copy()
    if "geo_code" in normalized.columns:
        normalized["geo_code"] = normalized["geo_code"].apply(_normalize_geo_code)
    if "code" in normalized.columns:
        normalized["code"] = normalized["code"].apply(_normalize_geo_code)
    return normalized


def _normalize_geo_code(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed.upper() if trimmed else None
    return str(value).strip().upper()


def _validate_unique_metric_ids(frame: pd.DataFrame, sheet_name: str) -> None:
    if "metric_id" not in frame.columns:
        return
    ids = frame["metric_id"].tolist()
    empty_rows = [idx + 2 for idx, metric_id in enumerate(ids) if not _as_nonempty_str(metric_id)]
    if empty_rows:
        raise IngestError(
            f"Sheet '{sheet_name}' contains empty metric_id at row(s): "
            + ", ".join(map(str, empty_rows))
        )

    duplicated = (
        frame[frame["metric_id"].duplicated(keep=False)]["metric_id"]
        .astype(str)
        .tolist()
    )
    if duplicated:
        unique_duplicated = sorted(set(duplicated))
        raise IngestError(
            f"Sheet '{sheet_name}' has duplicate metric_id values: "
            + ", ".join(unique_duplicated)
        )


def _validate_metric_join(
    metric_catalog: pd.DataFrame, metric_copy_blocks: pd.DataFrame
) -> None:
    catalog_ids = set(metric_catalog["metric_id"].astype(str).tolist())
    copy_ids = set(metric_copy_blocks["metric_id"].astype(str).tolist())

    missing_copy = sorted(catalog_ids - copy_ids)
    extra_copy = sorted(copy_ids - catalog_ids)
    if missing_copy:
        raise IngestError(
            "Metric_Catalog metric_id values without copy blocks: "
            + ", ".join(missing_copy)
        )
    if extra_copy:
        raise IngestError(
            "Metric_Copy_Blocks metric_id values not found in Metric_Catalog: "
            + ", ".join(extra_copy)
        )


def _validate_and_type_geo_metric_long(frame: pd.DataFrame) -> pd.DataFrame:
    typed = frame.copy()
    normalized_rows: list[dict[str, Any]] = []

    for idx, row in typed.iterrows():
        excel_row = idx + 2
        geo_code = _as_nonempty_str(row["geo_code"])
        if not geo_code:
            raise IngestError(
                f"Geo_Metric_Long row {excel_row}: geo_code must be a non-empty string."
            )

        metric_id = _as_nonempty_str(row["metric_id"])
        if not metric_id:
            raise IngestError(
                f"Geo_Metric_Long row {excel_row}: metric_id must be a non-empty string."
            )

        value = _coerce_float_or_null(row["value"], excel_row)
        value_year = _coerce_year(
            row["value_year"],
            excel_row,
            allow_null=value is None,
        )

        normalized_rows.append(
            {
                "geo_code": geo_code.upper(),
                "metric_id": metric_id,
                "value": value,
                "value_unit": _coerce_to_str_or_null(row["value_unit"]),
                "value_year": value_year,
                # keep source_url + notes text as entered in workbook
                "source_url": _coerce_cell_keep_text(row["source_url"]),
                "notes": _coerce_cell_keep_text(row["notes"]),
            }
        )

    return pd.DataFrame(normalized_rows, columns=EXPECTED_SCHEMAS["Geo_Metric_Long"])


def _as_nonempty_str(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    text = str(value).strip()
    return text if text else None


def _coerce_year(
    value: Any, row_number: int, allow_null: bool = False
) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        if allow_null:
            return None
        raise IngestError(f"Geo_Metric_Long row {row_number}: value_year is required.")
    if isinstance(value, bool):
        raise IngestError(
            f"Geo_Metric_Long row {row_number}: value_year must be an integer."
        )

    try:
        if isinstance(value, str):
            parsed = float(value.strip())
        else:
            parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise IngestError(
            f"Geo_Metric_Long row {row_number}: value_year must be an integer."
        ) from exc

    if not math.isfinite(parsed) or not parsed.is_integer():
        raise IngestError(
            f"Geo_Metric_Long row {row_number}: value_year must be an integer."
        )
    return int(parsed)


def _coerce_float_or_null(value: Any, row_number: int) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if isinstance(value, bool):
        raise IngestError(
            f"Geo_Metric_Long row {row_number}: value must be numeric or null."
        )

    try:
        parsed = float(value.strip()) if isinstance(value, str) else float(value)
    except (TypeError, ValueError) as exc:
        raise IngestError(
            f"Geo_Metric_Long row {row_number}: value must be numeric or null."
        ) from exc

    if not math.isfinite(parsed):
        raise IngestError(
            f"Geo_Metric_Long row {row_number}: value must be numeric or null."
        )
    return parsed


def _coerce_to_str_or_null(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return str(value)


def _coerce_cell_keep_text(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.isoformat()
    return value


def _frame_to_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for _, row in frame.iterrows():
        record: dict[str, Any] = {}
        for col in frame.columns:
            record[col] = _to_builtin(row[col])
        records.append(record)
    return records


def _to_builtin(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, bool):
        return bool(value)
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float):
        return float(value)
    if isinstance(value, str):
        return value
    if hasattr(value, "item"):
        return value.item()
    return value


def _write_json(path: Path, payload: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False, sort_keys=True)
        handle.write("\n")


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True))
            handle.write("\n")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    input_path = Path(args.input)
    out_dir = Path(args.out)

    try:
        manifest = ingest_workbook(input_path=input_path, out_dir=out_dir)
    except IngestError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(
        "Ingestion complete. "
        f"Metrics={manifest['output_rows']['metrics.json']}, "
        f"Geos={manifest['output_rows']['geos.json']}, "
        f"Values={manifest['output_rows']['geo_metric_long.jsonl']}, "
        f"StateFigures={manifest['output_rows']['state_figures_2024.json']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
