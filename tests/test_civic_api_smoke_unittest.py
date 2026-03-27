from __future__ import annotations

import unittest

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


class CivicAPISmokeTests(unittest.TestCase):
    def test_resolve_log_and_history_flow(self) -> None:
        user_id = "unittest-contract-user"
        resolved = post_assistant_resolve(
            {
                "concern_text": "I am concerned about water quality enforcement updates.",
                "selected_ask": "ask_public_statement",
                "target_reps": ["house", "senate_1"],
                "optional_bill_ref": "S.42",
            },
            user_id=user_id,
        )

        self.assertIn("issue_id", resolved)
        self.assertIn("call_briefs", resolved)
        self.assertGreaterEqual(len(resolved["call_briefs"]), 1)

        first = resolved["call_briefs"][0]
        log_result = post_calls_log(
            {
                "rep_id": first["rep_id"],
                "issue_id": first["issue_id"],
                "brief_id": first["brief_id"],
                "outcome": "staffer_reached",
                "staffer_position": "undecided",
                "notes": "Asked for written follow-up",
            },
            user_id=user_id,
        )
        self.assertTrue(log_result["ok"])

        history = get_history(user_id)
        self.assertIn("history", history)
        self.assertGreaterEqual(len(history["history"]), 1)

    def test_score_and_leaderboard_flow(self) -> None:
        user_id = "unittest-score-user"

        launch = post_calls_launch(
            {
                "office_id": "office-contract-1",
                "issue_id": "issue-contract-1",
                "source_screen": "issue_call_center",
                "session_id": "session-contract",
            },
            user_id=user_id,
        )
        self.assertTrue(launch["ok"])
        self.assertTrue(launch["launch_event_id"])

        confirm = post_calls_confirm(
            {
                "launch_event_id": launch["launch_event_id"],
                "completed": True,
            },
            user_id=user_id,
        )
        self.assertTrue(confirm["ok"])
        self.assertTrue(confirm["call_logged"])

        summary = get_call_score_summary(user_id)
        self.assertIn("call_score", summary)

        breakdown = get_call_score_breakdown(user_id)
        self.assertIn("components", breakdown)

        score_history = get_call_score_history(user_id, limit=5)
        self.assertIn("history", score_history)

        recompute = post_call_score_recompute(user_id)
        self.assertTrue(recompute["ok"])

        leaderboard = get_leaderboard(period_type="daily", limit=10)
        self.assertIn("entries", leaderboard)
        if leaderboard["entries"]:
            self.assertIn("user_alias", leaderboard["entries"][0])
            self.assertNotIn("user_id", leaderboard["entries"][0])

        me = get_leaderboard_me(user_id=user_id, period_type="daily")
        self.assertIn("eligible_verified_call_count", me)

    def test_examples_schema_smoke(self) -> None:
        response = get_examples("unittest-examples-user")
        self.assertIn("examples", response)
        self.assertGreaterEqual(len(response["examples"]), 1)


if __name__ == "__main__":
    unittest.main()
