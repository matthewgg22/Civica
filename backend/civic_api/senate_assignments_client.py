from __future__ import annotations

import html
import re
import time
import urllib.error
import urllib.request

from .models import CommitteeAssignment


class SenateAssignmentsClient:
    """Ingest official Senate committee assignments and normalize rows."""

    def __init__(
        self,
        assignments_url: str = "https://www.senate.gov/general/committee_assignments/assignments.htm",
        timeout_s: float = 8.0,
        max_retries: int = 3,
    ) -> None:
        self.assignments_url = assignments_url
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self._cache_html: str | None = None

    def fetch_assignments(self, congress: int | None = None) -> list[CommitteeAssignment]:
        source = self._fetch_html()
        return self._parse_assignments(source, congress=congress)

    # Compatibility alias for call sites that prefer camelCase naming.
    def fetchAssignments(self, congress: int | None = None) -> list[CommitteeAssignment]:
        return self.fetch_assignments(congress=congress)

    def assignments_for_member(
        self,
        member_name: str,
        congress: int | None = None,
    ) -> list[CommitteeAssignment]:
        assignments = self.fetch_assignments(congress=congress)
        target = _normalize_name(member_name)
        target_tokens = set(target.split())
        if not target_tokens:
            return []

        matched: list[CommitteeAssignment] = []
        for row in assignments:
            row_name = _normalize_name(row.member_name or "")
            row_tokens = set(row_name.split())
            if not row_tokens:
                continue
            if row_tokens.issubset(target_tokens) or target_tokens.issubset(row_tokens):
                matched.append(row)
        return matched

    def _fetch_html(self) -> str:
        if self._cache_html is not None:
            return self._cache_html

        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            request = urllib.request.Request(self.assignments_url, method="GET")
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    source = response.read().decode("utf-8", errors="replace")
                    self._cache_html = source
                    return source
            except (urllib.error.HTTPError, urllib.error.URLError) as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** (attempt - 1)))
                    continue
                break

        raise RuntimeError(f"Failed to fetch Senate committee assignments: {last_error}")

    def _parse_assignments(self, source: str, congress: int | None) -> list[CommitteeAssignment]:
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", source, flags=re.IGNORECASE | re.DOTALL)
        results: list[CommitteeAssignment] = []
        for row in rows:
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.IGNORECASE | re.DOTALL)
            if len(cells) < 2:
                continue

            member_name = _clean_html(cells[0])
            if not member_name:
                continue

            assignment_items: list[str] = []
            for cell in cells[1:]:
                list_items = re.findall(r"<li[^>]*>(.*?)</li>", cell, flags=re.IGNORECASE | re.DOTALL)
                if list_items:
                    assignment_items.extend(list_items)
                else:
                    assignment_items.extend(re.split(r"<br\s*/?>", cell, flags=re.IGNORECASE))

            for raw in assignment_items:
                parsed = _parse_assignment_line(raw, member_name=member_name, congress=congress)
                if parsed is not None:
                    results.append(parsed)

        return results


def _parse_assignment_line(
    raw_line: str,
    member_name: str,
    congress: int | None,
) -> CommitteeAssignment | None:
    text = _clean_html(raw_line)
    if not text:
        return None

    lowered = text.lower()
    if "committee" not in lowered and "subcommittee" not in lowered:
        return None

    role = "member"
    if "ranking member" in lowered or "ranking" in lowered:
        role = "ranking"
    elif "chairman" in lowered or "chairwoman" in lowered or "chair" in lowered:
        role = "chairman"

    text_without_role = re.sub(
        r"\((?:chairman|chairwoman|chair|ranking member|ranking|member)\)",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip(" -:;,")

    committee_name = text_without_role
    subcommittee_name: str | None = None

    subcommittee_match = re.search(r"(subcommittee on .+)$", text_without_role, flags=re.IGNORECASE)
    if subcommittee_match:
        subcommittee_name = subcommittee_match.group(1).strip(" -:;,")
        committee_name = text_without_role[: subcommittee_match.start()].strip(" -:;,")
    elif " - " in text_without_role:
        parts = [part.strip() for part in text_without_role.split(" - ", maxsplit=1)]
        if len(parts) == 2 and parts[0] and parts[1]:
            committee_name, subcommittee_name = parts[0], parts[1]

    if not committee_name:
        return None

    return CommitteeAssignment(
        committee_name=committee_name,
        subcommittee_name=subcommittee_name,
        role=role,
        congress=congress,
        member_name=member_name,
    )


def _clean_html(fragment: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", fragment)
    unescaped = html.unescape(no_tags)
    return re.sub(r"\s+", " ", unescaped).strip()


def _normalize_name(value: str) -> str:
    lowered = value.lower()
    normalized = re.sub(r"[^a-z0-9\s-]", " ", lowered)
    normalized = normalized.replace("-", " ")
    return re.sub(r"\s+", " ", normalized).strip()
