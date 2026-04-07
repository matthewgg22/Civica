#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = REPO_ROOT / "WeVote Information Page/Models"

NS_MAIN = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
NS_REL = {"r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

DEFAULT_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


@dataclass(frozen=True)
class DatasetSpec:
    filename: str
    kind: str
    required_phone: bool
    url_fields: tuple[str, ...]


@dataclass(frozen=True)
class RowRef:
    filename: str
    kind: str
    index: int
    name: str
    state_code: str
    state_name: str
    district: str
    city: str

    def label(self) -> str:
        parts = [self.kind, self.state_code or self.state_name, self.district, self.city, self.name]
        return " | ".join(part for part in parts if part)


@dataclass(frozen=True)
class Issue:
    severity: str
    category: str
    message: str
    ref: RowRef | None = None
    field: str | None = None
    value: str | None = None


@dataclass(frozen=True)
class UrlCheckResult:
    url: str
    ok: bool
    status_code: int | None
    final_url: str | None
    checked_method: str
    detail: str


DATASET_SPECS: tuple[DatasetSpec, ...] = (
    DatasetSpec(
        filename="USGovernors.json",
        kind="governor",
        required_phone=True,
        url_fields=("url", "attorney_general_url", "lieutenant_governor_url"),
    ),
    DatasetSpec(
        filename="USSenators.json",
        kind="senator",
        required_phone=True,
        url_fields=("url", "contact_form_url"),
    ),
    DatasetSpec(
        filename="USHouseMembers.json",
        kind="house",
        required_phone=True,
        url_fields=("url", "contact_form_url"),
    ),
    DatasetSpec(
        filename="USMayorsTop50.json",
        kind="mayor",
        required_phone=False,
        url_fields=("url",),
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit VoteNow representative phone numbers and website URLs."
    )
    parser.add_argument(
        "--skip-live-url-check",
        action="store_true",
        help="Skip outbound live URL checks and only run static validation.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Per-request timeout in seconds for live URL checks (default: 10).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=24,
        help="Concurrent worker count for live URL checks (default: 24).",
    )
    parser.add_argument(
        "--browser-user-agent",
        default=DEFAULT_BROWSER_UA,
        help="User-Agent to use for live URL checks.",
    )
    parser.add_argument(
        "--governor-phone-xlsx",
        type=Path,
        default=None,
        help=(
            "Optional path to governor_office_constituent_phone_list.xlsx; "
            "if provided, verifies USGovernors.json phone parity."
        ),
    )
    parser.add_argument(
        "--markdown-report",
        type=Path,
        default=None,
        help="Optional markdown report output path.",
    )
    parser.add_argument(
        "--csv-report",
        type=Path,
        default=None,
        help="Optional CSV issue report output path.",
    )
    return parser.parse_args()


def load_rows(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} must be a JSON array.")
    return data


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D+", "", value or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def is_valid_phone(value: str) -> bool:
    return len(normalize_phone(value)) == 10


def is_valid_http_url(value: str) -> bool:
    parsed = urllib.parse.urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def build_row_ref(spec: DatasetSpec, idx: int, row: dict[str, Any]) -> RowRef:
    return RowRef(
        filename=spec.filename,
        kind=spec.kind,
        index=idx,
        name=str(row.get("name") or ""),
        state_code=str(row.get("state_code") or ""),
        state_name=str(row.get("state_name") or ""),
        district=str(row.get("district") or ""),
        city=str(row.get("city") or ""),
    )


def is_acceptable_http_code(code: int) -> bool:
    if 200 <= code < 400:
        return True
    if code in {401, 403, 405, 429}:
        return True
    return False


def check_url_live(url: str, timeout: float, user_agent: str) -> UrlCheckResult:
    headers = {"User-Agent": user_agent}
    ctx = ssl.create_default_context()
    last_error = ""
    last_status: int | None = None
    last_final_url: str | None = None

    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url=url, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                code = getattr(resp, "status", None) or resp.getcode()
                if not is_acceptable_http_code(int(code)):
                    return UrlCheckResult(
                        url=url,
                        ok=False,
                        status_code=int(code),
                        final_url=resp.geturl(),
                        checked_method=method,
                        detail=f"http_{code}",
                    )
                return UrlCheckResult(
                    url=url,
                    ok=True,
                    status_code=int(code),
                    final_url=resp.geturl(),
                    checked_method=method,
                    detail="ok",
                )
        except urllib.error.HTTPError as exc:
            code = int(exc.code)
            if is_acceptable_http_code(code):
                return UrlCheckResult(
                    url=url,
                    ok=True,
                    status_code=code,
                    final_url=exc.geturl() if hasattr(exc, "geturl") else url,
                    checked_method=method,
                    detail=f"accepted_http_{code}",
                )
            last_status = code
            last_final_url = exc.geturl() if hasattr(exc, "geturl") else url
            last_error = f"http_{code}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)

    # urllib can fail for some TLS/cipher/ALPN combos that curl still handles.
    if shutil.which("curl"):
        try:
            completed = subprocess.run(
                [
                    "curl",
                    "-L",
                    "-A",
                    user_agent,
                    "--max-time",
                    str(int(max(timeout, 1))),
                    "-s",
                    "-o",
                    "/dev/null",
                    "-w",
                    "%{http_code}",
                    url,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            code_text = (completed.stdout or "").strip()
            if code_text.isdigit():
                curl_code = int(code_text)
                if is_acceptable_http_code(curl_code):
                    return UrlCheckResult(
                        url=url,
                        ok=True,
                        status_code=curl_code,
                        final_url=None,
                        checked_method="curl",
                        detail="ok_via_curl",
                    )
                last_status = curl_code
                last_error = f"http_{curl_code}"
        except Exception:  # noqa: BLE001
            pass

    return UrlCheckResult(
        url=url,
        ok=False,
        status_code=last_status,
        final_url=last_final_url,
        checked_method="GET",
        detail=last_error or "unknown_error",
    )


def parse_governor_phone_xlsx(path: Path) -> dict[str, str]:
    with zipfile.ZipFile(path) as zf:
        workbook = ElementTree.fromstring(zf.read("xl/workbook.xml"))
        rels = ElementTree.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}

        first_sheet = workbook.findall("a:sheets/a:sheet", NS_MAIN)[0]
        sheet_rid = first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = rel_map[sheet_rid]
        if not target.startswith("worksheets/"):
            target = f"worksheets/{target.split('/')[-1]}"
        worksheet = ElementTree.fromstring(zf.read(f"xl/{target}"))

        rows: dict[int, dict[str, str]] = {}
        for row in worksheet.findall(".//a:sheetData/a:row", NS_MAIN):
            row_num = int(row.attrib.get("r", "0"))
            values: dict[str, str] = {}
            for cell in row.findall("a:c", NS_MAIN):
                ref = cell.attrib.get("r", "")
                col = "".join(ch for ch in ref if ch.isalpha())
                if not col:
                    continue
                inline_text = cell.find("a:is/a:t", NS_MAIN)
                value_node = cell.find("a:v", NS_MAIN)
                value = ""
                if inline_text is not None:
                    value = inline_text.text or ""
                elif value_node is not None:
                    value = value_node.text or ""
                values[col] = value
            rows[row_num] = values

    header_row_num = None
    for row_num in sorted(rows):
        vals = rows[row_num]
        if vals.get("A", "").strip().lower() == "jurisdiction" and "phone" in vals.get("D", "").strip().lower():
            header_row_num = row_num
            break

    if header_row_num is None:
        raise ValueError(f"Could not find expected header row in {path}.")

    phones_by_state: dict[str, str] = {}
    for row_num in sorted(rows):
        if row_num <= header_row_num:
            continue
        vals = rows[row_num]
        state_name = vals.get("A", "").strip()
        phone = vals.get("D", "").strip()
        if not state_name:
            continue
        phones_by_state[state_name] = phone

    return phones_by_state


def write_markdown_report(path: Path, issues: list[Issue], live_checked: int, unique_urls: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warning"]

    lines = [
        "# Reps Contact Audit",
        "",
        f"- Total issues: **{len(issues)}**",
        f"- Errors: **{len(errors)}**",
        f"- Warnings: **{len(warnings)}**",
        f"- Live URL checks run: **{live_checked}** / {unique_urls} unique URLs",
        "",
        "## Issues",
        "",
    ]
    if not issues:
        lines.append("- No issues found.")
    else:
        for issue in issues:
            location = issue.ref.label() if issue.ref else "global"
            field = f" [{issue.field}]" if issue.field else ""
            value = f" `{issue.value}`" if issue.value else ""
            lines.append(f"- **{issue.severity.upper()}** `{issue.category}` {location}{field}: {issue.message}{value}")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_csv_report(path: Path, issues: list[Issue]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "severity",
                "category",
                "filename",
                "kind",
                "row_index",
                "state_code",
                "district",
                "city",
                "name",
                "field",
                "value",
                "message",
            ],
        )
        writer.writeheader()
        for issue in issues:
            ref = issue.ref
            writer.writerow(
                {
                    "severity": issue.severity,
                    "category": issue.category,
                    "filename": ref.filename if ref else "",
                    "kind": ref.kind if ref else "",
                    "row_index": ref.index if ref else "",
                    "state_code": ref.state_code if ref else "",
                    "district": ref.district if ref else "",
                    "city": ref.city if ref else "",
                    "name": ref.name if ref else "",
                    "field": issue.field or "",
                    "value": issue.value or "",
                    "message": issue.message,
                }
            )


def main() -> int:
    args = parse_args()

    issues: list[Issue] = []
    url_refs: list[tuple[RowRef, str, str]] = []  # (row_ref, field_name, url)
    governor_rows: list[dict[str, Any]] = []

    for spec in DATASET_SPECS:
        path = MODELS_DIR / spec.filename
        rows = load_rows(path)
        if spec.kind == "governor":
            governor_rows = rows
        for idx, row in enumerate(rows):
            ref = build_row_ref(spec, idx, row)

            if spec.required_phone:
                phone_value = str(row.get("phone") or "").strip()
                if not phone_value:
                    issues.append(
                        Issue(
                            severity="error",
                            category="phone_missing",
                            message="Missing required phone number.",
                            ref=ref,
                            field="phone",
                        )
                    )
                elif not is_valid_phone(phone_value):
                    issues.append(
                        Issue(
                            severity="error",
                            category="phone_format",
                            message="Phone number must normalize to 10 digits.",
                            ref=ref,
                            field="phone",
                            value=phone_value,
                        )
                    )

            for field in spec.url_fields:
                raw_url = str(row.get(field) or "").strip()
                if not raw_url:
                    continue
                if not is_valid_http_url(raw_url):
                    issues.append(
                        Issue(
                            severity="error",
                            category="url_syntax",
                            message="URL must be valid http/https URL.",
                            ref=ref,
                            field=field,
                            value=raw_url,
                        )
                    )
                    continue
                url_refs.append((ref, field, raw_url))

    # Optional governor XLSX parity check.
    if args.governor_phone_xlsx:
        xlsx_path = args.governor_phone_xlsx.expanduser().resolve()
        if not xlsx_path.exists():
            issues.append(
                Issue(
                    severity="error",
                    category="governor_xlsx_missing",
                    message="Governor XLSX file does not exist.",
                    value=str(xlsx_path),
                )
            )
        else:
            try:
                xlsx_phones = parse_governor_phone_xlsx(xlsx_path)
                json_phones = {str(r.get("state_name") or ""): str(r.get("phone") or "") for r in governor_rows}
                for state_name, json_phone in sorted(json_phones.items()):
                    xlsx_phone = xlsx_phones.get(state_name)
                    if xlsx_phone is None:
                        issues.append(
                            Issue(
                                severity="error",
                                category="governor_xlsx_missing_state",
                                message="State missing from governor XLSX.",
                                value=state_name,
                            )
                        )
                        continue
                    if normalize_phone(json_phone) != normalize_phone(xlsx_phone):
                        issues.append(
                            Issue(
                                severity="error",
                                category="governor_phone_mismatch",
                                message="Governor phone differs from provided XLSX.",
                                value=f"{state_name}: json={json_phone} xlsx={xlsx_phone}",
                            )
                        )
            except Exception as exc:  # noqa: BLE001
                issues.append(
                    Issue(
                        severity="error",
                        category="governor_xlsx_parse",
                        message=f"Failed to parse governor XLSX: {exc}",
                        value=str(xlsx_path),
                    )
                )

    unique_urls = sorted({u for _, _, u in url_refs})
    live_checked = 0

    if not args.skip_live_url_check and unique_urls:
        with ThreadPoolExecutor(max_workers=max(args.workers, 1)) as pool:
            results = list(pool.map(lambda u: check_url_live(u, args.timeout, args.browser_user_agent), unique_urls))
        live_checked = len(results)
        result_by_url = {r.url: r for r in results}
        for ref, field, url in url_refs:
            result = result_by_url[url]
            if result.ok:
                continue
            issues.append(
                Issue(
                    severity="error",
                    category="url_live_unreachable",
                    message=f"Live URL check failed ({result.detail}).",
                    ref=ref,
                    field=field,
                    value=url,
                )
            )

    errors = [issue for issue in issues if issue.severity == "error"]
    warnings = [issue for issue in issues if issue.severity == "warning"]

    print("Reps contact audit summary")
    print(f"- issues: {len(issues)} (errors={len(errors)}, warnings={len(warnings)})")
    print(f"- unique URLs: {len(unique_urls)}")
    print(f"- live URLs checked: {live_checked}")

    if issues:
        print("\nTop issues:")
        for issue in issues[:30]:
            where = issue.ref.label() if issue.ref else "global"
            field = f" [{issue.field}]" if issue.field else ""
            value = f" :: {issue.value}" if issue.value else ""
            print(f"- {issue.severity.upper()} {issue.category} {where}{field} :: {issue.message}{value}")

    if args.markdown_report:
        out = args.markdown_report if args.markdown_report.is_absolute() else (REPO_ROOT / args.markdown_report)
        write_markdown_report(out, issues, live_checked, len(unique_urls))
        print(f"- markdown report: {out}")

    if args.csv_report:
        out = args.csv_report if args.csv_report.is_absolute() else (REPO_ROOT / args.csv_report)
        write_csv_report(out, issues)
        print(f"- csv report: {out}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
