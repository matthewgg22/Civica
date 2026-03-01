#!/usr/bin/env python3
"""
Build-time translation pipeline for VoteNow MyInfoPanel strings (en -> es).

Features:
- Uses Azure AI Translator Text API v3.0
- Protects non-translatable segments using HTML notranslate tags
- Caches translations to reduce API calls
- Retries with exponential backoff on transient failures / rate limits
- Emits an import/merge artifact for String Catalog workflows

Input format (JSON):
{
  "table": "MyInfoPanel",
  "sourceLocale": "en",
  "targetLocale": "es",
  "strings": {
    "my_info.key": "English text"
  }
}

Output format (JSON):
{
  "table": "MyInfoPanel",
  "sourceLocale": "en",
  "targetLocale": "es",
  "generatedAt": "...",
  "generator": "azure-ai-translator",
  "translations": {
    "my_info.key": {
      "source": "English text",
      "target": "Spanish text",
      "status": "machine_translated",
      "sourceHash": "..."
    }
  }
}
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
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import urllib.error
import urllib.parse
import urllib.request


# Regex patterns for content that must not be translated.
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

# Preserve already-tagged "do not translate" blocks from source.
EXISTING_NOTRANSLATE_BLOCK_RE = re.compile(
    r"<(?P<tag>span|div)\b[^>]*(?:class=['\"][^'\"]*notranslate[^'\"]*['\"]|translate=['\"]no['\"])[^>]*>.*?</(?P=tag)>",
    re.IGNORECASE | re.DOTALL,
)

PROTECTION_PATTERNS: List[re.Pattern[str]] = [
    TOKEN_RE,
    URL_RE,
    EMAIL_RE,
    PHONE_RE,
    DISTRICT_ID_RE,
    DISTRICT_LABEL_RE,
    ZIP_RE,
    NUMERIC_RE,
]


@dataclass
class TranslatorConfig:
    endpoint: str
    key: str
    region: str
    source_locale: str
    target_locale: str
    timeout_seconds: float = 20.0
    max_attempts: int = 6


class TranslationError(RuntimeError):
    pass


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def _load_cache(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return _load_json(path)
    except Exception:
        # If cache is corrupted, fail open with empty cache.
        return {}


def _save_cache(path: Path, payload: dict) -> None:
    _write_json(path, payload)


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


def _protect_segments_for_translation(text: str) -> str:
    """
    Wrap protected segments in notranslate spans.
    Existing notranslate blocks in source are preserved as-is.
    """
    masked, existing_map = _protect_existing_notranslate_blocks(text)

    # Replace protected segments with placeholders first to avoid nested replacements.
    protected_map: Dict[str, str] = {}

    def mark_match(literal: str) -> str:
        placeholder = f"__PROTECTED_{len(protected_map)}__"
        protected_map[placeholder] = literal
        return placeholder

    working = masked
    for pattern in PROTECTION_PATTERNS:
        working = pattern.sub(lambda m: mark_match(m.group(0)), working)

    # Use our own marker to safely remove only wrappers we inserted.
    for placeholder, literal in protected_map.items():
        escaped_literal = literal
        wrapped = (
            '<span class="notranslate" data-votenow-protect="1">'
            f"{escaped_literal}"
            "</span>"
        )
        working = working.replace(placeholder, wrapped)

    working = _restore_existing_notranslate_blocks(working, existing_map)
    return working


def _strip_pipeline_wrappers(translated_html: str) -> str:
    # Remove outer div wrapper if present.
    text = translated_html.strip()
    outer = re.fullmatch(r"<div>(.*)</div>", text, flags=re.DOTALL | re.IGNORECASE)
    if outer:
        text = outer.group(1)

    # Remove only wrappers inserted by this pipeline.
    text = re.sub(
        r"<span\b[^>]*data-votenow-protect=['\"]1['\"][^>]*>(.*?)</span>",
        r"\1",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    return html.unescape(text).strip()


def _azure_translate_html(
    html_texts: List[str], cfg: TranslatorConfig
) -> List[str]:
    """
    Batch translate HTML texts with safe retries.
    Returns translated HTML strings in source order.
    """
    if not html_texts:
        return []

    base = cfg.endpoint.rstrip("/")
    query = urllib.parse.urlencode(
        {
            "api-version": "3.0",
            "from": cfg.source_locale,
            "to": cfg.target_locale,
            "textType": "html",
        }
    )
    url = f"{base}/translate?{query}"
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
            req = urllib.request.Request(
                url=url,
                data=payload_bytes,
                headers=headers,
                method="POST",
            )
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
                raise TranslationError(f"Network error calling Azure Translator: {exc}") from exc
            sleep_s = min(30.0, (2 ** (attempt - 1)) + random.uniform(0, 0.75))
            time.sleep(sleep_s)
            continue

        if status_code == 200:
            try:
                body = json.loads(body_text)
                return [row["translations"][0]["text"] for row in body]
            except Exception as exc:
                raise TranslationError(f"Unexpected Azure response shape: {body_text}") from exc

        if status_code in (429, 500, 502, 503, 504):
            if attempt >= cfg.max_attempts:
                raise TranslationError(
                    f"Azure Translator failed after retries ({status_code}): {body_text}"
                )
            retry_after = resp_headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                sleep_s = float(retry_after)
            else:
                sleep_s = min(30.0, (2 ** (attempt - 1)) + random.uniform(0, 0.75))
            time.sleep(sleep_s)
            continue

        raise TranslationError(
            f"Azure Translator non-retriable error ({status_code}): {body_text}"
        )


def _chunk(items: List[Tuple[str, str]], size: int) -> Iterable[List[Tuple[str, str]]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def translate_payload(
    source_payload: dict,
    cfg: TranslatorConfig,
    cache_path: Path,
    batch_size: int = 25,
) -> dict:
    table = source_payload.get("table")
    source_locale = source_payload.get("sourceLocale")
    target_locale = source_payload.get("targetLocale")
    strings = source_payload.get("strings", {})

    if table != "MyInfoPanel":
        raise ValueError(f"Expected table 'MyInfoPanel', got: {table!r}")
    if source_locale != cfg.source_locale:
        raise ValueError(f"Source locale mismatch: payload={source_locale}, cfg={cfg.source_locale}")
    if target_locale != cfg.target_locale:
        raise ValueError(f"Target locale mismatch: payload={target_locale}, cfg={cfg.target_locale}")
    if not isinstance(strings, dict):
        raise ValueError("payload.strings must be a dictionary")

    cache = _load_cache(cache_path)
    cache.setdefault("entries", {})
    entries: Dict[str, str] = cache["entries"]

    pending: List[Tuple[str, str]] = []
    results: Dict[str, dict] = {}

    # Decide cache hits first.
    for key, source_text in strings.items():
        source_text = str(source_text)
        cache_key = _sha256(
            json.dumps(
                {
                    "table": table,
                    "from": cfg.source_locale,
                    "to": cfg.target_locale,
                    "key": key,
                    "text": source_text,
                },
                sort_keys=True,
                ensure_ascii=False,
            )
        )

        cached_target = entries.get(cache_key)
        if cached_target:
            results[key] = {
                "source": source_text,
                "target": cached_target,
                "status": "machine_translated_cached",
                "sourceHash": _sha256(source_text),
            }
        else:
            pending.append((key, source_text))

    for group in _chunk(pending, size=batch_size):
        html_batch: List[str] = []
        batch_meta: List[Tuple[str, str, str]] = []  # key, source, cache_key

        for key, source_text in group:
            protected = _protect_segments_for_translation(source_text)
            wrapped = f"<div>{protected}</div>"
            html_batch.append(wrapped)

            cache_key = _sha256(
                json.dumps(
                    {
                        "table": table,
                        "from": cfg.source_locale,
                        "to": cfg.target_locale,
                        "key": key,
                        "text": source_text,
                    },
                    sort_keys=True,
                    ensure_ascii=False,
                )
            )
            batch_meta.append((key, source_text, cache_key))

        translated_html_batch = _azure_translate_html(html_batch, cfg)
        if len(translated_html_batch) != len(batch_meta):
            raise TranslationError("Azure response size mismatch")

        for translated_html, (key, source_text, cache_key) in zip(translated_html_batch, batch_meta):
            target_text = _strip_pipeline_wrappers(translated_html)

            # Fail-safe fallback if translation is unexpectedly empty.
            if not target_text:
                target_text = source_text
                status = "fallback_source"
            else:
                status = "machine_translated"

            entries[cache_key] = target_text
            results[key] = {
                "source": source_text,
                "target": target_text,
                "status": status,
                "sourceHash": _sha256(source_text),
            }

    cache["updatedAt"] = datetime.now(timezone.utc).isoformat()
    _save_cache(cache_path, cache)

    return {
        "table": table,
        "sourceLocale": source_locale,
        "targetLocale": target_locale,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generator": "azure-ai-translator",
        "translations": dict(sorted(results.items(), key=lambda kv: kv[0])),
    }


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate MyInfoPanel en->es using Azure Translator")
    parser.add_argument("--input", required=True, help="Path to input JSON payload")
    parser.add_argument("--output", required=True, help="Path to output JSON artifact")
    parser.add_argument(
        "--cache",
        default=".cache/my_info_panel_es_cache.json",
        help="Path to cache JSON file (default: .cache/my_info_panel_es_cache.json)",
    )
    parser.add_argument(
        "--endpoint",
        default=os.getenv("AZURE_TRANSLATOR_ENDPOINT", ""),
        help="Azure Translator endpoint (or set AZURE_TRANSLATOR_ENDPOINT)",
    )
    parser.add_argument(
        "--key",
        default=os.getenv("AZURE_TRANSLATOR_KEY", ""),
        help="Azure Translator subscription key (or set AZURE_TRANSLATOR_KEY)",
    )
    parser.add_argument(
        "--region",
        default=os.getenv("AZURE_TRANSLATOR_REGION", ""),
        help="Azure Translator resource region (or set AZURE_TRANSLATOR_REGION)",
    )
    parser.add_argument("--from-locale", default="en")
    parser.add_argument("--to-locale", default="es")
    parser.add_argument("--batch-size", type=int, default=25)
    return parser.parse_args(argv)


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    if not args.endpoint or not args.key or not args.region:
        print(
            "Missing Azure Translator config. Set --endpoint/--key/--region "
            "or env vars AZURE_TRANSLATOR_ENDPOINT/AZURE_TRANSLATOR_KEY/AZURE_TRANSLATOR_REGION.",
            file=sys.stderr,
        )
        return 2

    input_path = Path(args.input)
    output_path = Path(args.output)
    cache_path = Path(args.cache)

    try:
        payload = _load_json(input_path)
        cfg = TranslatorConfig(
            endpoint=args.endpoint,
            key=args.key,
            region=args.region,
            source_locale=args.from_locale,
            target_locale=args.to_locale,
        )
        result = translate_payload(
            source_payload=payload,
            cfg=cfg,
            cache_path=cache_path,
            batch_size=max(1, args.batch_size),
        )
        _write_json(output_path, result)
        print(f"Wrote translated artifact: {output_path}")
        return 0
    except Exception as exc:
        print(f"Translation pipeline failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
