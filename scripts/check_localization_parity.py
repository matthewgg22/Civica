#!/usr/bin/env python3
"""
Civica Spanish-parity check.

Two failure modes:
  1. Raw user-facing string literal in a Civica view that bypasses the
     CivicaText(en, es:) wrapper — Text("..."), Button("..."), Label("...", ...),
     .navigationTitle("..."). These auto-export to Localizable.xcstrings
     without a Spanish translation, breaking parity.
  2. Localizable.xcstrings keys with a non-format-only English source
     and no `es` translation.

An allowlist (scripts/localization_parity_allowlist.txt, one literal per
line) covers brand strings, debug-only surfaces, and bilingual welcome
screens that intentionally render both languages inline.

Exit 0 = clean, 1 = violations found.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VIEWS_ROOT = REPO / "Civica"
XCSTRINGS = REPO / "Civica" / "Localizable.xcstrings"
ALLOWLIST = REPO / "scripts" / "localization_parity_allowlist.txt"

# Raw-string call sites in views that need to flow through CivicaText.
RAW_PATTERNS = [
    re.compile(r'\bText\(\s*"((?:[^"\\]|\\.)+)"\s*\)'),
    re.compile(r'\bButton\(\s*"((?:[^"\\]|\\.)+)"\s*[,)]'),
    re.compile(r'\bLabel\(\s*"((?:[^"\\]|\\.)+)"\s*,'),
    re.compile(r'\.navigationTitle\(\s*"((?:[^"\\]|\\.)+)"\s*\)'),
]

# Skip non-shipping surfaces.
SKIP_PATH_FRAGMENTS = (
    "/Tests/",
    "/.build/",
    "Civica Tests/",
    "WeVote Information PageTests/",
    "WeVote Information PageUITests/",
)

PUNCT_FORMAT_ONLY = re.compile(r'^[\W\d%@a-z\s·\-—.,:;()\[\]{}]+$')


def strip_swift_interpolations(s: str) -> str:
    r"""
    Strip Swift `\(...)` string interpolations, handling NESTED parentheses.

    The previous regex-based stripper (`re.sub(r'\\\([^)]*\)', '', s)`)
    matched a `\(` then ran to the first `)` it found — which fails on
    any interpolation that contains parens of its own. The most common
    real-world example is a localizable accessor inside an interpolation:

        Text("~$\(cents / 100) \(EBTPerksStrings.savingsLabel.value(in: lang))")

    The non-greedy regex stops at the `)` of `value(in:`, leaving ` lang))`
    behind in the stripped string. The leftover letters then make the
    `is_meaningful_user_string` check return True, so the checker flags
    what is in fact a fully-CivicaText-routed surface as a raw string.

    This balanced-paren scanner walks left-to-right tracking depth, so it
    consumes the whole `\(...)` even when the interior contains call
    expressions, tuples, or further interpolations.

    Doctests (run via `python3 -m doctest scripts/check_localization_parity.py`):

    >>> strip_swift_interpolations(r"Hello, \(name)!")
    'Hello, !'
    >>> strip_swift_interpolations(r"~$\(cents / 100) \(foo.bar(in: lang))")
    '~$ '
    >>> strip_swift_interpolations(r"plain text, no interp")
    'plain text, no interp'
    >>> strip_swift_interpolations(r"depth: \(a(b(c))) trailing")
    'depth:  trailing'
    """
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        if i + 1 < n and s[i] == "\\" and s[i + 1] == "(":
            # Interpolation start. Scan forward to the matching ')'.
            depth = 1
            j = i + 2
            while j < n and depth > 0:
                if s[j] == "(":
                    depth += 1
                elif s[j] == ")":
                    depth -= 1
                j += 1
            # j is now one past the matching ')' (or end-of-string).
            i = j
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def load_allowlist() -> set[str]:
    if not ALLOWLIST.exists():
        return set()
    out: set[str] = set()
    for line in ALLOWLIST.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        out.add(s)
    return out


def is_meaningful_user_string(s: str) -> bool:
    if len(s) < 2:
        return False
    # Strip Swift string interpolations (\(...)) — these are values
    # routed through other code paths, not literal user copy.
    # Uses a balanced-paren scanner so interpolations with internal
    # parentheses (e.g. `\(foo.bar(in: lang))`) get fully consumed.
    without_interp = strip_swift_interpolations(s).strip()
    # Strip currency/format markers + punctuation.
    cleaned = re.sub(r'%[@a-z]|%lld|[·\-—.,:;()\[\]{}\s$\d]', '', without_interp).strip()
    if not cleaned:
        return False
    # Skip system-image names and asset identifiers (lowercase + dots only).
    if re.fullmatch(r'[a-z0-9._-]+', s):
        return False
    return True


def scan_raw_strings(allowlist: set[str]) -> list[tuple[Path, int, str]]:
    violations: list[tuple[Path, int, str]] = []
    for path in VIEWS_ROOT.rglob("*.swift"):
        sp = str(path)
        if any(frag in sp for frag in SKIP_PATH_FRAGMENTS):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        # Skip preview-only files.
        for line_no, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            for pat in RAW_PATTERNS:
                for m in pat.finditer(line):
                    literal = m.group(1)
                    if literal in allowlist:
                        continue
                    if not is_meaningful_user_string(literal):
                        continue
                    violations.append((path.relative_to(REPO), line_no, literal))
    return violations


def scan_xcstrings(allowlist: set[str]) -> list[str]:
    """
    Only check keys with extractionState != "auto". Auto-extracted keys are
    Xcode-managed mirrors of Text("...") literals — those are gated by the
    raw-string scan above, and Xcode rewrites the catalog on each build.
    Manually added keys are the ones a human is responsible for translating.
    """
    if not XCSTRINGS.exists():
        return []
    data = json.loads(XCSTRINGS.read_text(encoding="utf-8"))
    out: list[str] = []
    for key, entry in data.get("strings", {}).items():
        if key in allowlist:
            continue
        if not is_meaningful_user_string(key):
            continue
        if entry.get("extractionState", "auto") == "auto":
            continue
        es = entry.get("localizations", {}).get("es", {}).get("stringUnit", {}).get("value")
        if not es:
            out.append(key)
    return out


def main() -> int:
    allowlist = load_allowlist()
    raw = scan_raw_strings(allowlist)
    missing_es = scan_xcstrings(allowlist)

    if not raw and not missing_es:
        print("✓ Localization parity OK")
        return 0

    if raw:
        print(f"✗ {len(raw)} raw user-facing string(s) bypass CivicaText:")
        for path, line_no, literal in raw:
            preview = literal if len(literal) <= 60 else literal[:57] + "..."
            print(f"  {path}:{line_no}  \"{preview}\"")
        print()

    if missing_es:
        print(f"✗ {len(missing_es)} xcstrings key(s) missing Spanish:")
        for k in missing_es[:50]:
            preview = k if len(k) <= 60 else k[:57] + "..."
            print(f"  - \"{preview}\"")
        if len(missing_es) > 50:
            print(f"  … and {len(missing_es) - 50} more")
        print()

    print("Wrap raw strings in CivicaText(en, es:) (see Civica/Resources/CivicaLanguage.swift),")
    print("add Spanish to xcstrings, or add intentional exceptions to:")
    print(f"  {ALLOWLIST.relative_to(REPO)}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
