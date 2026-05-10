"""Geocoder for Find Help locations.

Uses Nominatim (OpenStreetMap) per its public terms of service:
- One request per second maximum.
- Descriptive User-Agent including a contact URL.
- Aggressive caching to avoid re-resolving the same address.

The cache is persisted to disk under fixtures/geocode_cache.json so the
sync job can run offline once a location has been resolved once. Cache
miss → live call → cache write. Failures return None; the caller is
expected to handle missing coordinates gracefully (location is excluded
from the active set per the data validation rules).
"""

from __future__ import annotations

import json
import logging
import time
import urllib.parse
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_CACHE_PATH = Path(__file__).resolve().parent / "fixtures" / "geocode_cache.json"
NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "CivicaFindHelp/1.0 (+https://civica.app/contact)"
MIN_REQUEST_INTERVAL_S = 1.05  # >1s to respect Nominatim rate-limit policy with margin.


class NominatimGeocoder:
    def __init__(
        self,
        cache_path: Path = DEFAULT_CACHE_PATH,
        timeout_s: float = 10.0,
        request_interval_s: float = MIN_REQUEST_INTERVAL_S,
        live_calls_enabled: bool = True,
    ) -> None:
        self.cache_path = cache_path
        self.timeout_s = timeout_s
        self.request_interval_s = request_interval_s
        self.live_calls_enabled = live_calls_enabled
        self._cache = self._load_cache()
        self._last_request_at: float = 0.0

    def geocode(self, address: str) -> tuple[float, float] | None:
        key = _normalize(address)
        if not key:
            return None
        cached = self._cache.get(key)
        if cached is not None:
            return (cached["lat"], cached["lng"]) if cached else None

        if not self.live_calls_enabled:
            return None

        result = self._lookup_live(key)
        # Persist None misses too so we do not re-hit Nominatim for the same bad address.
        self._cache[key] = (
            {"lat": result[0], "lng": result[1]} if result else None
        )
        self._save_cache()
        return result

    def _lookup_live(self, address: str) -> tuple[float, float] | None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.request_interval_s:
            time.sleep(self.request_interval_s - elapsed)

        params = urllib.parse.urlencode(
            {"q": address, "format": "json", "limit": 1, "addressdetails": 0}
        )
        url = f"{NOMINATIM_ENDPOINT}?{params}"
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                body = response.read().decode("utf-8")
            self._last_request_at = time.monotonic()
        except Exception as exc:  # broad: network and parse errors both yield None
            logger.warning("Geocoder request failed for %r: %s", address, exc)
            self._last_request_at = time.monotonic()
            return None

        try:
            rows = json.loads(body)
        except json.JSONDecodeError:
            return None
        if not rows:
            return None
        first = rows[0]
        try:
            return float(first["lat"]), float(first["lon"])
        except (KeyError, TypeError, ValueError):
            return None

    def _load_cache(self) -> dict[str, dict | None]:
        if not self.cache_path.exists():
            return {}
        try:
            with self.cache_path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, json.JSONDecodeError):
            logger.warning("Geocode cache at %s could not be loaded; starting empty", self.cache_path)
            return {}

    def _save_cache(self) -> None:
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            with self.cache_path.open("w", encoding="utf-8") as fh:
                json.dump(self._cache, fh, indent=2, sort_keys=True)
        except OSError as exc:
            logger.warning("Geocode cache write failed: %s", exc)


def _normalize(address: str) -> str:
    return " ".join(str(address).split()).strip().lower()
