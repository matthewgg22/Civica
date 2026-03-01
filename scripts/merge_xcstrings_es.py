#!/usr/bin/env python3
"""
Safely merge Spanish machine translations into an Xcode String Catalog (.xcstrings).

Rules:
- Only touches "es" locale entries for keys present in machine artifact.
- Never overwrite if key is locklisted.
- If --prev-machine is provided:
  - Never overwrite if existing es value differs from prev-machine value (human-edited).
  - If existing es exists but key has no prev baseline, skip.
- If --prev-machine is not provided:
  - Only fill missing es entries; never overwrite existing es.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple


class MergeError(RuntimeError):
    pass


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        raise MergeError(f"JSON parse error in {path}: {exc}") from exc
    except OSError as exc:
        raise MergeError(f"Unable to read {path}: {exc}") from exc


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp:
            json.dump(payload, tmp, ensure_ascii=False, indent=2)
            tmp.write("\n")
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def parse_machine_map(payload: Any, label: str) -> Dict[str, str]:
    """
    Accepts:
    1) {"translations": {"key": {"target": "..."}}}
    2) {"translations": {"key": "..."}}
    3) {"key": "..."} raw map
    """
    if not isinstance(payload, dict):
        raise MergeError(f"{label} must be a JSON object")

    candidate = payload.get("translations", payload)
    if not isinstance(candidate, dict):
        raise MergeError(f"{label} must contain an object map")

    out: Dict[str, str] = {}
    for key, value in candidate.items():
        if isinstance(value, str):
            out[key] = value
            continue
        if isinstance(value, dict):
            target = value.get("target")
            if isinstance(target, str):
                out[key] = target
                continue
        raise MergeError(f"{label} has unsupported value for key '{key}'")
    return out


def parse_locklist(payload: Any) -> Set[str]:
    """
    Accepts:
    1) ["key1", "key2"]
    2) {"keys": ["key1", "key2"]}
    3) {"key1": true, "key2": false}
    """
    if payload is None:
        return set()

    if isinstance(payload, list):
        return {str(k) for k in payload}

    if isinstance(payload, dict):
        if "keys" in payload:
            keys = payload["keys"]
            if not isinstance(keys, list):
                raise MergeError("locklist 'keys' must be an array")
            return {str(k) for k in keys}
        return {str(k) for k, v in payload.items() if bool(v)}

    raise MergeError("locklist must be a JSON array or object")


def require_xcstrings_shape(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise MergeError(".xcstrings must be a JSON object")
    strings = payload.get("strings")
    if not isinstance(strings, dict):
        raise MergeError(".xcstrings missing expected top-level 'strings' object")
    return strings


def get_es_value(entry: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (value, reason_if_unreadable).
    reason_if_unreadable is non-None for unsupported es shape.
    """
    localizations = entry.get("localizations")
    if localizations is None:
        return None, None
    if not isinstance(localizations, dict):
        return None, "bad_localizations_shape"

    es_loc = localizations.get("es")
    if es_loc is None:
        return None, None
    if not isinstance(es_loc, dict):
        return None, "bad_es_shape"

    string_unit = es_loc.get("stringUnit")
    if string_unit is None:
        return None, "unsupported_es_structure"
    if not isinstance(string_unit, dict):
        return None, "bad_es_string_unit_shape"

    value = string_unit.get("value")
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, "bad_es_value_type"
    return value, None


def can_create_es_string_unit(entry: Dict[str, Any]) -> bool:
    """
    Only create es stringUnit when at least one existing localization uses stringUnit.
    Avoids breaking variant/plural entries.
    """
    localizations = entry.get("localizations")
    if localizations is None:
        return True
    if not isinstance(localizations, dict):
        return False
    for loc in localizations.values():
        if isinstance(loc, dict) and isinstance(loc.get("stringUnit"), dict):
            return True
    return False


