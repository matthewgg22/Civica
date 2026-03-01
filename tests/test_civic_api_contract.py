from __future__ import annotations

from backend.civic_api.api import get_examples, get_history, post_assistant_resolve, post_calls_log


def test_api_contract_resolve_and_history_flow() -> None:
    resolve_payload = {
        "user_id": "contract-user",
        "concern_text": "I am concerned about water quality enforcement updates.",
        "selected_ask": "ask_public_statement",
        "target_reps": ["house", "senate_1"],
        "optional_bill_ref": "S.42",
    }

    resolved = post_assistant_resolve(resolve_payload)
    assert "issue_id" in resolved
    assert "call_briefs" in resolved
    assert len(resolved["call_briefs"]) == 2

    first = resolved["call_briefs"][0]
    log_result = post_calls_log(
        {
            "user_id": "contract-user",
            "rep_id": first["rep_id"],
            "issue_id": first["issue_id"],
            "brief_id": first["brief_id"],
            "outcome": "staffer_reached",
            "staffer_position": "undecided",
            "notes": "Asked for written follow-up",
        }
    )
    assert log_result["ok"] is True

    history = get_history("contract-user")
    assert "history" in history
    assert len(history["history"]) >= 1


def test_api_contract_examples_schema() -> None:
    response = get_examples("contract-user")
    assert "examples" in response
    if response["examples"]:
        card = response["examples"][0]
        for key in [
            "issue_id",
            "title",
            "summary",
            "related_bills",
            "rep_relevance",
            "template_asks",
            "live_script",
            "voicemail_script",
        ]:
            assert key in card
