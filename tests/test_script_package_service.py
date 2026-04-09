from __future__ import annotations

import re

from backend.civic_api.issue_brief_service import IssueBriefService
from backend.civic_api.models import (
    Ask,
    BriefStatus,
    IssueBriefResponse,
    IssueClassifyResponse,
    RepContext,
    RepTarget,
    ScriptChatTurnRequest,
    ScriptPackageFeedbackRequest,
    ScriptPackageRequest,
)
from backend.civic_api.openai_assistant import GeneratedDraft
from backend.civic_api.repository import InMemoryCivicRepository
from backend.civic_api.script_package_service import ScriptPackageService
from backend.civic_api.service import CivicService


def _seed_real_reps(repo: InMemoryCivicRepository, user_id: str) -> None:
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


def test_gun_control_returns_needs_clarification_and_no_final_script() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-1")
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-1",
            concern_text="Gun control",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "needs_clarification"
    assert response.canonical_context is None
    assert response.script_core is None
    assert response.office_overlays == []
    assert response.candidate_issues
    assert response.clarification_question is not None
    assert "background checks" in response.clarification_question.lower()
    assert response.truth_trace is not None
    assert response.truth_trace.classification_reason == "needs_clarification"
    assert response.script_generation_source is None


class _StubAssistant:
    def generate_draft(
        self,
        concern_text: str,
        selected_ask: str,
        rep_names: list[str],
        optional_bill_ref: str | None,
        user_location: str,
        broad_issue_mode: bool = False,
        canonical_issue_id: str | None = None,
    ) -> GeneratedDraft | None:
        _ = concern_text, selected_ask, rep_names, optional_bill_ref, user_location, broad_issue_mode, canonical_issue_id
        return GeneratedDraft(
            issue_title="EQUINE Act Support",
            issue_summary="Support therapeutic riding pilot grants for veterans.",
            background="Congress can fund pilot grants through appropriations and VA directives.",
            live_script_template=(
                "Hi, my name is [Your Name], and I am a constituent in {LOCATION}. "
                "I am calling about {BILL_OR_ISSUE}. "
                "I urge {OFFICE_TYPE} {REP_NAME} to {ASK_ACTION} {BILL_OR_ISSUE} "
                "and support therapeutic riding pilot grants for veterans. "
                "Can you share the member's current position?"
            ),
            voicemail_script_template=(
                "Hi, constituent in {LOCATION} calling about {BILL_OR_ISSUE}. "
                "Please ask {OFFICE_TYPE} {REP_NAME} to {ASK_ACTION} {BILL_OR_ISSUE} "
                "and back therapeutic riding pilot grants. Thank you."
            ),
            talking_points=[
                "Pilot grants can expand veteran access.",
                "Programs support recovery and mobility.",
                "Appropriations language can fund this now.",
                "Request a public position from the office.",
            ],
        )


class _GeneralIssueBriefServiceStub:
    def classify(self, _request) -> IssueClassifyResponse:
        return IssueClassifyResponse(
            status=BriefStatus.OK,
            canonical_issue="general-civic-issue",
            confidence=0.91,
            clarification_question=None,
            candidate_issues=[],
            policy_flags=[],
        )

    def create_brief(self, _request) -> IssueBriefResponse:
        return IssueBriefResponse(
            status=BriefStatus.OK,
            canonical_issue="general-civic-issue",
            summary_neutral="General civic issue summary.",
            current_status="No curated status available.",
            key_facts=[],
            arguments_by_view=[],
            unknowns=[],
            questions_to_consider=[],
            policy_flags=[],
            clarification_question=None,
            review_prompt="Tell me what to change and I can regenerate.",
        )

    def _load_issue_core(self) -> list[dict[str, str]]:
        return []


class _NeedsClarificationBriefServiceStub:
    def classify(self, _request) -> IssueClassifyResponse:
        return IssueClassifyResponse(
            status=BriefStatus.NEEDS_CLARIFICATION,
            canonical_issue="stop-unauthorized-military-strikes-on-iran",
            confidence=0.167,
            clarification_question="I found multiple close issue matches. Which one should I focus on?",
            candidate_issues=[
                "stop-unauthorized-military-strikes-on-iran",
                "protect-trans-rights-and-gender-affirming-care",
            ],
            policy_flags=["ambiguous_issue"],
        )

    def create_brief(self, _request) -> IssueBriefResponse:
        return IssueBriefResponse(
            status=BriefStatus.OK,
            canonical_issue="general-civic-issue",
            summary_neutral="General civic issue summary.",
            current_status="No curated status available.",
            key_facts=[],
            arguments_by_view=[],
            unknowns=[],
            questions_to_consider=[],
            policy_flags=["ambiguous_issue", "ambiguous_generalized", "weak_evidence"],
            clarification_question=None,
            review_prompt="Tell me what to change and I can regenerate.",
        )

    def _load_issue_core(self) -> list[dict[str, str]]:
        return []


