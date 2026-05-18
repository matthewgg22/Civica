"""Tests for the FastAPI Sentry before_send PII scrubber.

Mirrors apps/api/src/lib/sentry.test.ts and apps/enrollment-api/
src/lib/sentry.test.ts so the same PII keys produce the same
"[Redacted]" outcome regardless of which service captured the event.
"""

from __future__ import annotations

from backend.civic_api.sentry_scrubber import (
    PII_KEYS,
    REDACTED,
    scrub_event,
)


def _event(**top_level) -> dict:
    """Build a minimal Sentry-shaped event with the given top-level fields."""
    base = {"event_id": "abc123", "level": "error"}
    base.update(top_level)
    return base


class TestPIIKeysCoverage:
    def test_pii_keys_includes_all_ciphertext_columns(self):
        # If a new _ciphertext column lands in the DB, the scrubber
        # must learn it on both sides. This test guards the Python
        # side; the Node side has the matching test.
        required_ciphertext = {
            "body_ciphertext",
            "content_ciphertext",
            "snapshot_ciphertext",
            "extracted_payload_ciphertext",
            "user_corrections_ciphertext",
            "household_snapshot_ciphertext",
            "result_ciphertext",
            "full_name_ciphertext",
            "raw_ocr_ciphertext",
        }
        missing = required_ciphertext - PII_KEYS
        assert not missing, f"Missing _ciphertext columns from PII_KEYS: {missing}"

    def test_pii_keys_includes_core_identity_fields(self):
        for key in ("ssn", "dob", "email", "phone", "full_name", "applicant_id"):
            assert key in PII_KEYS, f"Expected {key!r} in PII_KEYS"


class TestScrubEventTopLevelFields:
    def test_redacts_pii_in_request_data(self):
        event = _event(request={"data": {"email": "alice@example.com", "ok": True}})
        out = scrub_event(event)
        assert out["request"]["data"]["email"] == REDACTED
        assert out["request"]["data"]["ok"] is True

    def test_redacts_pii_in_extra(self):
        event = _event(extra={"ssn": "123-45-6789", "step": "interview"})
        out = scrub_event(event)
        assert out["extra"]["ssn"] == REDACTED
        assert out["extra"]["step"] == "interview"

    def test_redacts_pii_in_user(self):
        event = _event(user={"id": "u1", "email": "x@y.com", "phone": "555-0100"})
        out = scrub_event(event)
        assert out["user"]["id"] == "u1"
        assert out["user"]["email"] == REDACTED
        assert out["user"]["phone"] == REDACTED

    def test_redacts_pii_in_contexts(self):
        event = _event(contexts={"applicant": {"applicant_name": "Alice", "state": "CA"}})
        out = scrub_event(event)
        assert out["contexts"]["applicant"]["applicant_name"] == REDACTED
        assert out["contexts"]["applicant"]["state"] == "CA"


class TestScrubEventNestedStructures:
    def test_redacts_pii_inside_nested_dicts(self):
        event = _event(
            extra={
                "outer": {
                    "middle": {"ssn_last4": "1234", "approved": True}
                }
            }
        )
        out = scrub_event(event)
        assert out["extra"]["outer"]["middle"]["ssn_last4"] == REDACTED
        assert out["extra"]["outer"]["middle"]["approved"] is True

    def test_redacts_pii_inside_lists(self):
        event = _event(
            extra={
                "applicants": [
                    {"email": "a@x.com", "id": 1},
                    {"email": "b@x.com", "id": 2},
                ]
            }
        )
        out = scrub_event(event)
        assert out["extra"]["applicants"][0]["email"] == REDACTED
        assert out["extra"]["applicants"][1]["email"] == REDACTED
        assert out["extra"]["applicants"][0]["id"] == 1


class TestScrubEventBreadcrumbs:
    def test_redacts_pii_in_breadcrumb_data(self):
        event = _event(
            breadcrumbs={
                "values": [
                    {"type": "http", "data": {"authorization": "Bearer secret"}},
                    {"type": "info", "data": {"step": "ok"}},
                ]
            }
        )
        out = scrub_event(event)
        assert out["breadcrumbs"]["values"][0]["data"]["authorization"] == REDACTED
        assert out["breadcrumbs"]["values"][1]["data"]["step"] == "ok"


class TestScrubEventNonDictInputs:
    def test_returns_non_dict_event_unchanged(self):
        # Defensive: if Sentry hands us something unexpected, don't crash.
        assert scrub_event("not a dict") == "not a dict"  # type: ignore[arg-type]

    def test_returns_event_even_when_empty(self):
        event = _event()
        out = scrub_event(event)
        assert out is event  # mutated in place, returned

    def test_hint_arg_is_accepted_and_ignored(self):
        event = _event(extra={"email": "x@y.com"})
        out = scrub_event(event, hint={"exc_info": (None, None, None)})
        assert out["extra"]["email"] == REDACTED


class TestScrubEventDepthLimit:
    def test_stops_recursing_past_max_depth(self):
        # Deeply nested dict — scrubber should bail to avoid blowing
        # the stack on adversarial input. Past MAX_DEPTH, values are
        # returned as-is rather than further redacted.
        nested = {"x": {"x": {"x": {"x": {"x": {"x": {"x": {"x": {"x": {"x": {"email": "deep@x.com"}}}}}}}}}}}
        event = _event(extra=nested)
        out = scrub_event(event)
        # At depth 10 (past MAX_DEPTH=8), the inner "email" survives
        # rather than crashing. This is the deliberate tradeoff.
        # Importantly: the scrubber returns; it does not raise.
        assert out is not None
