#!/usr/bin/env python3
"""
Sync non-English locales in an Xcode String Catalog from English source strings.

This script is designed for build-time/CI workflows:
- Reads .xcstrings
- Detects missing/stale target locale entries
- Translates with Azure AI Translator (textType=html)
- Merges safely with human-edit protection
- Writes machine artifacts for future diffs

Safe merge behavior:
- A key in locklist is never overwritten.
- If an existing locale value differs from previous machine value, it is treated as
  human-edited and is never overwritten.
- If no previous machine artifact exists and a locale value already exists, we seed
  that value into the machine baseline and do not overwrite it in that run.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import random
import re
import sys
import tempfile
import time
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

import urllib.error
import urllib.parse
import urllib.request


class SyncError(RuntimeError):
    pass


@dataclass
class TranslatorConfig:
    endpoint: str
    key: str
    region: str
    source_locale: str
    target_locale: str
    timeout_seconds: float = 25.0
    max_attempts: int = 6


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        raise SyncError(f"JSON parse error in {path}: {exc}") from exc
    except OSError as exc:
        raise SyncError(f"Unable to read {path}: {exc}") from exc


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=str(path.parent)
    )
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


def require_xcstrings_shape(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise SyncError(".xcstrings must be a JSON object")
    strings = payload.get("strings")
    if not isinstance(strings, dict):
        raise SyncError(".xcstrings missing expected top-level 'strings' object")
    return strings


def parse_target_locales(value: str) -> List[str]:
    locales = [part.strip() for part in value.split(",") if part.strip()]
    if not locales:
        raise SyncError("target locales cannot be empty")
    return locales


def parse_locklist(payload: Any) -> Tuple[Set[str], Dict[str, Set[str]]]:
    """
    Supported locklist formats:
    1) ["key1", "key2"]                                  # global
    2) {"keys": ["key1", "key2"]}                        # global
    3) {"global": ["k1"], "locales": {"es": ["k2"]}}     # scoped
    4) {"key1": true, "key2": false}                     # global boolean map
    """
    if payload is None:
        return set(), {}

    if isinstance(payload, list):
        return {str(k) for k in payload}, {}

    if not isinstance(payload, dict):
        raise SyncError("locklist must be an array or object")

    if "global" in payload or "locales" in payload:
        global_set: Set[str] = set()
        locales_map: Dict[str, Set[str]] = {}

        if "global" in payload:
            g = payload["global"]
            if not isinstance(g, list):
                raise SyncError("locklist.global must be an array")
            global_set = {str(k) for k in g}

        if "locales" in payload:
            l = payload["locales"]
            if not isinstance(l, dict):
                raise SyncError("locklist.locales must be an object")
            for locale, keys in l.items():
                if not isinstance(keys, list):
                    raise SyncError(f"locklist.locales.{locale} must be an array")
                locales_map[str(locale)] = {str(k) for k in keys}
        return global_set, locales_map

    if "keys" in payload:
        keys = payload["keys"]
        if not isinstance(keys, list):
            raise SyncError("locklist.keys must be an array")
        return {str(k) for k in keys}, {}

    return {str(k) for k, v in payload.items() if bool(v)}, {}


def is_locked(
    key: str, locale: str, global_lock: Set[str], locale_lock: Dict[str, Set[str]]
) -> bool:
    if key in global_lock:
        return True
    return key in locale_lock.get(locale, set())


def get_locale_value(entry: Dict[str, Any], locale: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (value, reason_if_unreadable).
    reason_if_unreadable is non-None for unsupported locale shape.
    """
    localizations = entry.get("localizations")
    if localizations is None:
        return None, None
    if not isinstance(localizations, dict):
        return None, "bad_localizations_shape"

    loc = localizations.get(locale)
    if loc is None:
        return None, None
    if not isinstance(loc, dict):
        return None, "bad_locale_shape"

    string_unit = loc.get("stringUnit")
    if string_unit is None:
        return None, "unsupported_locale_structure"
    if not isinstance(string_unit, dict):
        return None, "bad_locale_string_unit_shape"

    value = string_unit.get("value")
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, "bad_locale_value_type"
    return value, None


