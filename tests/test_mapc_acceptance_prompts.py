from __future__ import annotations

import re

from backend.civic_api.issue_brief_service import IssueBriefService
from backend.civic_api.models import Ask, RepContext, RepTarget, ScriptPackageRequest
from backend.civic_api.repository import InMemoryCivicRepository
from backend.civic_api.script_package_service import ScriptPackageService
from backend.civic_api.service import CivicService


def _seed_reps(repo: InMemoryCivicRepository, user_id: str) -> None:
    repo.seed_reps(
        user_id,
        [
            RepContext(
                rep_id="house-1",
                rep_name="Ayanna Pressley",
                office_type="U.S. Representative",
                chamber="house",
                district="MA-7",
                state="MA",
                primary_phone_number="(202) 225-5111",
            ),
            RepContext(
                rep_id="senate-1",
                rep_name="Edward Markey",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="MA",
                primary_phone_number="(202) 224-2742",
            ),
            RepContext(
                rep_id="senate-2",
                rep_name="Elizabeth Warren",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="MA",
                primary_phone_number="(202) 224-4543",
            ),
        ],
    )


def _word_count(text: str) -> int:
    return len(re.findall(r"\b[\w'\-]+\b", text))


def _ask_signals(ask: Ask) -> tuple[str, ...]:
    if ask is Ask.SUPPORT:
        return ("support", "back", "in favor")
    if ask is Ask.OPPOSE:
        return ("oppose", "against", "reject")
    if ask is Ask.SEEK_OVERSIGHT:
        return ("oversight", "investigate", "hearing")
    if ask is Ask.VOTE_YES:
        return ("vote yes", "yes on")
    if ask is Ask.VOTE_NO:
        return ("vote no", "no on")
    return ("support", "oppose", "position")


def test_mapc_script_package_acceptance_matrix_12_prompts() -> None:
    repo = InMemoryCivicRepository()
    user_id = "acceptance-user"
    _seed_reps(repo, user_id)
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    prompts: list[tuple[str, Ask]] = [
        ("Stop AI data centers near neighborhoods and require federal oversight for grid and water impacts", Ask.SEEK_OVERSIGHT),
        ("Gun control", Ask.SUPPORT),
        ("Support federal funding for therapeutic riding programs for veterans through VA pilot grants", Ask.SUPPORT),
        ("Support stronger crypto consumer protections and anti-fraud standards", Ask.SUPPORT),
        ("Support Ukraine security aid with strict congressional oversight", Ask.SUPPORT),
        ("Protect SNAP food assistance and reject harmful cuts", Ask.SUPPORT),
        ("Lower prescription drug costs and cap out-of-pocket expenses", Ask.SUPPORT),
        ("Protect and expand Pell Grants for low-income students", Ask.SUPPORT),
        ("Protect trans rights and access to gender-affirming care", Ask.SUPPORT),
        ("Oppose unauthorized military strikes on Iran", Ask.OPPOSE),
        ("Support TPS extension for Haitians while conditions remain dangerous", Ask.SUPPORT),
        ("Expand housing supply and prevent homelessness", Ask.SUPPORT),
    ]

    blocked_markers = (
        "current status:",
        "latest item:",
        "policy focus:",
        "house office",
        "senate office",
        "congressional office",
        "issue packet",
    )

    for concern_text, ask in prompts:
        response = script_service.create_package(
            ScriptPackageRequest(
                user_id=user_id,
                concern_text=concern_text,
                selected_ask=ask,
                target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
                allow_revision=True,
            )
        )

        assert response.status.value == "ok", concern_text
        assert len(response.office_overlays) == 3, concern_text

        signals = _ask_signals(ask)
        for overlay in response.office_overlays:
            live = overlay.live_script_final
            voicemail = overlay.voicemail_script_final
            combined = f"{live}\n{voicemail}".lower()

            assert _word_count(live) >= 55, concern_text
            assert _word_count(voicemail) >= 25, concern_text
            assert overlay.rep_name.lower().split()[-1] in combined, concern_text
            assert any(signal in combined for signal in signals), concern_text
            assert "current position" in combined or "position" in combined, concern_text

            for marker in blocked_markers:
                assert marker not in combined, f"{concern_text} leaked marker: {marker}"

