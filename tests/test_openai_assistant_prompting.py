from __future__ import annotations

import json

from backend.civic_api.openai_assistant import OpenAICivicAssistant


def test_generate_draft_includes_fallback_template_style_examples() -> None:
    assistant = OpenAICivicAssistant(api_key="test-key", model="gpt-4.1-mini")
    captured: dict[str, object] = {}

    def fake_post_json(path: str, payload: dict[str, object]) -> dict[str, object]:
        captured["path"] = path
        captured["payload"] = payload
        response_payload = {
            "issue_title": "Protect Medicaid Coverage",
            "issue_summary": "Caller asks Congress to protect and expand Medicaid coverage.",
            "background": "Medicaid supports millions of low-income Americans and state health systems.",
            "live_script_template": (
                "Hi, my name is [Your Name], and I am a constituent from {LOCATION}. "
                "I am calling to ask {OFFICE_TYPE} {REP_NAME} to {ASK_ACTION} {BILL_OR_ISSUE}. "
                "Congress should expand Medicaid eligibility and funding to cover more low-income adults. "
                "Without coverage, families delay preventive care and face higher emergency costs. "
                "Please share the member's position and planned action. Thank you."
            ),
            "voicemail_script_template": (
                "Hi, this is [Your Name], a constituent from {LOCATION}. "
                "Please ask {OFFICE_TYPE} {REP_NAME} to {ASK_ACTION} {BILL_OR_ISSUE}. "
                "Expanding Medicaid eligibility and funding helps families access preventive care and lowers crisis costs. "
                "Please share the member's position. Thank you."
            ),
            "talking_points": ["eligibility", "funding", "preventive care", "cost impact"],
        }
        return {
            "id": "chatcmpl_test",
            "model": "gpt-4.1-mini",
            "choices": [{"message": {"content": json.dumps(response_payload)}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20},
        }

    assistant._post_json = fake_post_json  # type: ignore[method-assign]
    draft = assistant.generate_draft(
        concern_text="Expand Medicaid",
        selected_ask="support",
        rep_names=["Ayanna Pressley"],
        optional_bill_ref=None,
        user_location="02138",
        broad_issue_mode=False,
        canonical_issue_id="healthcare_medicaid_expansion",
    )

    assert draft is not None
    assert captured.get("path") == "/v1/chat/completions"

    payload = captured.get("payload")
    assert isinstance(payload, dict)
    messages = payload.get("messages")
    assert isinstance(messages, list) and len(messages) == 2

    user_message = messages[1]
    assert isinstance(user_message, dict)
    prompt = user_message.get("content", "")
    assert isinstance(prompt, str)
    assert "Fallback bill template examples" in prompt
    assert "Stop Unauthorized Military Strikes on Iran" in prompt
    assert "style references only" in prompt
    assert "If no specific bill is confirmed, use a plausible congressional action" in prompt
