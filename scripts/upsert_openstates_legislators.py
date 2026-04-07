#!/usr/bin/env python3
from __future__ import annotations

"""Upsert normalized Open States legislators into Supabase Postgres.

Expected input format:
{
  "meta": {...},
  "rows": [
    {
      "legislator_key": "...",
      "source_person_id": "...",
      "seat_key": "...",
      "state": "CA",
      "chamber": "lower",
      "district": "5",
      "name": "...",
      "title": "Assemblymember",
      "party": "Democratic",
      "website": "https://...",
      "phone": "...",
      "source_file": "people-main/data/ca/legislature/...yml"
    }
  ]
}
"""

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg

DEFAULT_INPUT_PATH = Path("data/derived/openstates_state_legislators_current.json")


@dataclass(frozen=True)
class Row:
    legislator_key: str
    source_person_id: str
    seat_key: str
    state: str
    chamber: str
    district: str
    name: str
    title: str
    party: str | None
    website: str | None
    phone: str | None
    source_file: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upsert Open States legislators into Supabase")
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Path to normalized JSON payload (default: {DEFAULT_INPUT_PATH})",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("SUPABASE_DB_URL", ""),
        help="Supabase Postgres URL (default: SUPABASE_DB_URL env var)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate payload and print counts without writing to DB",
    )
    parser.add_argument(
        "--prune-scope",
        choices=("none", "included_states", "all"),
        default="included_states",
        help=(
            "Delete rows missing from snapshot: "
            "'none' keeps all existing rows, "
            "'included_states' prunes only states present in this payload, "
            "'all' prunes against the entire table (full-snapshot mode)."
        ),
    )
    return parser.parse_args()


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def normalize_nullable_text(value: Any) -> str | None:
    text = normalize_text(value)
    return text or None


