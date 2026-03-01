from __future__ import annotations

from backend.civic_api.models import Ask, RepContext
from backend.civic_api.script_composer import compose_call_scripts


def test_script_composer_word_limits_and_position_line() -> None:
    rep = RepContext(
        rep_id="r1",
        rep_name="Representative Test",
        office_type="U.S. Representative",
        chamber="house",
        district="CA-9",
        state="CA",
        primary_phone_number="(202) 555-0101",
    )

    live, voicemail, points = compose_call_scripts(
        rep=rep,
        ask=Ask.VOTE_NO,
        issue_title="Industrial chemical safety and enforcement",
        issue_summary="Long summary",
        selected_bill="H.R.9876",
        user_location="CA, 90210",
        reason_badges=["Related bill active in House"],
    )

    assert len(live.split()) <= 90
    assert len(voicemail.split()) <= 50
    assert "current position" in live.lower()
    assert "current position" in voicemail.lower()
    assert len(points) == 3
