from __future__ import annotations

from backend.civic_api.api import (
    get_call_score_breakdown,
    get_call_score_history,
    get_call_score_summary,
    get_examples,
    get_history,
    get_leaderboard,
    get_leaderboard_me,
    post_assistant_resolve,
    post_call_score_recompute,
    post_calls_confirm,
    post_calls_launch,
    post_calls_log,
)


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
    assert len(response["examples"]) == 10
    if response["examples"]:
        card = response["examples"][0]
        for key in [
            "issue_id",
            "slug",
            "title",
            "category",
            "target_chambers",
            "primary_ask",
            "summary",
            "related_bills",
            "rep_relevance",
            "template_asks",
            "live_script",
            "voicemail_script",
            "supporter_variant",
            "undecided_variant",
            "staffer_variant",
            "voicemail_footer",
            "placeholders",
            "tags",
        ]:
            assert key in card


def test_api_contract_call_score_flow() -> None:
    launch = post_calls_launch(
        {
            "user_id": "contract-score-user",
            "office_id": "office-contract-1",
            "issue_id": "issue-contract-1",
            "source_screen": "issue_call_center",
            "session_id": "session-contract",
        }
    )
    assert launch["ok"] is True
    assert launch["launch_event_id"]

    confirm = post_calls_confirm(
        {
            "user_id": "contract-score-user",
            "launch_event_id": launch["launch_event_id"],
            "completed": True,
        }
    )
    assert confirm["ok"] is True
    assert confirm["call_logged"] is True
    assert confirm["call_score_snapshot"] is not None

    summary = get_call_score_summary("contract-score-user")
    assert "call_score" in summary
    assert "tier_name" in summary

    breakdown = get_call_score_breakdown("contract-score-user")
    assert "components" in breakdown
    assert "activation_points" in breakdown["components"]

    history = get_call_score_history("contract-score-user", limit=5)
    assert "history" in history
    assert len(history["history"]) >= 1

    recompute = post_call_score_recompute({"user_id": "contract-score-user"})
    assert recompute["ok"] is True
    assert "snapshot" in recompute

    leaderboard = get_leaderboard(period_type="daily", limit=10)
    assert "entries" in leaderboard

    me = get_leaderboard_me(user_id="contract-score-user", period_type="daily")
    assert "eligible_verified_call_count" in me