def test_llm_routing_sets_llm_full_source_when_draft_generated() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-llm-route")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _StubAssistant()
    script_service = ScriptPackageService(
        civic_service=civic_service,
        issue_brief_service=_GeneralIssueBriefServiceStub(),  # type: ignore[arg-type]
    )

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-llm-route",
            concern_text="Support horses",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.script_generation_source == "llm_full"
    assert response.truth_trace is not None
    assert response.truth_trace.fallback_used == "llm_general_issue_generation"


def test_assault_weapons_bypasses_clarification_and_uses_llm() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-gun-llm")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _StubAssistant()
    script_service = ScriptPackageService(
        civic_service=civic_service,
        issue_brief_service=_NeedsClarificationBriefServiceStub(),  # type: ignore[arg-type]
    )

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-gun-llm",
            concern_text="Stop assault weapons",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.SENATE_1],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.script_generation_source == "llm_full"
    assert response.truth_trace is not None
    assert response.truth_trace.fallback_used in {"llm_generation", "llm_general_issue_generation"}


def test_noise_input_still_returns_clarification() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-noise")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _StubAssistant()
    script_service = ScriptPackageService(
        civic_service=civic_service,
        issue_brief_service=_NeedsClarificationBriefServiceStub(),  # type: ignore[arg-type]
    )

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-noise",
            concern_text="asdf qwerty",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.SENATE_1],
            allow_revision=True,
        )
    )

    assert response.status.value == "needs_clarification"
    assert response.script_generation_source is None
    assert response.office_overlays == []


def test_script_generation_source_present_on_ok_response() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-2")
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-2",
            concern_text="Expand Medicaid",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.canonical_context is not None
    assert response.canonical_context.issue_id == "healthcare_medicaid_expansion"
    assert response.truth_trace is not None
    assert response.script_generation_source in {"template_only", "llm_rewrite", "llm_full"}


def test_script_generation_event_logged_to_repository() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-analytics")
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-analytics",
            concern_text="Expand Medicaid",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE],
            allow_revision=True,
        )
    )

    assert response.package_id
    assert getattr(repo, "_script_generation_events")
    generated_events = [
        row for row in getattr(repo, "_script_generation_events")
        if row.get("event_type") == "generated"
    ]
    assert generated_events
    latest = generated_events[-1]
    assert latest["user_id"] == "user-analytics"
    assert latest["package_id"] == response.package_id
    assert latest["selected_ask"] == "support"
    assert latest["script_generation_source"] in {"template_only", "llm_full", "llm_rewrite"}


def test_feedback_and_mapc_completion_events_logged() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-feedback")
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    script_service.record_feedback(
        ScriptPackageFeedbackRequest(
            user_id="user-feedback",
            package_id="pkg-1",
            decision="accurate",
            chosen_option="Expand Medicaid",
            final_script="Please expand Medicaid eligibility.",
        )
    )
    script_service.record_mapc_completion(
        user_id="user-feedback",
        launch_event_id="launch-1",
        completed=True,
        issue_id="healthcare_medicaid_expansion",
        session_id="session-1",
    )

    rows = getattr(repo, "_script_generation_events")
    assert any(row.get("event_type") == "feedback" and row.get("decision") == "accurate" for row in rows)
    assert any(
        row.get("event_type") == "mapc_completion"
        and row.get("mapc_completed") is True
        and row.get("metadata", {}).get("launch_event_id") == "launch-1"
        for row in rows
    )


def test_script_chat_turn_logged_to_repository() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-chat")
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    script_service.record_chat_turn(
        ScriptChatTurnRequest(
            user_id="user-chat",
            session_id="session-123",
            role="user",
            message_text="Expand Medicaid coverage",
            turn_index=1,
            package_id="pkg-123",
            message_type="user_prompt",
        )
    )

    rows = getattr(repo, "_script_chat_turns")
    assert len(rows) == 1
    assert rows[0]["user_id"] == "user-chat"
    assert rows[0]["session_id"] == "session-123"
    assert rows[0]["role"] == "user"
    assert rows[0]["turn_index"] == 1
    assert rows[0]["message_text"] == "Expand Medicaid coverage"


