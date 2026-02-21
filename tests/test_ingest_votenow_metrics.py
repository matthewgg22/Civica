from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Callable

import pandas as pd
import pytest

from scripts.ingest_votenow_metrics import EXPECTED_SCHEMAS, IngestError, ingest_workbook


def _build_fixture_workbook(
    path: Path,
    overrides: dict[str, Callable[[pd.DataFrame], pd.DataFrame]] | None = None,
) -> None:
    overrides = overrides or {}

    frames: dict[str, pd.DataFrame] = {
        "Metric_Catalog": pd.DataFrame(
            [
                {
                    "metric_id": "turnout_vep_last",
                    "display_name": "Turnout (VEP, latest comparable election)",
                    "category": "participation",
                    "driver": "registration_and_access",
                    "definition": "Votes cast divided by voting-eligible population.",
                    "calculation": "ballots_cast / vep",
                    "unit": "percent",
                    "primary_sources": "EAC; Census",
                    "update_frequency": "annual",
                    "geo_coverage": "state",
                }
            ]
        ),
        "Metric_Copy_Blocks": pd.DataFrame(
            [
                {
                    "metric_id": "turnout_vep_last",
                    "ui_title": "Turnout snapshot",
                    "payoff_hook": "See where participation is strong or weak.",
                    "why_it_matters": "Participation rates reflect voter engagement.",
                    "how_to_read": "Higher is generally better in comparable election types.",
                    "watch_out_for": "Compare like-for-like election years.",
                    "recommended_viz": "bar",
                    "suggested_cta": "Explore peer states",
                    "primary_sources": "EAC",
                    "update_frequency": "annual",
                    "geo_coverage": "state",
                }
            ]
        ),
        "Geos": pd.DataFrame(
            [
                {
                    "geo_name": "California",
                    "code": "ca",
                    "fips": "06",
                    "type": "state",
                }
            ]
        ),
        "Geo_Metric_Long": pd.DataFrame(
            [
                {
                    "geo_code": "ca",
                    "metric_id": "turnout_vep_last",
                    "value": 62.5,
                    "value_unit": "percent",
                    "value_year": 2024,
                    "source_url": "https://example.com/source",
                    "notes": "verified",
                }
            ]
        ),
        "State_Figures_2024": pd.DataFrame(
            [
                {
                    "geo_code": "ca",
                    "geo_name": "California",
                    "type": "state",
                    "turnout_vep_last": 62.5,
                    "turnout_trend_same_type": 1.2,
                    "pres_midterm_gap": 8.1,
                    "early_voting_days": 29,
                    "no_excuse_absentee": 1,
                    "online_reg_available": 1,
                    "polling_places_per_10k_reg": 2.4,
                    "mail_ballot_reject_rate": 0.9,
                    "provisional_reject_rate": 1.3,
                    "mil_overseas_ballot_success": 94.0,
                    "dropboxes_per_100k": 4.2,
                }
            ]
        ),
    }

    for sheet_name, transform in overrides.items():
        frames[sheet_name] = transform(frames[sheet_name].copy())

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name, expected_columns in EXPECTED_SCHEMAS.items():
            frame = frames[sheet_name]
            if set(expected_columns).issubset(frame.columns):
                extra_columns = [col for col in frame.columns if col not in expected_columns]
                frame = frame[expected_columns + extra_columns]
            frame.to_excel(writer, sheet_name=sheet_name, index=False)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        digest.update(handle.read())
    return digest.hexdigest()


def test_ingest_outputs_join_and_manifest_hash(tmp_path: Path) -> None:
    workbook_path = tmp_path / "fixture.xlsx"
    out_dir = tmp_path / "derived"
    _build_fixture_workbook(workbook_path)

    manifest = ingest_workbook(workbook_path, out_dir)

    metrics_path = out_dir / "metrics.json"
    geos_path = out_dir / "geos.json"
    values_path = out_dir / "geo_metric_long.jsonl"
    state_path = out_dir / "state_figures_2024.json"
    manifest_path = out_dir / "manifest.json"

    assert metrics_path.exists()
    assert geos_path.exists()
    assert values_path.exists()
    assert state_path.exists()
    assert manifest_path.exists()

    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    assert len(metrics) == 1
    assert metrics[0]["metric_id"] == "turnout_vep_last"
    assert metrics[0]["ui_title"] == "Turnout snapshot"
    assert "copy_primary_sources" in metrics[0]

    geos = json.loads(geos_path.read_text(encoding="utf-8"))
    assert geos[0]["code"] == "CA"

    manifest_json = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest_json["input_sha256"] == _sha256(workbook_path)
    assert manifest_json["output_rows"]["metrics.json"] == 1
    assert manifest["output_rows"]["geo_metric_long.jsonl"] == 1


def test_schema_enforcement_fails_fast_on_missing_column(tmp_path: Path) -> None:
    workbook_path = tmp_path / "bad_schema.xlsx"

    def drop_driver(frame: pd.DataFrame) -> pd.DataFrame:
        return frame.drop(columns=["driver"])

    _build_fixture_workbook(
        workbook_path,
        overrides={"Metric_Catalog": drop_driver},
    )

    with pytest.raises(IngestError) as exc:
        ingest_workbook(workbook_path, tmp_path / "derived")

    message = str(exc.value)
    assert "Metric_Catalog" in message
    assert "driver" in message


def test_join_validation_rejects_unmatched_metric_ids(tmp_path: Path) -> None:
    workbook_path = tmp_path / "bad_join.xlsx"

    def remap_metric_id(frame: pd.DataFrame) -> pd.DataFrame:
        frame.loc[0, "metric_id"] = "different_metric"
        return frame

    _build_fixture_workbook(
        workbook_path,
        overrides={"Metric_Copy_Blocks": remap_metric_id},
    )

    with pytest.raises(IngestError) as exc:
        ingest_workbook(workbook_path, tmp_path / "derived")

    assert "without copy blocks" in str(exc.value)


def test_geo_metric_long_jsonl_is_line_delimited_and_typed(tmp_path: Path) -> None:
    workbook_path = tmp_path / "fixture.xlsx"
    out_dir = tmp_path / "derived"
    _build_fixture_workbook(workbook_path)

    ingest_workbook(workbook_path, out_dir)
    values_path = out_dir / "geo_metric_long.jsonl"

    lines = values_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1

    row = json.loads(lines[0])
    assert row["geo_code"] == "CA"
    assert row["metric_id"] == "turnout_vep_last"
    assert isinstance(row["value_year"], int)
    assert isinstance(row["value"], float)
