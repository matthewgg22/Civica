"""Programmatic guardrails enforcing the SNAP privacy posture.

These are CI-blocking checks that catch common mistakes before they
ship:

  - Schema convention: every PII column in the migration ends in
    `_ciphertext` (matching the application-layer Fernet wrapping).
  - Append-only trigger: snap_audit_log has the trigger that blocks
    UPDATE and DELETE.
  - Encryption boot gate: PIIEncryptor refuses to construct without
    SNAP_FERNET_KEY.
  - Module isolation: nothing in backend/civic_api/snap/ imports from
    the MyReps vertical (and vice versa) without a documented
    exception.
  - RLS enabled: every snap_* table in the migration has RLS turned on.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SNAP_DIR = REPO_ROOT / "backend" / "civic_api" / "snap"
MIGRATION_PATH = (
    REPO_ROOT
    / "supabase"
    / "migrations"
    / "20260510_add_snap_initial_schema.sql"
)


# ---------------------------------------------------------------------------
# Schema conventions
# ---------------------------------------------------------------------------


class TestEncryptedColumnNaming:
    """Every column that holds Fernet ciphertext for PII must end in
    `_ciphertext`. This makes audit-log queries and code review
    trivially recognize which columns have been encrypted."""

    PII_TABLES = {
        "snap_conversation_turns",
        "snap_extracted_state",
        "snap_documents",
        "snap_eligibility_results",
    }
    KNOWN_CIPHERTEXT_COLUMNS = {
        ("snap_conversation_turns", "content_ciphertext"),
        ("snap_extracted_state", "snapshot_ciphertext"),
        ("snap_documents", "extracted_payload_ciphertext"),
        ("snap_documents", "user_corrections_ciphertext"),
        ("snap_eligibility_results", "household_snapshot_ciphertext"),
        ("snap_eligibility_results", "result_ciphertext"),
    }

    def test_every_known_ciphertext_column_present(self):
        sql = MIGRATION_PATH.read_text()
        for table, col in self.KNOWN_CIPHERTEXT_COLUMNS:
            assert col in sql, (
                f"Expected ciphertext column {col!r} in migration "
                f"(table {table!r}) is missing."
            )

    def test_no_columns_with_pii_keyword_lack_ciphertext_suffix(self):
        """Heuristic: if a SNAP table has a column named `*payload`,
        `*snapshot`, or `*content`, that column must end in
        `_ciphertext`. Catches the case where someone adds a new
        column that holds encrypted data but forgets the suffix."""
        sql = MIGRATION_PATH.read_text()
        # Find column definitions in our PII tables only.
        suspicious_terms = ("payload", "snapshot", "content")
        offenders: list[str] = []
        for line in sql.splitlines():
            stripped = line.strip().rstrip(",")
            if not stripped or stripped.startswith("--"):
                continue
            tokens = stripped.split()
            if not tokens:
                continue
            col_name = tokens[0].strip('"')
            if not col_name.replace("_", "").isalnum():
                continue
            for term in suspicious_terms:
                if term in col_name and not col_name.endswith("_ciphertext"):
                    offenders.append(col_name)
        # Allow "extracted_payload" only when we know it's the extracted
        # payload of a document (which IS encrypted via _ciphertext suffix).
        # Anything else triggers — confirm the offenders list is empty.
        unexpected = [name for name in offenders if name != "extracted_payload"]
        assert not unexpected, (
            f"Columns with PII-suggestive names lack _ciphertext suffix: {unexpected}"
        )


class TestAuditLogAppendOnly:
    def test_migration_installs_trigger_blocking_update_and_delete(self):
        sql = MIGRATION_PATH.read_text()
        assert "snap_audit_log_block_mutation" in sql
        assert "before update on public.snap_audit_log" in sql
        assert "before delete on public.snap_audit_log" in sql
        # The function body should raise on either operation.
        assert "raise exception 'snap_audit_log is append-only" in sql


class TestRLSEnabled:
    SNAP_TABLES = [
        "snap_sessions",
        "snap_conversation_turns",
        "snap_extracted_state",
        "snap_documents",
        "snap_eligibility_results",
        "snap_audit_log",
    ]

    def test_every_snap_table_has_rls_enabled(self):
        sql = MIGRATION_PATH.read_text()
        for table in self.SNAP_TABLES:
            statement = f"alter table public.{table} enable row level security"
            assert statement in sql, f"Missing RLS enable for {table}"


# ---------------------------------------------------------------------------
# Encryption boot gate
# ---------------------------------------------------------------------------


class TestEncryptionBootGate:
    def test_fernet_refuses_to_construct_without_key(self, monkeypatch):
        from backend.civic_api.snap.storage.encryption import (
            EncryptionKeyMissing,
            PIIEncryptor,
        )

        monkeypatch.delenv("SNAP_FERNET_KEY", raising=False)
        with pytest.raises(EncryptionKeyMissing):
            PIIEncryptor()

    def test_fernet_round_trip_with_explicit_key(self):
        from cryptography.fernet import Fernet

        from backend.civic_api.snap.storage.encryption import PIIEncryptor

        key = Fernet.generate_key()
        enc = PIIEncryptor(key=key)
        plaintext = "Maria Garcia, Boston MA, $1,800/mo"
        ct = enc.encrypt(plaintext)
        assert ct.startswith("snap_v1::")
        assert enc.decrypt(ct) == plaintext

    def test_fernet_rejects_value_without_prefix(self):
        from cryptography.fernet import Fernet, InvalidToken

        from backend.civic_api.snap.storage.encryption import PIIEncryptor

        enc = PIIEncryptor(key=Fernet.generate_key())
        # A raw Fernet token (no snap_v1:: prefix) must be rejected so
        # we can't accidentally decrypt non-SNAP data with the SNAP key.
        raw_fernet_token = Fernet(Fernet.generate_key()).encrypt(b"hello").decode("ascii")
        with pytest.raises(InvalidToken):
            enc.decrypt(raw_fernet_token)


# ---------------------------------------------------------------------------
# Module isolation
# ---------------------------------------------------------------------------


class TestSnapModuleIsolation:
    """The SNAP vertical is intentionally siloed from MyReps. The only
    allowed cross-imports are documented and minimal."""

    # Sibling modules in backend/civic_api/ (the MyReps vertical).
    MYREPS_MODULES = {
        "context_ranker",
        "issue_brief_service",
        "issue_catalog",
        "mapc_pipeline_v3",
        "openai_assistant",
        "relevance",
        "repository",
        "script_composer",
        "script_package_service",
        "service",
        "congress_client",
        "senate_assignments_client",
        "models",
    }

    def test_no_snap_file_imports_from_myreps(self):
        # Single-dot relative imports (`from .X`) are siblings within
        # the same SNAP sub-package and are never cross-imports. Only
        # multi-dot relative imports that navigate UP to civic_api,
        # and absolute civic_api.<myreps_module> imports, can pull in
        # MyReps modules.
        offenders: list[tuple[str, str]] = []
        for path in SNAP_DIR.rglob("*.py"):
            text = path.read_text()
            file_depth = len(path.relative_to(SNAP_DIR).parts)  # 1 for snap/foo.py, 2 for snap/sub/foo.py
            for module in self.MYREPS_MODULES:
                # Multi-dot relative: depth needed to escape `snap/` is
                # `file_depth + 1` (one extra dot to leave snap into civic_api).
                escape_dots = "\\." * (file_depth + 1)
                patterns = [
                    rf"from\s+{escape_dots}{module}\b",
                    rf"from\s+backend\.civic_api\.{module}\b",
                    rf"\bimport\s+backend\.civic_api\.{module}\b",
                ]
                for pat in patterns:
                    if re.search(pat, text):
                        offenders.append((str(path.relative_to(REPO_ROOT)), module))
        assert not offenders, (
            "SNAP module imports from MyReps vertical without documented exception:\n"
            + "\n".join(f"  {p} -> {m}" for p, m in offenders)
        )

    def test_no_myreps_file_imports_from_snap(self):
        myreps_dir = REPO_ROOT / "backend" / "civic_api"
        offenders: list[str] = []
        for path in myreps_dir.glob("*.py"):
            # Skip the package __init__ and the public api.py mounter
            # — the api.py uses a try/except to mount the SNAP router
            # but doesn't reach into snap/ internals.
            if path.name in {"__init__.py", "api.py"}:
                continue
            text = path.read_text()
            if re.search(r"from\s+\.snap\b|from\s+backend\.civic_api\.snap\b", text):
                offenders.append(str(path.relative_to(REPO_ROOT)))
        assert not offenders, (
            "MyReps module imports from SNAP vertical without documented exception:\n"
            + "\n".join(f"  {p}" for p in offenders)
        )


# ---------------------------------------------------------------------------
# Retention function
# ---------------------------------------------------------------------------


class TestRetention:
    def test_retention_function_defined(self):
        sql = MIGRATION_PATH.read_text()
        assert "function public.purge_snap_retention()" in sql
        # 7-year retention per the locked decision.
        assert "interval '7 years'" in sql
