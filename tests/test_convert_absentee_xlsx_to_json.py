from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from scripts.convert_absentee_xlsx_to_json import (
    EXPECTED_COLUMNS,
    ConversionError,
    convert_workbook,
)


def _build_fixture_workbook(
    path: Path,
    *,
    rows: list[dict[str, object]] | None = None,
    columns: list[str] | None = None,
) -> None:
    fixture_rows = rows or [
        {
            "Jurisdiction": " California ",
            "Official voter info (EAC)": " https://www.eac.gov/california-voter-info ",
            "Request / Apply link": "https://www.vote.org/absentee-ballot/california/",
            "Request deadline (In person)": "N/A",
            "Request deadline (Online/Email)": " 7 days before election day ",
            "Request deadline (By mail)": "",
            "Deadline source": " https://example.com/deadline ",
            "Notes": " Early voting is separate from absentee request deadlines. ",
        },
        {
            "Jurisdiction": "Puerto Rico",
            "Official voter info (EAC)": "https://www.eac.gov/puerto-rico-voter-info",
            "Request / Apply link": "https://example.org/pr-request",
            "Request deadline (In person)": None,
            "Request deadline (Online/Email)": None,
            "Request deadline (By mail)": None,
            "Deadline source": None,
            "Notes": None,
        },
    ]

    frame = pd.DataFrame(fixture_rows)
    if columns is not None:
        frame = frame[columns]

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        frame.to_excel(writer, sheet_name="Absentee Request Deadlines", index=False)
        pd.DataFrame({"What this file contains": ["fixture"]}).to_excel(
            writer,
            sheet_name="README",
            index=False,
        )


def test_convert_workbook_emits_metadata_and_normalized_rows(tmp_path: Path) -> None:
    workbook = tmp_path / "absentee.xlsx"
    output = tmp_path / "derived" / "absentee_ballot_request_links_deadlines.json"
    _build_fixture_workbook(workbook)

    payload = convert_workbook(workbook, output)

    assert output.exists()
    file_payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload == file_payload

    assert file_payload["metadata"]["sourceFile"] == "absentee.xlsx"
    assert file_payload["metadata"]["rowCount"] == 2

    rows = file_payload["rows"]
    assert rows[0]["displayName"] == "California"
    assert rows[0]["slug"] == "california"
    assert rows[0]["code"] == "CA"
    assert rows[0]["requestDeadlineInPerson"] == "N/A"
    assert rows[0]["requestDeadlineByMail"] is None
    assert rows[0]["deadlineSourceUrl"] == "https://example.com/deadline"


def test_convert_workbook_fails_fast_when_columns_are_invalid(tmp_path: Path) -> None:
    workbook = tmp_path / "bad_schema.xlsx"
    bad_columns = [c for c in EXPECTED_COLUMNS if c != "Deadline source"]
    _build_fixture_workbook(workbook, columns=bad_columns)

    with pytest.raises(ConversionError) as exc:
        convert_workbook(workbook, tmp_path / "out.json")

    message = str(exc.value)
    assert "Column mismatch" in message
    assert "Deadline source" in message


def test_convert_workbook_rejects_missing_required_fields(tmp_path: Path) -> None:
    workbook = tmp_path / "bad_rows.xlsx"
    _build_fixture_workbook(
        workbook,
        rows=[
            {
                "Jurisdiction": "",
                "Official voter info (EAC)": "https://www.eac.gov/california-voter-info",
                "Request / Apply link": "https://www.vote.org/absentee-ballot/california/",
                "Request deadline (In person)": None,
                "Request deadline (Online/Email)": None,
                "Request deadline (By mail)": None,
                "Deadline source": None,
                "Notes": None,
            }
        ],
    )

    with pytest.raises(ConversionError) as exc:
        convert_workbook(workbook, tmp_path / "out.json")

    assert "Jurisdiction is required" in str(exc.value)


def test_convert_workbook_supports_directory_out_path(tmp_path: Path) -> None:
    workbook = tmp_path / "absentee.xlsx"
    out_dir = tmp_path / "derived"
    _build_fixture_workbook(workbook)

    convert_workbook(workbook, out_dir)

    expected = out_dir / "absentee_ballot_request_links_deadlines.json"
    assert expected.exists()
