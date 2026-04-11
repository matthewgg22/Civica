from __future__ import annotations

import json
import re
import uuid

import pytest

from backend.civic_api.api import (
    post_mapc_v3_ask_options,
    post_mapc_v3_background,
    post_mapc_v3_interpret,
    post_mapc_v3_script,
)
from backend.civic_api.mapc_pipeline_v3 import _universal_mapc_script_lint_ok


def _reason_code(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        return str(detail.get("reason_code", ""))
    raw = str(exc)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return ""
    if isinstance(parsed, dict):
        return str(parsed.get("reason_code", ""))
    return ""


def _wc(text: str) -> int:
    return len(re.findall(r"\b[\w'\-]+\b", text))


def test_mapc_v3_interpret_returns_clarification_for_tibet(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("mapc_pipeline_v3_enabled", "true")
    payload = {
        "session_id": str(uuid.uuid4()),
        "raw_user_issue": "Tibet",
        "concern_text": "Tibet",
        "session_state": "new",
    }
    response = post_mapc_v3_interpret(payload, user_id="v3-user-1")
    session = response["session"]
    assert session["session_state"] == "issue_received"
    assert session["needs_clarification"] is True
    assert session["congressional_lever"] == "foreign_policy_oversight"
    assert session["confidence"] < 0.65


def test_mapc_v3_interpret_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("mapc_pipeline_v3_enabled", "true")
    payload = {
        "session_id": str(uuid.uuid4()),
        "raw_user_issue": "Stop wildfires",
        "concern_text": "Stop wildfires",
        "session_state": "new",
    }
    first = post_mapc_v3_interpret(payload, user_id="v3-user-2")
    second = post_mapc_v3_interpret(payload, user_id="v3-user-2")
    assert first == second


def test_mapc_v3_stage_sequence_interpret_background_ask_script(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("mapc_pipeline_v3_enabled", "true")
    session_id = str(uuid.uuid4())
    interpret = post_mapc_v3_interpret(
        {
            "session_id": session_id,
            "raw_user_issue": "Stop wildfires",
            "concern_text": "Stop wildfires",
            "session_state": "new",
        },
        user_id="v3-user-3",
    )
    session = interpret["session"]

    background = post_mapc_v3_background(
        {
            "session": session,
            "concern_text": "Stop wildfires",
        },
        user_id="v3-user-3",
    )
    assert background["session"]["session_state"] == "background_shown"
    assert background["background_text"]

    ask_options = post_mapc_v3_ask_options(
        {
            "session": background["session"],
            "require_bill_ref": False,
            "concern_text": "Stop wildfires",
        },
        user_id="v3-user-3",
    )
    assert ask_options["session"]["session_state"] == "ask_selected"
    assert len(ask_options["options"]) >= 2

    selected_id = ask_options["options"][0]["option_id"]
    scripts = post_mapc_v3_script(
        {
            "session": ask_options["session"],
            "options": ask_options["options"],
            "selected_option_id": selected_id,
            "confirmed": True,
            "concern_text": "Stop wildfires",
        },
        user_id="v3-user-3",
    )
    assert scripts["session"]["session_state"] == "script_shown"
    assert 43 <= _wc(scripts["live_script"]) <= 97
    assert 43 <= _wc(scripts["voicemail_script"]) <= 97


def test_mapc_v3_rejects_ask_options_before_background(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("mapc_pipeline_v3_enabled", "true")
    session_id = str(uuid.uuid4())
    interpret = post_mapc_v3_interpret(
        {
            "session_id": session_id,
            "raw_user_issue": "Marriage equality",
            "concern_text": "Marriage equality",
            "session_state": "new",
        },
        user_id="v3-user-4",
    )
    with pytest.raises(Exception) as exc_info:
        post_mapc_v3_ask_options(
            {
                "session": interpret["session"],
                "require_bill_ref": False,
                "concern_text": "Marriage equality",
            },
            user_id="v3-user-4",
        )
    assert _reason_code(exc_info.value) == "invalid_state_transition"


def test_universal_script_lint_rejects_stop_wildfires_bad_placeholder() -> None:
    live = "Hi, my name is [ZIP]. Please support this issue. Thanks."
    vm = "Hi, my name is [ZIP]. Please support this issue. Thanks."
    ok, reason = _universal_mapc_script_lint_ok(
        live_script=live,
        voicemail_script=vm,
        raw_user_issue="Stop wildfires",
    )
    assert ok is False
    assert reason and "blocked_phrase" in reason


def test_universal_script_lint_rejects_marriage_equality_malformed_ask() -> None:
    live = (
        "Hi, I'm a constituent from [ZIP]. "
        "Please support on congressional action on support marriage equality. "
        "Will the office share its position?"
    )
    vm = live
    ok, reason = _universal_mapc_script_lint_ok(
        live_script=live,
        voicemail_script=vm,
        raw_user_issue="Marriage equality",
    )
    assert ok is False
    assert reason and "malformed_ask" in reason


def test_universal_script_lint_rejects_gas_prices_raw_text_copy() -> None:
    raw_issue = "gas prices are too high and hurting families"
    live = (
        "Hi, I'm a constituent from [ZIP]. "
        "I'm calling about gas prices are too high and hurting families. "
        "Please investigate price gouging. Will the office share its position?"
    )
    vm = (
        "Hi, I'm a constituent from [ZIP]. "
        "I'm calling about gas prices are too high and hurting families. "
        "Please require reporting from major fuel suppliers. What is the member's next step?"
    )
    ok, reason = _universal_mapc_script_lint_ok(
        live_script=live,
        voicemail_script=vm,
        raw_user_issue=raw_issue,
    )
    assert ok is False
    assert reason and "direct_verbatim_copy" in reason
