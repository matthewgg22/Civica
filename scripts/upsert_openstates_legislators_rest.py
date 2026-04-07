#!/usr/bin/env python3
from __future__ import annotations

"""Upsert normalized OpenStates legislators into Supabase via PostgREST.

This path is useful when SUPABASE_DB_URL is not available but a service-role key is.
Requires:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import getpass
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_INPUT_PATH = Path("data/derived/openstates_state_legislators_current.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upsert OpenStates legislators via Supabase REST")
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Path to normalized JSON payload (default: {DEFAULT_INPUT_PATH})",
    )
    parser.add_argument(
        "--supabase-url",
        default=os.getenv("SUPABASE_URL", ""),
        help="Supabase project URL (default: SUPABASE_URL env var)",
    )
    parser.add_argument(
        "--service-role-key",
        default=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        help="Supabase service role key (default: SUPABASE_SERVICE_ROLE_KEY env var)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Rows per upsert batch (default: 500)",
    )
    return parser.parse_args()


def normalize_url(value: str) -> str:
    return value.strip().rstrip("/")


def load_payload(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Input payload must be a JSON object")

    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise ValueError("Input payload must include a 'rows' array")

    normalized_rows: list[dict[str, Any]] = []
    states: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        state = str(row.get("state", "")).strip().upper()
        if state:
            states.add(state)
        normalized_rows.append(
            {
                "legislator_key": row.get("legislator_key"),
                "source_person_id": row.get("source_person_id"),
                "seat_key": row.get("seat_key"),
                "state": row.get("state"),
                "chamber": row.get("chamber"),
                "district": row.get("district"),
                "name": row.get("name"),
                "title": row.get("title"),
                "party": row.get("party"),
                "website": row.get("website"),
                "phone": row.get("phone"),
                "source_file": row.get("source_file"),
                "source_snapshot_url": payload.get("meta", {}).get("source_url"),
                "source_snapshot_as_of": payload.get("meta", {}).get("as_of"),
            }
        )

    return normalized_rows, sorted(states)


def _request(
    url: str,
    method: str,
    service_role_key: str,
    body: bytes | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, str, dict[str, str]]:
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    request = urllib.request.Request(url=url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            status = int(response.getcode())
            text = response.read().decode("utf-8", errors="replace")
            header_map = {k.lower(): v for k, v in response.headers.items()}
            return status, text, header_map
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {method} {url}: {text[:500]}") from exc


def upsert_batches(
    supabase_url: str,
    service_role_key: str,
    rows: list[dict[str, Any]],
    batch_size: int,
) -> None:
    endpoint = (
        f"{supabase_url}/rest/v1/state_legislators_current"
        "?on_conflict=legislator_key"
    )
    total = len(rows)
    if total == 0:
        print("No rows to upsert.")
        return

    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        body = json.dumps(batch, ensure_ascii=True).encode("utf-8")
        status, _, _ = _request(
            url=endpoint,
            method="POST",
            service_role_key=service_role_key,
            body=body,
            extra_headers={
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )
        if status < 200 or status >= 300:
            raise RuntimeError(f"Unexpected status {status} for batch starting at index {i}")
        print(f"Upserted {min(i + batch_size, total)}/{total}")


def verify_states(
    supabase_url: str,
    service_role_key: str,
    states: list[str],
) -> dict[str, bool]:
    checks: dict[str, bool] = {}
    for state in states:
        params = urllib.parse.urlencode({"select": "legislator_key", "state": f"eq.{state}", "limit": "1"})
        endpoint = f"{supabase_url}/rest/v1/state_legislators_current?{params}"
        status, text, _ = _request(
            url=endpoint,
            method="GET",
            service_role_key=service_role_key,
        )
        if status < 200 or status >= 300:
            checks[state] = False
            continue
        try:
            decoded = json.loads(text)
            checks[state] = isinstance(decoded, list) and len(decoded) > 0
        except json.JSONDecodeError:
            checks[state] = False
    return checks


def main() -> None:
    args = parse_args()
    supabase_url = normalize_url(args.supabase_url)
    key = args.service_role_key.strip()

    if not supabase_url:
        raise ValueError("Missing Supabase URL. Pass --supabase-url or set SUPABASE_URL")
    if not key:
        key = getpass.getpass("SUPABASE_SERVICE_ROLE_KEY: ").strip()
    if not key:
        raise ValueError("Missing service role key.")
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be > 0")

    rows, states = load_payload(args.input)
    print(f"Loaded {len(rows)} rows from {args.input}")
    print(f"Payload states: {', '.join(states)}")

    upsert_batches(
        supabase_url=supabase_url,
        service_role_key=key,
        rows=rows,
        batch_size=args.batch_size,
    )

    checks = verify_states(
        supabase_url=supabase_url,
        service_role_key=key,
        states=states,
    )
    passed = sorted([state for state, ok in checks.items() if ok])
    failed = sorted([state for state, ok in checks.items() if not ok])

    print(f"Verified states present: {len(passed)}/{len(states)}")
    if passed:
        print(f"Present: {', '.join(passed)}")
    if failed:
        print(f"Missing after upsert: {', '.join(failed)}")
        raise RuntimeError("Some states failed verification after upsert.")


if __name__ == "__main__":
    main()