def test_specific_issue_attempts_llm_when_assistant_available() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-llm-specific")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _StubAssistant()
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-llm-specific",
            concern_text="Expand Medicaid",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.script_generation_source == "llm_full"
    assert response.truth_trace is not None
    assert response.truth_trace.fallback_used == "llm_generation"


def test_medicaid_pro_uses_canonical_display_title() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-title")
    civic_service = CivicService(repository=repo)
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-title",
            concern_text="Medicaid pro",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.canonical_context is not None
    assert response.canonical_context.issue_id == "healthcare_medicaid_expansion"
    assert response.canonical_context.title == "Protect and Expand Medicaid Coverage"
    assert response.truth_trace is not None
    assert response.truth_trace.raw_user_input == "Medicaid pro"


class _NoisyTemplateAssistant:
    def generate_draft(
        self,
        concern_text: str,
        selected_ask: str,
        rep_names: list[str],
        optional_bill_ref: str | None,
        user_location: str,
        broad_issue_mode: bool = False,
        canonical_issue_id: str | None = None,
    ) -> GeneratedDraft | None:
        _ = concern_text, selected_ask, rep_names, optional_bill_ref, user_location, broad_issue_mode, canonical_issue_id
        return GeneratedDraft(
            issue_title="Stop AI Centers",
            issue_summary="Constituents are asking for guardrails on AI data-center expansion.",
            background="This is a fast-moving issue with zoning, water, and power-grid impacts.",
            live_script_template=(
                "Hi, my name is [Your Name], and I am a constituent. "
                "I am calling about {BILL_OR_ISSUE}. "
                "I'm urging U.S. Senator Senate Office 2 to {ASK_ACTION} {BILL_OR_ISSUE}. "
                "Current status: Most recent evidence points to ongoing activity. Latest item: packet update. "
                "Policy focus: additional context. "
                "Can you share the member's current position and next step? Thank you."
            ),
            voicemail_script_template=(
                "Hi, constituent calling about {BILL_OR_ISSUE}. "
                "I'm urging U.S. Representative House Office to {ASK_ACTION} {BILL_OR_ISSUE}. "
                "Latest item: packet update. "
                "Please share the member's current position and next step. Thank you."
            ),
            talking_points=[
                "Keep text phone-natural.",
                "Strip backend metadata markers.",
                "Use real official names.",
                "Keep constituent ask clear.",
            ],
        )


def test_script_package_strips_metadata_and_placeholder_names() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-3")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _NoisyTemplateAssistant()
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-3",
            concern_text="Stop AI data centers near schools",
            selected_ask=Ask.OPPOSE,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "needs_clarification"
    assert response.office_overlays == []
    assert response.script_generation_source is None


class _UnreadableTemplateAssistant:
    def generate_draft(
        self,
        concern_text: str,
        selected_ask: str,
        rep_names: list[str],
        optional_bill_ref: str | None,
        user_location: str,
        broad_issue_mode: bool = False,
        canonical_issue_id: str | None = None,
    ) -> GeneratedDraft | None:
        _ = concern_text, selected_ask, rep_names, optional_bill_ref, user_location, broad_issue_mode, canonical_issue_id
        return GeneratedDraft(
            issue_title="AI Data Centers",
            issue_summary="Constituents want clearer federal oversight.",
            background="Weak draft output to trigger fallback quality generation.",
            live_script_template="Support this now.",
            voicemail_script_template="Support this.",
            talking_points=["force fallback", "quality gate", "readable script", "direct ask"],
        )


def test_script_package_falls_back_when_template_is_not_phone_readable() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-4")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _UnreadableTemplateAssistant()
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-4",
            concern_text="Regulate AI data centers and require energy-impact disclosure",
            selected_ask=Ask.SEEK_OVERSIGHT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "needs_clarification"
    assert response.office_overlays == []
    assert response.script_generation_source is None


def test_script_package_general_fallback_keeps_concrete_user_policy_text() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-5")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = False
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-5",
            concern_text="Support federal funding for therapeutic riding programs for veterans through VA pilot grants",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "needs_clarification"
    assert response.office_overlays == []
    assert response.script_generation_source is None


