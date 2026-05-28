#!/usr/bin/env python3
"""Build findings.db (SQLite) from docs/findings/*.md frontmatter.

Stdlib-only — uses a minimal YAML-frontmatter parser scoped to the
finding schema in docs/findings/README.md (strings, list-of-strings,
list-of-mappings). If we ever need full YAML, swap in PyYAML.

Idempotent: drops + recreates tables on every run. The markdown files
are canonical; this DB is a derived artifact for Datasette.

Schema:
    findings(id PK, date, scope_json, confidence, status,
             supersedes_json, superseded_by_json, body, path)
    evidence(finding_id, idx, kind, ref, line, note)
    finding_links(src_id, dst_id)   # from [[other-id]] in body
"""
from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
FINDINGS_DIR = REPO_ROOT / "docs" / "findings"
DB_PATH = REPO_ROOT / "findings.db"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)
LINK_RE = re.compile(r"\[\[([a-z0-9-]+)\]\]")


def _strip_quotes(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        return s[1:-1]
    return s


def _parse_scalar(s: str) -> Any:
    s = s.strip()
    if not s:
        return ""
    if s.startswith("[") and s.endswith("]"):
        inner = s[1:-1].strip()
        if not inner:
            return []
        return [_strip_quotes(p) for p in inner.split(",")]
    if s.isdigit():
        return int(s)
    return _strip_quotes(s)


def parse_frontmatter(yaml_text: str) -> dict:
    """Tiny YAML-subset parser for our finding schema.

    Supports:
      key: scalar
      key: [a, b, c]      # inline list of scalars
      key:                # block list of scalars
        - a
        - b
      key:                # block list of mappings (only `evidence:`)
        - subkey: val
          subkey: val
        - subkey: val
    """
    result: dict[str, Any] = {}
    lines = yaml_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.strip().startswith("#"):
            i += 1
            continue
        if not line[0].isalpha():
            i += 1
            continue
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, rest = m.group(1), m.group(2)
        if rest:  # inline value
            result[key] = _parse_scalar(rest)
            i += 1
            continue
        # block — peek at next non-empty line to decide scalar-list vs mapping-list
        block: list[Any] = []
        i += 1
        current_map: dict | None = None
        while i < len(lines):
            ln = lines[i]
            if not ln.strip():
                i += 1
                continue
            if ln.startswith("  - "):  # list item
                if current_map is not None:
                    block.append(current_map)
                    current_map = None
                item_text = ln[4:]
                sub = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$", item_text)
                if sub:
                    current_map = {sub.group(1): _parse_scalar(sub.group(2))}
                else:
                    block.append(_strip_quotes(item_text))
                i += 1
            elif ln.startswith("    ") and current_map is not None:
                sub = re.match(r"^\s{4}([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$", ln)
                if sub:
                    current_map[sub.group(1)] = _parse_scalar(sub.group(2))
                i += 1
            else:
                break
        if current_map is not None:
            block.append(current_map)
        result[key] = block
    return result


def parse_finding(md_path: Path) -> tuple[dict, str] | None:
    text = md_path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    try:
        fm = parse_frontmatter(m.group(1))
    except Exception as e:
        print(f"  parse error in {md_path.name}: {e}", file=sys.stderr)
        return None
    return fm, m.group(2)


def build_db() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE findings (
          id              TEXT PRIMARY KEY,
          date            TEXT NOT NULL,
          scope_json      TEXT NOT NULL,
          confidence      TEXT NOT NULL,
          status          TEXT NOT NULL,
          supersedes_json TEXT NOT NULL,
          superseded_by_json TEXT NOT NULL,
          body            TEXT NOT NULL,
          path            TEXT NOT NULL
        );
        CREATE TABLE evidence (
          finding_id TEXT NOT NULL REFERENCES findings(id),
          idx        INTEGER NOT NULL,
          kind       TEXT NOT NULL,
          ref        TEXT NOT NULL,
          line       INTEGER,
          note       TEXT,
          PRIMARY KEY (finding_id, idx)
        );
        CREATE TABLE finding_links (
          src_id TEXT NOT NULL REFERENCES findings(id),
          dst_id TEXT NOT NULL,
          PRIMARY KEY (src_id, dst_id)
        );
        CREATE INDEX idx_findings_status ON findings(status);
        CREATE INDEX idx_findings_date   ON findings(date);
        CREATE INDEX idx_evidence_kind   ON evidence(kind);
        """
    )

    count = 0
    skipped = 0
    for md_path in sorted(FINDINGS_DIR.glob("*.md")):
        if md_path.name in {"README.md", "INDEX.md", "_template.md"}:
            continue
        parsed = parse_finding(md_path)
        if parsed is None:
            skipped += 1
            print(f"  skip (no frontmatter): {md_path.name}", file=sys.stderr)
            continue
        fm, body = parsed
        fid = fm.get("id")
        if not fid:
            skipped += 1
            print(f"  skip (no id):          {md_path.name}", file=sys.stderr)
            continue

        scope = fm.get("scope", []) or []
        supersedes = fm.get("supersedes", []) or []
        superseded_by = fm.get("superseded_by", []) or []
        if isinstance(scope, str):
            scope = [scope]
        if isinstance(supersedes, str):
            supersedes = [supersedes]
        if isinstance(superseded_by, str):
            superseded_by = [superseded_by]

        cur.execute(
            "INSERT INTO findings VALUES (?,?,?,?,?,?,?,?,?)",
            (
                fid,
                str(fm.get("date", "")),
                json.dumps(scope),
                fm.get("confidence", "unknown"),
                fm.get("status", "active"),
                json.dumps(supersedes),
                json.dumps(superseded_by),
                body,
                str(md_path.relative_to(REPO_ROOT)),
            ),
        )
        evidence = fm.get("evidence", []) or []
        for i, ev in enumerate(evidence):
            if not isinstance(ev, dict):
                continue
            line_val = ev.get("line")
            try:
                line_val = int(line_val) if line_val is not None else None
            except (TypeError, ValueError):
                line_val = None
            cur.execute(
                "INSERT INTO evidence VALUES (?,?,?,?,?,?)",
                (
                    fid,
                    i,
                    ev.get("kind", "unknown"),
                    str(ev.get("ref", "")),
                    line_val,
                    ev.get("note", ""),
                ),
            )
        for dst in sorted(set(LINK_RE.findall(body))):
            cur.execute(
                "INSERT OR IGNORE INTO finding_links VALUES (?,?)",
                (fid, dst),
            )
        count += 1

    conn.commit()
    conn.close()
    print(f"built {DB_PATH.relative_to(REPO_ROOT)}: {count} findings, {skipped} skipped")


if __name__ == "__main__":
    build_db()
