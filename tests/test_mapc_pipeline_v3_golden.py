from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import pytest

from backend.civic_api.api import (
    post_mapc_v3_ask_options,
    post_mapc_v3_background,
    post_mapc_v3_interpret,
    post_mapc_v3_script,
)


def _word_count(text: str) -> int:
    return len(re.findall(r"\b[\w'\-]+\b", text))


def _no_disallowed_placeholders(text: str) -> bool:
    tokens = re.findall(r"\[[^\]]+\]", text)
    return all(token == "[ZIP]" for token in tokens)


def _load_cases() -> list[dict[str, object]]:
    path = Path(__file__).parent / "fixtures" / "mapc_v3_golden_cases.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", _load_cases(), ids=lambda case: str(case.get("name", "mapc_v3_case")))
def test_mapc_v3_golden_stage_flow(case: dict[str, object], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("mapc_pipeline_v3_enabled", "true")
    session_id = str(uuid.uuid4())
    raw_issue = str(case["raw_issue"])
    followups = [str(item) for item in case.get("followups", [])]
    expected = dict(case.get("expected", {}))

    interpret = post_mapc_v3_interpret(
        {
            "session_id": session_id,
            "raw_user_issue": raw_issue,
            "concern_text": raw_issue,
            "session_state": "new",
        },
        user_id="golden-user",
    )
    session = interpret["session"]

    for followup in followups:
        if not session.get("needs_clarification"):
            break
        interpret = post_mapc_v3_interpret(
            {
                "session_id": session_id,
                "raw_user_issue": followup,
                "concern_text": followup,
                "session_state": session.get("session_state", "issue_received"),
                "accumulated_context": session.get("accumulated_context", []),
                "clarification_turn_count": session.get("clarification_turn_count", 0),
            },
            user_id="golden-user",
        )
        session = interpret["session"]

    assert session["session_state"] == "issue_received"
    assert session["needs_clarification"] is False

    ask = post_mapc_v3_ask_options(
        {
            "session": session,
            "require_bill_ref": False,
            "concern_text": raw_issue,
        },
        user_id="golden-user",
    )
    options = ask["options"]
    assert len(options) >= int(expected.get("min_options", 2))
    assert ask["session"]["session_state"] == "ask_selected"

    background = post_mapc_v3_background(
        {
            "session": ask["session"],
            "concern_text": raw_issue,
        },
        user_id="golden-user",
    )
    if bool(expected.get("requires_background", True)):
        assert background["background_text"]

    scripts = post_mapc_v3_script(
        {
            "session": ask["session"],
            "options": options,
            "selected_option_id": options[0]["option_id"],
            "confirmed": True,
            "concern_text": raw_issue,
        },
        user_id="golden-user",
    )
    assert scripts["session"]["session_state"] == "script_shown"
    assert 43 <= _word_count(scripts["live_script"]) <= 97
    assert 43 <= _word_count(scripts["voicemail_script"]) <= 97
    assert _no_disallowed_placeholders(scripts["live_script"])
    assert _no_disallowed_placeholders(scripts["voicemail_script"])