def can_create_locale_string_unit(entry: Dict[str, Any]) -> bool:
    """
    Only create locale stringUnit when at least one existing localization uses stringUnit.
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


def set_locale_value(entry: Dict[str, Any], locale: str, value: str) -> Optional[str]:
    """
    Sets locale value, returns None on success or reason string on skip.
    """
    localizations = entry.get("localizations")
    if localizations is None:
        entry["localizations"] = {
            locale: {"stringUnit": {"state": "translated", "value": value}}
        }
        return None
    if not isinstance(localizations, dict):
        return "bad_localizations_shape"

    loc = localizations.get(locale)
    if loc is None:
        if not can_create_locale_string_unit(entry):
            return "unsupported_entry_structure"
        localizations[locale] = {"stringUnit": {"state": "translated", "value": value}}
        return None
    if not isinstance(loc, dict):
        return "bad_locale_shape"

    string_unit = loc.get("stringUnit")
    if string_unit is None:
        return "unsupported_locale_structure"
    if not isinstance(string_unit, dict):
        return "bad_locale_string_unit_shape"

    string_unit["state"] = "translated"
    string_unit["value"] = value
    return None


def parse_machine_map(payload: Any, label: str) -> Dict[str, Dict[str, str]]:
    """
    Output shape:
      key -> {"target": "...", "sourceHash": "..."}

    Accepted inputs:
    1) {"translations": {"key": {"target": "...", "sourceHash": "..."}}}
    2) {"translations": {"key": "..."}}
    3) {"key": "..."} raw map
    """
    if payload is None:
        return {}

    if not isinstance(payload, dict):
        raise SyncError(f"{label} must be a JSON object")

    candidate = payload.get("translations", payload)
    if not isinstance(candidate, dict):
        raise SyncError(f"{label} must contain an object map")

    out: Dict[str, Dict[str, str]] = {}
    for key, value in candidate.items():
        if isinstance(value, str):
            out[str(key)] = {"target": value}
            continue
        if isinstance(value, dict):
            target = value.get("target")
            if isinstance(target, str):
                row = {"target": target}
                source_hash = value.get("sourceHash")
                if isinstance(source_hash, str):
                    row["sourceHash"] = source_hash
                out[str(key)] = row
                continue
        raise SyncError(f"{label} has unsupported value for key '{key}'")
    return out


def machine_artifact_path(machine_dir: Path, catalog_name: str, locale: str) -> Path:
    return machine_dir / f"{catalog_name}.{locale}.machine.json"


def parse_cache(payload: Any) -> Dict[str, str]:
    if payload is None:
        return {}
    if not isinstance(payload, dict):
        return {}
    entries = payload.get("entries", payload)
    if not isinstance(entries, dict):
        return {}

    out: Dict[str, str] = {}
    for key, value in entries.items():
        if isinstance(value, str):
            out[str(key)] = value
        elif isinstance(value, dict):
            translated = value.get("translated")
            if isinstance(translated, str):
                out[str(key)] = translated
    return out


def format_cache(entries: Dict[str, str]) -> Dict[str, Any]:
    return {
        "version": 1,
        "updatedAt": _utc_now_iso(),
        "entries": {k: {"translated": v} for k, v in entries.items()},
    }


# Protect segments from translation.
TOKEN_RE = re.compile(r"\[\[[^\[\]]+\]\]")
URL_RE = re.compile(r"\bhttps?://[^\s<>\"]+")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(
    r"(?<!\w)(?:\+?\d{1,2}[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}(?!\w)"
)
DISTRICT_ID_RE = re.compile(r"\b[A-Z]{2}-\d{1,2}\b")
DISTRICT_LABEL_RE = re.compile(r"\bDistrict\s+\d+\b", re.IGNORECASE)
ZIP_RE = re.compile(r"\b\d{5}(?:-\d{4})?\b")
NUMERIC_RE = re.compile(r"(?<!\w)\d+(?!\w)")
FORMAT_RE = re.compile(r"%(?:\d+\$)?(?:\.\d+)?[@dfsu]|%%")

EXISTING_NOTRANSLATE_BLOCK_RE = re.compile(
    r"<(?P<tag>span|div)\b[^>]*(?:class=['\"][^'\"]*notranslate[^'\"]*['\"]|translate=['\"]no['\"])[^>]*>.*?</(?P=tag)>",
    re.IGNORECASE | re.DOTALL,
)

PROTECTION_PATTERNS: Sequence[re.Pattern[str]] = (
    TOKEN_RE,
    URL_RE,
    EMAIL_RE,
    PHONE_RE,
    DISTRICT_ID_RE,
    DISTRICT_LABEL_RE,
    ZIP_RE,
    FORMAT_RE,
    NUMERIC_RE,
)


def _protect_existing_notranslate_blocks(text: str) -> Tuple[str, Dict[str, str]]:
    mapping: Dict[str, str] = {}

    def repl(match: re.Match[str]) -> str:
        placeholder = f"__EXISTING_NOTRANSLATE_{len(mapping)}__"
        mapping[placeholder] = match.group(0)
        return placeholder

    return EXISTING_NOTRANSLATE_BLOCK_RE.sub(repl, text), mapping


def _restore_existing_notranslate_blocks(text: str, mapping: Dict[str, str]) -> str:
    for placeholder, original in mapping.items():
        text = text.replace(placeholder, original)
    return text


def protect_segments_for_translation(text: str) -> str:
    masked, existing_map = _protect_existing_notranslate_blocks(text)
    protected_map: Dict[str, str] = {}

    def mark_match(literal: str) -> str:
        placeholder = f"__PROTECTED_{len(protected_map)}__"
        protected_map[placeholder] = literal
        return placeholder

    working = masked
    for pattern in PROTECTION_PATTERNS:
        working = pattern.sub(lambda m: mark_match(m.group(0)), working)

    for placeholder, literal in protected_map.items():
        wrapped = (
            '<span class="notranslate" data-votenow-protect="1">'
            f"{literal}"
            "</span>"
        )
        working = working.replace(placeholder, wrapped)

    return _restore_existing_notranslate_blocks(working, existing_map)


def strip_pipeline_wrappers(translated_html: str) -> str:
    text = translated_html.strip()
    outer = re.fullmatch(r"<div>(.*)</div>", text, flags=re.DOTALL | re.IGNORECASE)
    if outer:
        text = outer.group(1)

    text = re.sub(
        r"<span\b[^>]*data-votenow-protect=['\"]1['\"][^>]*>(.*?)</span>",
        r"\1",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return html.unescape(text).strip()


def azure_translate_html_batch(html_texts: List[str], cfg: TranslatorConfig) -> List[str]:
    if not html_texts:
        return []

    query = urllib.parse.urlencode(
        {
            "api-version": "3.0",
            "from": cfg.source_locale,
            "to": cfg.target_locale,
            "textType": "html",
        }
    )
    url = f"{cfg.endpoint.rstrip('/')}/translate?{query}"
    headers = {
        "Ocp-Apim-Subscription-Key": cfg.key,
        "Ocp-Apim-Subscription-Region": cfg.region,
        "Content-Type": "application/json; charset=UTF-8",
    }
    payload_bytes = json.dumps([{"text": t} for t in html_texts]).encode("utf-8")

    attempt = 0
    while True:
        attempt += 1
        status_code = None
        resp_headers: Dict[str, str] = {}
        body_text = ""
        try:
            req = urllib.request.Request(url=url, data=payload_bytes, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=cfg.timeout_seconds) as resp:
                status_code = resp.getcode()
                resp_headers = dict(resp.headers.items())
                body_text = resp.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            status_code = exc.code
            resp_headers = dict(exc.headers.items()) if exc.headers else {}
            body_text = exc.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if attempt >= cfg.max_attempts:
                raise SyncError(f"Network error calling Azure Translator: {exc}") from exc
            sleep_s = min(30.0, (2 ** (attempt - 1)) + random.uniform(0, 0.75))
            time.sleep(sleep_s)
            continue

        if status_code == 200:
            try:
                body = json.loads(body_text)
                return [row["translations"][0]["text"] for row in body]
            except Exception as exc:
                raise SyncError(f"Unexpected Azure response shape: {body_text}") from exc

        if status_code in (429, 500, 502, 503, 504):
            if attempt >= cfg.max_attempts:
                raise SyncError(f"Azure Translator failed after retries ({status_code}): {body_text}")
            retry_after = resp_headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                sleep_s = float(retry_after)
            else:
                sleep_s = min(30.0, (2 ** (attempt - 1)) + random.uniform(0, 0.75))
            time.sleep(sleep_s)
            continue

        raise SyncError(f"Azure Translator non-retriable error ({status_code}): {body_text}")


def chunk_list(items: Sequence[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), size):
        yield list(items[i : i + size])


def translate_texts(
    texts: Sequence[str],
    cfg: TranslatorConfig,
    cache_entries: Dict[str, str],
    batch_size: int,
) -> Dict[str, str]:
    """
    Returns source_text -> translated_text
    """
    unique_texts = sorted(set(texts))
    resolved: Dict[str, str] = {}
    pending: List[str] = []

    for source_text in unique_texts:
        cache_key = _sha256(
            json.dumps(
                {
                    "from": cfg.source_locale,
                    "to": cfg.target_locale,
                    "text": source_text,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        cached = cache_entries.get(cache_key)
        if cached is not None:
            resolved[source_text] = cached
        else:
            pending.append(source_text)

    for group in chunk_list(pending, size=max(1, batch_size)):
        html_batch = [f"<div>{protect_segments_for_translation(text)}</div>" for text in group]
        translated_html = azure_translate_html_batch(html_batch, cfg)
        if len(translated_html) != len(group):
            raise SyncError("Azure response size mismatch")

        for source_text, target_html in zip(group, translated_html):
            target_text = strip_pipeline_wrappers(target_html)
            if not target_text:
                raise SyncError(
                    "Azure Translator returned empty translation for source text: "
                    f"{source_text!r}"
                )
            resolved[source_text] = target_text
            cache_key = _sha256(
                json.dumps(
                    {
                        "from": cfg.source_locale,
                        "to": cfg.target_locale,
                        "text": source_text,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
            )
            cache_entries[cache_key] = target_text

    return resolved


def collect_source_strings(strings: Dict[str, Any], source_locale: str) -> Dict[str, str]:
    source_map: Dict[str, str] = {}
    for key, entry in strings.items():
        if not isinstance(entry, dict):
            continue
        source_value, read_reason = get_locale_value(entry, source_locale)
        if read_reason is not None:
            continue
        if source_value is None:
            continue
        source_map[key] = source_value
    return source_map


def sync_locale(
    *,
    strings: Dict[str, Any],
    source_map: Dict[str, str],
    locale: str,
    source_locale: str,
    translator_cfg: Optional[TranslatorConfig],
    cache_entries: Dict[str, str],
    prev_machine: Dict[str, Dict[str, str]],
    global_lock: Set[str],
    locale_lock: Dict[str, Set[str]],
    batch_size: int,
    dry_run: bool,
) -> Tuple[Counter[str], Dict[str, Dict[str, str]]]:
    """
    Returns (stats, machine_artifact_translations)
    """
    stats: Counter[str] = Counter()
    pending_by_key: Dict[str, str] = {}
    machine_out: Dict[str, Dict[str, str]] = {}

    for key, source_text in source_map.items():
        if is_locked(key, locale, global_lock, locale_lock):
            stats["skipped_locklist"] += 1
            existing, _ = get_locale_value(strings[key], locale)
            if isinstance(existing, str):
                machine_out[key] = {
                    "source": source_text,
                    "target": existing,
                    "sourceHash": _sha256(source_text),
                    "status": "locked_existing",
                }
            continue

        entry = strings[key]
        existing, read_reason = get_locale_value(entry, locale)
        if read_reason:
            stats[f"skipped_{read_reason}"] += 1
            continue

        prev = prev_machine.get(key, {})
        prev_target = prev.get("target")
        prev_hash = prev.get("sourceHash")
        source_hash = _sha256(source_text)

        if existing is not None and prev_target is not None and existing != prev_target:
            stats["skipped_human_edited"] += 1
            machine_out[key] = {
                "source": source_text,
                "target": existing,
                "sourceHash": source_hash,
                "status": "human_edited",
            }
            continue

        # Bootstrap baseline for existing values when no previous machine exists.
        if existing is not None and prev_target is None:
            stats["seeded_existing_baseline"] += 1
            machine_out[key] = {
                "source": source_text,
                "target": existing,
                "sourceHash": source_hash,
                "status": "seeded_existing",
            }
            continue

        # Missing locale value but previous machine value exists for same source hash.
        if existing is None and prev_target is not None and prev_hash == source_hash:
            set_reason = set_locale_value(entry, locale, prev_target)
            if set_reason:
                stats[f"skipped_{set_reason}"] += 1
            else:
                stats["updated_from_prev_machine"] += 1
            machine_out[key] = {
                "source": source_text,
                "target": prev_target,
                "sourceHash": source_hash,
                "status": "updated_from_prev_machine",
            }
            continue

        # Up-to-date machine-managed value.
        if (
            existing is not None
            and prev_target is not None
            and existing == prev_target
            and prev_hash == source_hash
        ):
            stats["skipped_up_to_date"] += 1
            machine_out[key] = {
                "source": source_text,
                "target": existing,
                "sourceHash": source_hash,
                "status": "up_to_date",
            }
            continue

        # Needs translation:
        # - missing value
        # - existing == prev machine but source changed
        # - existing missing and prev missing
        pending_by_key[key] = source_text

    if pending_by_key:
        if dry_run:
            stats["pending_translation_dry_run"] += len(pending_by_key)
        else:
            if translator_cfg is None:
                raise SyncError(
                    f"Locale {locale}: {len(pending_by_key)} keys need translation but Azure config is missing"
                )
            translated_by_source = translate_texts(
                list(pending_by_key.values()),
                cfg=translator_cfg,
                cache_entries=cache_entries,
                batch_size=batch_size,
            )

            for key, source_text in pending_by_key.items():
                target_text = translated_by_source[source_text]
                set_reason = set_locale_value(strings[key], locale, target_text)
                if set_reason:
                    stats[f"skipped_{set_reason}"] += 1
                    continue
                stats["updated_translated"] += 1
                machine_out[key] = {
                    "source": source_text,
                    "target": target_text,
                    "sourceHash": _sha256(source_text),
                    "status": "machine_translated",
                }

    # Ensure machine output contains seeded/up-to-date keys that were not in pending.
    for key, source_text in source_map.items():
        if key in machine_out:
            continue
        existing, _ = get_locale_value(strings[key], locale)
        if isinstance(existing, str):
            machine_out[key] = {
                "source": source_text,
                "target": existing,
                "sourceHash": _sha256(source_text),
                "status": "existing",
            }

    return stats, machine_out


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync xcstrings locales from English source with Azure Translator"
    )
    parser.add_argument("--xcstrings", required=True, help="Path to .xcstrings file")
    parser.add_argument("--source-locale", default="en", help="Source locale (default: en)")
    parser.add_argument(
        "--target-locales",
        default="es,zh-Hans,fil,vi",
        help="Comma-separated target locales (default: es,zh-Hans,fil,vi)",
    )
    parser.add_argument(
        "--out",
        help="Output .xcstrings path (default: overwrite --xcstrings)",
    )
    parser.add_argument(
        "--locklist",
        help="Optional locklist JSON path",
    )
    parser.add_argument(
        "--machine-dir",
        default=".l10n_machine",
        help="Machine artifact directory (default: .l10n_machine)",
    )
    parser.add_argument(
        "--cache",
        default=".cache/l10n_azure_cache.json",
        help="Translation cache JSON path (default: .cache/l10n_azure_cache.json)",
    )
    parser.add_argument(
        "--endpoint",
        default=os.getenv("AZURE_TRANSLATOR_ENDPOINT", ""),
        help="Azure Translator endpoint (or AZURE_TRANSLATOR_ENDPOINT)",
    )
    parser.add_argument(
        "--key",
        default=os.getenv("AZURE_TRANSLATOR_KEY", ""),
        help="Azure Translator subscription key (or AZURE_TRANSLATOR_KEY)",
    )
    parser.add_argument(
        "--region",
        default=os.getenv("AZURE_TRANSLATOR_REGION", ""),
        help="Azure Translator region (or AZURE_TRANSLATOR_REGION)",
    )
    parser.add_argument("--batch-size", type=int, default=25, help="Batch size for API calls")
    parser.add_argument("--dry-run", action="store_true", help="Do not write outputs")
    return parser.parse_args(argv)


def main(argv: Sequence[str]) -> int:
    args = parse_args(argv)
    try:
        xcstrings_path = Path(args.xcstrings)
        out_path = Path(args.out) if args.out else xcstrings_path
        machine_dir = Path(args.machine_dir)
        cache_path = Path(args.cache)
        target_locales = parse_target_locales(args.target_locales)

        xc_payload = load_json(xcstrings_path)
        strings = require_xcstrings_shape(xc_payload)
        source_map = collect_source_strings(strings, args.source_locale)
        if not source_map:
            raise SyncError(f"No source strings found for locale '{args.source_locale}'")

        lock_payload = None
        if args.locklist:
            lock_path = Path(args.locklist)
            if lock_path.exists():
                lock_payload = load_json(lock_path)
        global_lock, locale_lock = parse_locklist(lock_payload)

        cache_payload = load_json(cache_path) if cache_path.exists() else None
        cache_entries = parse_cache(cache_payload)

        catalog_name = xcstrings_path.stem
        locale_summaries: Dict[str, Counter[str]] = {}
        machine_outputs: Dict[str, Dict[str, Dict[str, str]]] = {}

        for locale in target_locales:
            prev_path = machine_artifact_path(machine_dir, catalog_name, locale)
            prev_payload = load_json(prev_path) if prev_path.exists() else None
            prev_machine = parse_machine_map(prev_payload, label=f"prev machine ({locale})")

            translator_cfg = None
            if args.endpoint and args.key and args.region:
                translator_cfg = TranslatorConfig(
                    endpoint=args.endpoint,
                    key=args.key,
                    region=args.region,
                    source_locale=args.source_locale,
                    target_locale=locale,
                )

            stats, machine_out = sync_locale(
                strings=strings,
                source_map=source_map,
                locale=locale,
                source_locale=args.source_locale,
                translator_cfg=translator_cfg,
                cache_entries=cache_entries,
                prev_machine=prev_machine,
                global_lock=global_lock,
                locale_lock=locale_lock,
                batch_size=max(1, args.batch_size),
                dry_run=bool(args.dry_run),
            )
            locale_summaries[locale] = stats
            machine_outputs[locale] = machine_out

        if not args.dry_run:
            write_json_atomic(out_path, xc_payload)
            write_json_atomic(cache_path, format_cache(cache_entries))

            for locale in target_locales:
                machine_payload = {
                    "catalog": xcstrings_path.name,
                    "sourceLocale": args.source_locale,
                    "targetLocale": locale,
                    "generatedAt": _utc_now_iso(),
                    "generator": "sync_xcstrings_locales.py",
                    "translations": dict(sorted(machine_outputs[locale].items())),
                }
                machine_path = machine_artifact_path(machine_dir, catalog_name, locale)
                write_json_atomic(machine_path, machine_payload)

        print("Locale sync complete")
        print(f"- xcstrings: {xcstrings_path}")
        print(f"- output: {out_path}")
        print(f"- source locale: {args.source_locale}")
        print(f"- target locales: {', '.join(target_locales)}")
        print(f"- source keys scanned: {len(source_map)}")
        print(f"- dry run: {bool(args.dry_run)}")

        for locale in target_locales:
            stats = locale_summaries[locale]
            total_updated = (
                stats.get("updated_translated", 0) + stats.get("updated_from_prev_machine", 0)
            )
            print(f"\n[{locale}]")
            print(f"- updated: {total_updated}")
            for reason, count in sorted(stats.items()):
                print(f"- {reason}: {count}")

        return 0
    except SyncError as exc:
        print(f"sync_xcstrings_locales.py failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"sync_xcstrings_locales.py unexpected failure: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
