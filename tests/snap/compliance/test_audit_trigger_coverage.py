"""Audit-trigger coverage regression guard.

Civica's snap_enrollment schema audits mutations via Postgres triggers
(snap_enrollment.audit_row_change, attached AFTER INSERT/UPDATE/DELETE)
rather than application-level wrappers. This is a stronger guarantee
than a `withAudit` helper because application code literally cannot
bypass it — every mutation traverses Postgres.

Architecture (per supabase/migrations/20260520_snap_enrollment_05_triggers_audit.sql):
  • Mutable tables with PII → must have an audit trigger
  • Append-only tables (block-mutation trigger) → are their own audit trail,
    no separate audit row needed

This test enforces: any table registered in snap_enrollment.pii_columns
either has an audit_<table> trigger OR is on the explicit append-only
allowlist below.

When you add a new PII-containing table:
  1. Add its PII columns to the pii_columns insert in migration 05.
  2. Either (a) add an `audit_<table>` trigger to migration 05, OR
     (b) make it append-only with a block-mutation trigger AND add it
     to APPEND_ONLY_TABLES below.

When you add a new append-only table:
  1. Add the block-mutation trigger.
  2. Add the table name to APPEND_ONLY_TABLES below.

The test is CI-blocking: a new PII table without an audit trigger
ships unaudited compliance liability.
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"

# Append-only tables (block-mutation trigger). Their INSERT is the
# audit record itself; no separate audit_log_events row is emitted.
# Adding to this list is a deliberate design choice — bypassing a
# normal audit trigger should require thought.
APPEND_ONLY_TABLES = frozenset(
    {
        # The audit log itself — auditing the audit log creates a
        # feedback loop. Append-only by trigger (migration 04).
        "audit_log_events",
        # Consent records — versioned by row; revocations are new
        # rows with revoked_at set, not UPDATEs. Append-only (mig 04).
        "user_consents",
        # Handoff exports — every export is a new immutable row with
        # the export bytes + signature. Append-only (mig 04).
        "handoff_exports",
        # Packet status history — each transition is a new row;
        # the row itself is the audit. Append-only (mig 04).
        "packet_status_history",
    }
)

# Tables that hold no operational data and shouldn't need auditing.
# Config / lookup tables that are operator-only.
NON_AUDITABLE_TABLES = frozenset(
    {
        # Registry of which columns hold PII — meta-config, not user data.
        "pii_columns",
        # Org and role lookup tables — slow-changing operational config.
        # If we ever care about staff org/role mutations, add an
        # explicit trigger.
        "staff_orgs",
        "staff_roles",
        # Enrollment-config flags — non-PII feature flags.
        "enrollment_config",
        # Required-document-items catalog — slow-changing data.
        "required_document_items",
    }
)


def _read_migrations() -> str:
    """Concatenate every .sql under supabase/migrations/ for matching."""
    parts = []
    for p in sorted(MIGRATIONS_DIR.glob("*.sql")):
        parts.append(p.read_text())
    return "\n".join(parts)


def _snap_enrollment_tables(sql: str) -> set[str]:
    """Tables created in the snap_enrollment schema."""
    pat = re.compile(
        r"create table\s+(?:if not exists\s+)?snap_enrollment\.([a-z_]+)",
        re.IGNORECASE,
    )
    return set(pat.findall(sql))


def _pii_registered_tables(sql: str) -> set[str]:
    """Tables that have at least one column registered in
    snap_enrollment.pii_columns."""
    # Match each row in the pii_columns insert tuple list:
    #   ('snap_enrollment', '<table>',   '<column>')
    pat = re.compile(
        r"\(\s*'snap_enrollment'\s*,\s*'([a-z_]+)'\s*,\s*'[a-z_]+'\s*\)",
        re.IGNORECASE,
    )
    return set(pat.findall(sql))


def _audit_triggered_tables(sql: str) -> set[str]:
    """Tables that have an `audit_<table>` trigger attached."""
    # Match: create trigger audit_<table>
    # The trigger naming convention in migration 05 is `audit_<table>`.
    pat = re.compile(
        r"create trigger\s+audit_([a-z_]+)\s+after",
        re.IGNORECASE,
    )
    return set(pat.findall(sql))


class TestAuditTriggerCoverage:
    """Every mutable PII-containing table has an audit trigger."""

    def setup_method(self):
        self.sql = _read_migrations()
        self.tables = _snap_enrollment_tables(self.sql)
        self.pii_tables = _pii_registered_tables(self.sql)
        self.triggered = _audit_triggered_tables(self.sql)

    def test_pii_registry_references_real_tables(self):
        """A typo in the pii_columns insert would silently break
        PII redaction in audit logs. Catch it here."""
        missing = self.pii_tables - self.tables
        assert not missing, (
            f"pii_columns references tables that don't exist: {sorted(missing)}"
        )

    def test_every_pii_table_is_audited_or_appendonly(self):
        """Every PII-registered table must EITHER have an audit
        trigger OR be on the append-only allowlist. Adding a new
        PII table without one of these is a compliance gap."""
        unaudited = []
        for table in sorted(self.pii_tables):
            if table in APPEND_ONLY_TABLES:
                continue
            if table in self.triggered:
                continue
            unaudited.append(table)

        assert not unaudited, (
            f"PII-containing tables without audit trigger AND not on "
            f"APPEND_ONLY_TABLES allowlist: {unaudited}. Either add "
            f"`audit_{{table}}` trigger to migration 05 or mark as "
            f"append-only and add to APPEND_ONLY_TABLES."
        )

    def test_append_only_tables_actually_block_mutation(self):
        """Every table on APPEND_ONLY_TABLES must have a
        block-mutation trigger that prevents UPDATE and DELETE.
        Otherwise the 'append-only' guarantee is fiction."""
        # Append-only tables use the snap_enrollment.block_audit_mutation
        # function (for audit_log_events) OR a per-table block trigger.
        # Either way, the trigger function should reference "append-only".
        for table in sorted(APPEND_ONLY_TABLES):
            # Look for any block trigger on this table (case insensitive).
            # Match either: "before update on snap_enrollment.<table>" or
            # the same for delete.
            update_pat = re.compile(
                rf"before update on snap_enrollment\.{re.escape(table)}\b",
                re.IGNORECASE,
            )
            delete_pat = re.compile(
                rf"before delete on snap_enrollment\.{re.escape(table)}\b",
                re.IGNORECASE,
            )
            has_block_update = bool(update_pat.search(self.sql))
            has_block_delete = bool(delete_pat.search(self.sql))
            assert has_block_update and has_block_delete, (
                f"snap_enrollment.{table} is on APPEND_ONLY_TABLES but "
                f"is missing block-mutation triggers "
                f"(update={has_block_update}, delete={has_block_delete}). "
                f"Either restore the triggers in migration 04 or remove "
                f"from the allowlist."
            )

    def test_no_table_is_both_audited_and_append_only(self):
        """Append-only tables should NOT also have an audit trigger
        — that would double-log. If a table is both, the design
        intent is unclear and needs reconciliation."""
        conflict = APPEND_ONLY_TABLES & self.triggered
        assert not conflict, (
            f"Tables both audit-triggered AND append-only: {sorted(conflict)}. "
            f"This causes double-logging — pick one strategy."
        )

    def test_triggered_tables_are_all_known(self):
        """Every audit-triggered table should exist in snap_enrollment.
        Catches drift if a trigger references a renamed/dropped table."""
        unknown = self.triggered - self.tables
        assert not unknown, (
            f"Audit triggers reference unknown tables: {sorted(unknown)}"
        )
