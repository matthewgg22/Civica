from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_DERIVED_DIR = Path(__file__).resolve().parents[1] / "data" / "derived"


def load_metrics(base_dir: str | Path = DEFAULT_DERIVED_DIR) -> list[dict[str, Any]]:
    return _load_json(Path(base_dir) / "metrics.json")


def load_geos(base_dir: str | Path = DEFAULT_DERIVED_DIR) -> list[dict[str, Any]]:
    return _load_json(Path(base_dir) / "geos.json")


def load_values(
    year: int | None = None,
    base_dir: str | Path = DEFAULT_DERIVED_DIR,
) -> list[dict[str, Any]]:
    path = Path(base_dir) / "geo_metric_long.jsonl"
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if not text:
                continue
            record = json.loads(text)
            if year is None or record.get("value_year") == year:
                rows.append(record)
    return rows


def _load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expected JSON array in {path}")
    return payload

