from __future__ import annotations

import unittest

from backend.civic_api import api


class ParseValidationTests(unittest.TestCase):
    def test_parse_completion_request_coerces_boolean_strings(self) -> None:
        request_true = api.parse_completion_request(
            {"launch_event_id": "launch-1", "completed": "true"},
            user_id="user-1",
        )
        request_false = api.parse_completion_request(
            {"launch_event_id": "launch-2", "completed": "false"},
            user_id="user-1",
        )

        self.assertTrue(request_true.completed)
        self.assertFalse(request_false.completed)

    def test_parse_completion_request_rejects_invalid_boolean(self) -> None:
        with self.assertRaises(ValueError):
            api.parse_completion_request(
                {"launch_event_id": "launch-1", "completed": "not-a-bool"},
                user_id="user-1",
            )

    def test_parse_issue_brief_request_coerces_allow_revision(self) -> None:
        request_true = api.parse_issue_brief_request(
            {"concern_text": "Need script", "allow_revision": "1"},
            user_id="user-1",
        )
        request_false = api.parse_issue_brief_request(
            {"concern_text": "Need script", "allow_revision": "0"},
            user_id="user-1",
        )

        self.assertTrue(request_true.allow_revision)
        self.assertFalse(request_false.allow_revision)

    def test_parse_resolve_request_requires_target_reps_array(self) -> None:
        with self.assertRaises(ValueError):
            api.parse_resolve_request(
                {
                    "concern_text": "Water quality",
                    "selected_ask": "ask_public_statement",
                    "target_reps": "house",
                },
                user_id="user-1",
            )

    def test_parse_log_request_requires_non_empty_rep_id(self) -> None:
        with self.assertRaises(ValueError):
            api.parse_log_request(
                {
                    "rep_id": "   ",
                    "issue_id": "issue-1",
                    "brief_id": "brief-1",
                    "outcome": "staffer_reached",
                },
                user_id="user-1",
            )


class EndpointWrapperTests(unittest.TestCase):
    def test_run_endpoint_maps_bad_request_exceptions_to_http_400(self) -> None:
        def raise_value_error() -> dict[str, object]:
            raise ValueError("invalid payload")

        with self.assertRaises(api.HTTPException) as context:
            api._run_endpoint(
                raise_value_error,
                bad_request_exceptions=(ValueError,),
            )

        exception = context.exception
        if hasattr(exception, "status_code"):
            self.assertEqual(exception.status_code, 400)

    def test_run_endpoint_maps_internal_exceptions_to_http_500(self) -> None:
        def raise_runtime_error() -> dict[str, object]:
            raise RuntimeError("unexpected")

        with self.assertRaises(api.HTTPException) as context:
            api._run_endpoint(raise_runtime_error)

        exception = context.exception
        if hasattr(exception, "status_code"):
            self.assertEqual(exception.status_code, 500)


if __name__ == "__main__":
    unittest.main()