def test_script_package_prefers_rep_contexts_in_request_for_anonymous_users() -> None:
    repo = InMemoryCivicRepository()
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = False
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="anonymous-user",
            concern_text="Oppose aggressive immigration detention expansion",
            selected_ask=Ask.OPPOSE,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            rep_contexts=[
                RepContext(
                    rep_id="house-real",
                    rep_name="Ayanna Pressley",
                    office_type="U.S. Representative",
                    chamber="house",
                    district="MA-7",
                    state="MA",
                    primary_phone_number="(202) 225-5111",
                ),
                RepContext(
                    rep_id="senate-real-1",
                    rep_name="Edward Markey",
                    office_type="U.S. Senator",
                    chamber="senate",
                    district=None,
                    state="MA",
                    primary_phone_number="(202) 224-2742",
                ),
                RepContext(
                    rep_id="senate-real-2",
                    rep_name="Elizabeth Warren",
                    office_type="U.S. Senator",
                    chamber="senate",
                    district=None,
                    state="MA",
                    primary_phone_number="(202) 224-4543",
                ),
            ],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    names = [overlay.rep_name for overlay in response.office_overlays]
    assert names == ["Ayanna Pressley", "Edward Markey", "Elizabeth Warren"]
    for overlay in response.office_overlays:
        combined = f"{overlay.live_script_final}\n{overlay.voicemail_script_final}".lower()
        assert "house office" not in combined
        assert "senate office" not in combined


def test_script_quality_constraints() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-quality")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = False
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-quality",
            concern_text="Expand Medicaid",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.canonical_context is not None
    assert response.canonical_context.issue_id == "healthcare_medicaid_expansion"
    assert response.office_overlays
    for overlay in response.office_overlays:
        live = overlay.live_script_final
        words = re.findall(r"\b[\w'\-]+\b", live)
        assert len(words) <= 120
        assert "expand medicaid eligibility and funding" in live.lower()
        assert "this request focuses on" not in live.lower()


class _LocationTemplateAssistant:
    def generate_draft(
        self,
        concern_text: str,
        selected_ask: str,
        rep_names: list[str],
        optional_bill_ref: str | None,
        user_location: str,
        broad_issue_mode: bool = False,
        canonical_issue_id: str | None = None,
    ) -> GeneratedDraft | None:
        _ = concern_text, selected_ask, rep_names, optional_bill_ref, user_location, broad_issue_mode, canonical_issue_id
        return GeneratedDraft(
            issue_title="Pothole Repair Funding",
            issue_summary="Support targeted transportation repairs.",
            background="Local roads need immediate maintenance.",
            live_script_template=(
                "Hello, my name is [Your Name], and I live in {LOCATION}. "
                "Please ask {OFFICE_TYPE} {REP_NAME} to {ASK_ACTION} {BILL_OR_ISSUE}."
            ),
            voicemail_script_template=(
                "Hi, this is [Your Name] from {LOCATION}. "
                "Please ask {OFFICE_TYPE} {REP_NAME} to {ASK_ACTION} {BILL_OR_ISSUE}."
            ),
            talking_points=["roads", "safety", "funding", "oversight"],
        )


def test_no_my_area_string() -> None:
    repo = InMemoryCivicRepository()
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = True
    civic_service.openai_assistant = _LocationTemplateAssistant()
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="anonymous-no-location",
            concern_text="Fix potholes",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            rep_contexts=[
                RepContext(
                    rep_id="house-x",
                    rep_name="Ayanna Pressley",
                    office_type="U.S. Representative",
                    chamber="house",
                    district="MA-7",
                    state=None,
                    primary_phone_number="(202) 225-5111",
                )
            ],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    assert response.office_overlays
    for overlay in response.office_overlays:
        combined = f"{overlay.live_script_final}\n{overlay.voicemail_script_final}".lower()
        assert "my area" not in combined
        assert "our area" not in combined


def test_policy_anchor_present() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-anchor")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = False
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-anchor",
            concern_text="Expand Medicaid",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "ok"
    for overlay in response.office_overlays:
        combined = f"{overlay.live_script_final}\n{overlay.voicemail_script_final}"
        assert "Congress should expand Medicaid eligibility and funding to cover more low-income adults." in combined


def test_non_health_issue_unchanged() -> None:
    repo = InMemoryCivicRepository()
    _seed_real_reps(repo, "user-unchanged")
    civic_service = CivicService(repository=repo)
    civic_service.openai_assistant_enabled = False
    brief_service = IssueBriefService(repository=repo)
    script_service = ScriptPackageService(civic_service=civic_service, issue_brief_service=brief_service)

    response = script_service.create_package(
        ScriptPackageRequest(
            user_id="user-unchanged",
            concern_text="Fix potholes",
            selected_ask=Ask.SUPPORT,
            target_reps=[RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2],
            allow_revision=True,
        )
    )

    assert response.status.value == "needs_clarification"
    assert response.canonical_context is None
    assert response.script_generation_source is None