def set_es_value(entry: Dict[str, Any], value: str) -> Optional[str]:
    """
    Sets es value, returns None on success or reason string on skip.
    """
    localizations = entry.get("localizations")
    if localizations is None:
        entry["localizations"] = {"es": {"stringUnit": {"state": "translated", "value": value}}}
        return None
    if not isinstance(localizations, dict):
        return "bad_localizations_shape"

    es_loc = localizations.get("es")
    if es_loc is None:
        if not can_create_es_string_unit(entry):
            return "unsupported_entry_structure"
        localizations["es"] = {"stringUnit": {"state": "translated", "value": value}}
        return None
    if not isinstance(es_loc, dict):
        return "bad_es_shape"

    string_unit = es_loc.get("stringUnit")
    if string_unit is None:
        return "unsupported_es_structure"
    if not isinstance(string_unit, dict):
        return "bad_es_string_unit_shape"

    string_unit["state"] = "translated"
    string_unit["value"] = value
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge Spanish machine strings into .xcstrings safely")
    parser.add_argument("--xcstrings", required=True, help="Path to MyInfoPanel.xcstrings")
    parser.add_argument("--machine", required=True, help="Path to machine artifact JSON")
    parser.add_argument("--prev-machine", help="Path to previous machine artifact JSON")
    parser.add_argument("--locklist", help="Path to locklist JSON")
    parser.add_argument("--out", help="Output path (default: overwrite --xcstrings)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        xcstrings_path = Path(args.xcstrings)
        machine_path = Path(args.machine)
        prev_machine_path = Path(args.prev_machine) if args.prev_machine else None
        locklist_path = Path(args.locklist) if args.locklist else None
        out_path = Path(args.out) if args.out else xcstrings_path

        xc_payload = load_json(xcstrings_path)
        machine_payload = load_json(machine_path)
        prev_machine_payload = load_json(prev_machine_path) if prev_machine_path else None
        lock_payload = load_json(locklist_path) if locklist_path else None

        strings = require_xcstrings_shape(xc_payload)
        machine_map = parse_machine_map(machine_payload, label="machine artifact")
        prev_map = parse_machine_map(prev_machine_payload, label="prev-machine artifact") if prev_machine_payload else {}
        lockset = parse_locklist(lock_payload)

        updated_count = 0
        missing_count = 0
        missing_keys = []
        skipped: Counter[str] = Counter()
        skipped_keys: Dict[str, str] = {}

        for key, machine_es in machine_map.items():
            if key not in strings:
                missing_count += 1
                missing_keys.append(key)
                continue

            if key in lockset:
                skipped["locklist"] += 1
                skipped_keys[key] = "locklist"
                continue

            entry = strings[key]
            if not isinstance(entry, dict):
                raise MergeError(f"Unexpected entry shape at strings['{key}']")

            existing_es, es_read_reason = get_es_value(entry)
            if es_read_reason:
                skipped[es_read_reason] += 1
                skipped_keys[key] = es_read_reason
                continue

            if prev_machine_payload is None:
                if existing_es is not None:
                    skipped["existing_es_no_prev_machine"] += 1
                    skipped_keys[key] = "existing_es_no_prev_machine"
                    continue
            else:
                if existing_es is not None:
                    prev_value = prev_map.get(key)
                    if prev_value is None:
                        skipped["existing_es_no_prev_baseline"] += 1
                        skipped_keys[key] = "existing_es_no_prev_baseline"
                        continue
                    if existing_es != prev_value:
                        skipped["human_edited_diff_prev"] += 1
                        skipped_keys[key] = "human_edited_diff_prev"
                        continue

            if existing_es == machine_es:
                skipped["already_up_to_date"] += 1
                skipped_keys[key] = "already_up_to_date"
                continue

            set_reason = set_es_value(entry, machine_es)
            if set_reason:
                skipped[set_reason] += 1
                skipped_keys[key] = set_reason
                continue

            updated_count += 1

        write_json_atomic(out_path, xc_payload)

        total_machine_keys = len(machine_map)
        total_skipped = sum(skipped.values())
        print("Merge complete")
        print(f"- xcstrings: {xcstrings_path}")
        print(f"- output: {out_path}")
        print(f"- machine keys: {total_machine_keys}")
        print(f"- updated: {updated_count}")
        print(f"- skipped: {total_skipped}")
        if skipped:
            print("  skipped reasons:")
            for reason, count in sorted(skipped.items()):
                print(f"  - {reason}: {count}")
        print(f"- missing keys in xcstrings: {missing_count}")

        if missing_keys:
            preview = ", ".join(missing_keys[:20])
            suffix = "" if len(missing_keys) <= 20 else " ..."
            print(f"  missing sample: {preview}{suffix}")

        return 0
    except MergeError as exc:
        print(f"merge_xcstrings_es.py failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"merge_xcstrings_es.py unexpected failure: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

