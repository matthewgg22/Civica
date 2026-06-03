#!/usr/bin/env python3
"""Refresh a state slice of USDA FNS SNAP Retailer Locator.

Pulls all rows where State=<arg> from the canonical USDA ArcGIS FeatureServer
and writes data-ops/sample/usda-snap-retailers-<state>/{retailers.csv,retailers.geojson,manifest.json}.

Usage: refresh.py [STATE]   (default: CA)

No auth required. Public-domain federal dataset. Service is rate-limit-friendly
for sequential paged queries (~1 page per ~1000 records).
"""
from __future__ import annotations

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SERVICE = (
    "https://services1.arcgis.com/RLQu0rK7h4kbsBq5/arcgis/rest/services/"
    "snap_retailer_location_data/FeatureServer/0"
)
STATE = (sys.argv[1] if len(sys.argv) > 1 else "CA").upper()
PAGE_SIZE = 1000
OUT_DIR = Path(__file__).resolve().parents[2] / "data-ops" / "sample" / f"usda-snap-retailers-{STATE.lower()}"

FIELDS = [
    "Record_ID", "Store_Name", "Store_Street_Address", "Additonal_Address",
    "City", "State", "Zip_Code", "Zip4", "County", "Store_Type",
    "Latitude", "Longitude", "Incentive_Program", "Grantee_Name", "ObjectId",
]


def fetch_page(offset: int) -> dict:
    params = {
        "where": f"State='{STATE}'",
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
        "orderByFields": "ObjectId ASC",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
    }
    url = f"{SERVICE}/query?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read())


def fetch_count() -> int:
    params = {"where": f"State='{STATE}'", "returnCountOnly": "true", "f": "json"}
    url = f"{SERVICE}/query?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())["count"]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = fetch_count()
    print(f"{STATE} records: {total}", file=sys.stderr)

    features: list[dict] = []
    offset = 0
    while True:
        page = fetch_page(offset)
        batch = page.get("features", [])
        if not batch:
            break
        features.extend(batch)
        print(f"  fetched {len(features)}/{total}", file=sys.stderr)
        if not page.get("exceededTransferLimit") and len(batch) < PAGE_SIZE:
            break
        offset += len(batch)
        time.sleep(0.2)

    csv_path = OUT_DIR / "retailers.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for feat in features:
            w.writerow({k: feat["attributes"].get(k, "") for k in FIELDS})

    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": (
                    {"type": "Point",
                     "coordinates": [feat["geometry"]["x"], feat["geometry"]["y"]]}
                    if feat.get("geometry") else None
                ),
                "properties": feat["attributes"],
            }
            for feat in features
        ],
    }
    geo_path = OUT_DIR / "retailers.geojson"
    with geo_path.open("w", encoding="utf-8") as f:
        json.dump(geojson, f)

    manifest = {
        "source_service": SERVICE,
        "filter": f"State='{STATE}'",
        "row_count": len(features),
        "pulled_at_utc": datetime.now(timezone.utc).isoformat(),
        "fields": FIELDS,
        "note": "Public domain (federal). See README.md for citation + refresh cadence.",
    }
    with (OUT_DIR / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"wrote {len(features)} rows -> {csv_path}", file=sys.stderr)
    print(f"wrote geojson -> {geo_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