def load_rows(path: Path) -> tuple[dict[str, Any], list[Row]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Input payload must be a JSON object")

    meta = payload.get("meta", {})
    raw_rows = payload.get("rows")
    if not isinstance(raw_rows, list):
        raise ValueError("Input payload must include a 'rows' array")

    rows: list[Row] = []
    seen: set[str] = set()

    for item in raw_rows:
        if not isinstance(item, dict):
            continue

        legislator_key = normalize_text(item.get("legislator_key"))
        source_person_id = normalize_text(item.get("source_person_id"))
        seat_key = normalize_text(item.get("seat_key"))
        state = normalize_text(item.get("state")).upper()
        chamber = normalize_text(item.get("chamber")).lower()
        district = normalize_text(item.get("district"))
        name = normalize_text(item.get("name"))
        title = normalize_text(item.get("title"))

        if not legislator_key:
            raise ValueError("Found row without legislator_key")
        if legislator_key in seen:
            raise ValueError(f"Duplicate legislator_key in payload: {legislator_key}")
        seen.add(legislator_key)

        if not (source_person_id and seat_key and state and chamber and district and name and title):
            raise ValueError(f"Missing required fields for row: {legislator_key}")

        rows.append(
            Row(
                legislator_key=legislator_key,
                source_person_id=source_person_id,
                seat_key=seat_key,
                state=state,
                chamber=chamber,
                district=district,
                name=name,
                title=title,
                party=normalize_nullable_text(item.get("party")),
                website=normalize_nullable_text(item.get("website")),
                phone=normalize_nullable_text(item.get("phone")),
                source_file=normalize_nullable_text(item.get("source_file")),
            )
        )

    return meta, rows


def upsert_rows(
    database_url: str,
    rows: list[Row],
    source_meta: dict[str, Any],
    prune_scope: str,
) -> tuple[int, int, int]:
    if not database_url:
        raise ValueError("Missing database URL. Pass --database-url or set SUPABASE_DB_URL")

    sync_started_at = datetime.now(timezone.utc)
    source_url = normalize_nullable_text(source_meta.get("source_url"))
    source_as_of = normalize_nullable_text(source_meta.get("as_of"))

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("begin")

            cur.execute(
                """
                create temporary table tmp_state_legislators_sync (
                  legislator_key text primary key,
                  source_person_id text not null,
                  seat_key text not null,
                  state text not null,
                  chamber text not null,
                  district text not null,
                  name text not null,
                  title text not null,
                  party text,
                  website text,
                  phone text,
                  source_file text
                ) on commit drop;
                """
            )

            cur.executemany(
                """
                insert into tmp_state_legislators_sync (
                  legislator_key,
                  source_person_id,
                  seat_key,
                  state,
                  chamber,
                  district,
                  name,
                  title,
                  party,
                  website,
                  phone,
                  source_file
                ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        row.legislator_key,
                        row.source_person_id,
                        row.seat_key,
                        row.state,
                        row.chamber,
                        row.district,
                        row.name,
                        row.title,
                        row.party,
                        row.website,
                        row.phone,
                        row.source_file,
                    )
                    for row in rows
                ],
            )

            cur.execute(
                """
                insert into public.state_legislators_current (
                  legislator_key,
                  source_person_id,
                  seat_key,
                  state,
                  chamber,
                  district,
                  name,
                  title,
                  party,
                  website,
                  phone,
                  source_file,
                  source_snapshot_url,
                  source_snapshot_as_of,
                  last_synced_at,
                  updated_at
                )
                select
                  t.legislator_key,
                  t.source_person_id,
                  t.seat_key,
                  t.state,
                  t.chamber,
                  t.district,
                  t.name,
                  t.title,
                  t.party,
                  t.website,
                  t.phone,
                  t.source_file,
                  %s,
                  %s,
                  %s,
                  %s
                from tmp_state_legislators_sync t
                on conflict (legislator_key) do update set
                  source_person_id = excluded.source_person_id,
                  seat_key = excluded.seat_key,
                  state = excluded.state,
                  chamber = excluded.chamber,
                  district = excluded.district,
                  name = excluded.name,
                  title = excluded.title,
                  party = excluded.party,
                  website = excluded.website,
                  phone = excluded.phone,
                  source_file = excluded.source_file,
                  source_snapshot_url = excluded.source_snapshot_url,
                  source_snapshot_as_of = excluded.source_snapshot_as_of,
                  last_synced_at = excluded.last_synced_at,
                  updated_at = excluded.updated_at;
                """,
                (source_url, source_as_of, sync_started_at, sync_started_at),
            )

            cur.execute("select count(*) from tmp_state_legislators_sync")
            upserted = int(cur.fetchone()[0])

            deleted = 0
            if prune_scope == "all":
                cur.execute(
                    """
                    with deleted as (
                      delete from public.state_legislators_current dst
                      where not exists (
                        select 1
                        from tmp_state_legislators_sync src
                        where src.legislator_key = dst.legislator_key
                      )
                      returning 1
                    )
                    select count(*) from deleted;
                    """
                )
                deleted = int(cur.fetchone()[0])
            elif prune_scope == "included_states":
                included_states = sorted({row.state for row in rows})
                cur.execute(
                    """
                    with deleted as (
                      delete from public.state_legislators_current dst
                      where dst.state = any(%s)
                        and not exists (
                          select 1
                          from tmp_state_legislators_sync src
                          where src.legislator_key = dst.legislator_key
                        )
                      returning 1
                    )
                    select count(*) from deleted;
                    """,
                    (included_states,),
                )
                deleted = int(cur.fetchone()[0])

            cur.execute("select count(*) from public.state_legislators_current")
            final_count = int(cur.fetchone()[0])

            conn.commit()

    return upserted, deleted, final_count


def main() -> None:
    args = parse_args()
    meta, rows = load_rows(args.input)

    print(f"Loaded {len(rows)} normalized rows from {args.input}")

    if args.dry_run:
        print("Dry run complete. No database writes were made.")
        return

    upserted, deleted, final_count = upsert_rows(
        args.database_url,
        rows,
        meta,
        args.prune_scope,
    )
    print(f"Upserted rows: {upserted}")
    print(f"Deleted stale rows: {deleted}")
    print(f"Final table row count: {final_count}")


if __name__ == "__main__":
    main()
