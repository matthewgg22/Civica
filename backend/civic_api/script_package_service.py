from __future__ import annotations

import logging
import re
import uuid
from typing import Iterable

from .issue_brief_service import IssueBriefService
from .models import (
    Ask,
    BriefStatus,
    IssueBriefRequest,
    IssueClassifyRequest,
    IssueFact,
    RepContext,
    RepTarget,
    ScriptPackageCanonicalContext,
    ScriptPackageCommitteeMatch,
    ScriptPackageOfficeOverlay,
    ScriptPackageRequest,
    ScriptPackageResponse,
    ScriptPackageScriptCore,
    ScriptPackageTruthTrace,
)
from .openai_assistant import GeneratedDraft
from .service import CivicService


_CURATED_BILL_MAP: dict[str, str] = {
    "oppose-the-save-america-act": "SAVE America Act",
    "save-america-act": "SAVE America Act",
    "stop-unauthorized-military-strikes-on-iran": "War Powers Resolution on Iran",
    "healthcare_medicaid_expansion": "Medicaid eligibility and funding expansion",
    "healthcare_medicare_expansion": "Medicare coverage expansion",
}

_CURATED_ACTION_FOCUS: dict[str, str] = {
    "crypto-consumer-protection": "stronger consumer safeguards and anti-fraud standards for digital assets",
    "tsa-staffing-travel-delays": "full TSA staffing and compensation support to reduce checkpoint bottlenecks",
    "hawaii-flood-relief": "federal disaster support and recovery funding for impacted Hawaii communities",
    "executive-accountability-and-oversight": "strong congressional oversight and public accountability actions",
    "ukraine-security-and-humanitarian-support": "continued Ukraine security and humanitarian support with clear congressional oversight",
    "support-tps-extension-for-haitians": "continued Temporary Protected Status safeguards for Haitian families",
    "expand-housing-supply-and-prevent-homelessness": "a balanced package that expands housing supply and lowers rent pressure for low-income renters",
    "healthcare_medicaid_expansion": "expanding Medicaid eligibility and federal funding for low-income adults",
    "healthcare_medicare_expansion": "expanding Medicare coverage and affordability protections for seniors and people with disabilities",
}

_DISPLAY_ISSUE_TITLE_OVERRIDES: dict[str, str] = {
    "healthcare_medicaid_expansion": "Protect and Expand Medicaid Coverage",
    "healthcare_medicare_expansion": "Protect and Expand Medicare Coverage",
}

_ISSUE_COMMITTEE_MAP: dict[str, list[str]] = {
    "crypto-consumer-protection": [
        "Financial Services",
        "Banking, Housing, and Urban Affairs",
        "Agriculture",
    ],
    "tsa-staffing-travel-delays": [
        "Commerce, Science, and Transportation",
        "Homeland Security",
    ],
    "hawaii-flood-relief": [
        "Appropriations",
        "Homeland Security",
        "Transportation and Infrastructure",
    ],
    "executive-accountability-and-oversight": [
        "Judiciary",
        "Oversight and Government Reform",
        "Homeland Security and Governmental Affairs",
    ],
    "federal-nominations-and-confirmations": [
        "Judiciary",
        "Health, Education, Labor, and Pensions",
        "Finance",
        "Foreign Relations",
        "Armed Services",
    ],
    "ukraine-security-and-humanitarian-support": [
        "Foreign Relations",
        "Armed Services",
        "Appropriations",
    ],
    "expand-housing-supply-and-prevent-homelessness": [
        "Banking, Housing, and Urban Affairs",
        "Financial Services",
        "Appropriations",
    ],
}

_SCRIPT_PERSONALIZATION_FIELDS = [
    "rep_name",
    "office_type",
    "chamber",
    "committee_match",
    "leadership_role",
]

logger = logging.getLogger(__name__)


def _log_marker(marker: str, payload: object | None = None) -> None:
    if payload is None:
        logger.info(marker)
        return
    logger.info("%s %s", marker, payload)

_SCRIPT_METADATA_PATTERNS: tuple[str, ...] = (
    r"(?i)\bcurrent status:\s*[^\n.]*\.?",
    r"(?i)\blatest item:\s*[^\n.]*\.?",
    r"(?i)\bpolicy focus:\s*[^\n.]*\.?",
    r"(?i)\badditional context:\s*[^\n.]*\.?",
    r"(?i)\boffice tie-in:\s*[^\n.]*\.?",
    r"(?i)\bthis issue is typically handled in[^\n.]*\.?",
    r"(?i)\bno verified evidence items are available yet[^\n.]*\.?",
    r"(?i)\bmost recent evidence points to ongoing activity[^\n.]*\.?",
)

_SCRIPT_PLACEHOLDER_PATTERNS: tuple[str, ...] = (
    r"(?i)\bu\.?\s*s\.?\s*representative\s+house office\b",
    r"(?i)\bu\.?\s*s\.?\s*senator\s+senate office\s*\d+\b",
    r"(?i)\bhouse office\b",
    r"(?i)\bsenate office\s*\d*\b",
    r"(?i)\bcongressional office\b",
    r"\{OFFICE_TYPE\}",
    r"\{REP_NAME\}",
    r"\{ASK_ACTION\}",
    r"\{LOCATION\}",
    r"\{BILL_OR_ISSUE\}",
)

_ASK_SIGNALS_BY_ASK: dict[Ask, tuple[str, ...]] = {
    Ask.SUPPORT: ("support", "back", "in favor"),
    Ask.OPPOSE: ("oppose", "against", "reject"),
    Ask.COSPONSOR: ("cosponsor", "co-sponsor"),
    Ask.VOTE_YES: ("vote yes", "yes on"),
    Ask.VOTE_NO: ("vote no", "no on"),
    Ask.SEEK_OVERSIGHT: ("oversight", "investigate", "hearing"),
    Ask.ASK_PUBLIC_STATEMENT: ("public statement", "speak out"),
    Ask.ASK_AMENDMENT: ("amendment", "amend"),
}

_BANNED_ROBOTIC_PHRASES: tuple[str, ...] = (
    "this request focuses on",
    "this directly affects people in my community",
    "could you share the member's current position and next step on this request?",
)


class ScriptPackageService:
    def __init__(self, civic_service: CivicService, issue_brief_service: IssueBriefService) -> None:
        self.civic_service = civic_service
        self.issue_brief_service = issue_brief_service

    def create_package(self, request: ScriptPackageRequest) -> ScriptPackageResponse:
        package_id = str(uuid.uuid4())
        normalized_input = _normalize_text(request.concern_text)
        classify = self.issue_brief_service.classify(
            IssueClassifyRequest(
                user_id=request.user_id,
                concern_text=request.concern_text,
                requested_output="script_package",
            )
        )
        _log_marker("=== ISSUE CLASSIFY START ===")
        _log_marker(
            "=== ISSUE CLASSIFY PAYLOAD ===",
            classify.model_dump() if hasattr(classify, "model_dump")
            else classify.dict() if hasattr(classify, "dict")
            else classify.to_dict() if hasattr(classify, "to_dict")
            else classify.__dict__
        )
        _log_marker("=== ISSUE CLASSIFY END ===")

        if classify.status is BriefStatus.REFUSED:
            return ScriptPackageResponse(
                status=BriefStatus.REFUSED,
                package_id=package_id,
                canonical_context=None,
                script_core=None,
                office_overlays=[],
                review_can_regenerate=True,
                review_regenerate_hint="Try reframing as an issue-focused civic request.",
                script_generation_source=None,
                truth_trace=ScriptPackageTruthTrace(
                    normalized_input=normalized_input,
                    canonical_issue_id="policy_restricted",
                    classification_reason="policy_refusal",
                    bill_source="none",
                    personalization_fields_used=[],
                    fallback_used="refusal",
                    raw_user_input=request.concern_text,
                    refusal_reason="Request asked for disallowed campaign/endorsement or harmful content.",
                ),
                policy_flags=classify.policy_flags,
            )

        if classify.status is BriefStatus.NEEDS_CLARIFICATION:
            if _should_force_generation_after_clarification(
                concern_text=request.concern_text,
                ask=request.selected_ask,
            ):
                _log_marker(
                    "=== SCRIPT PACKAGE ROUTING DECISION ===",
                    {
                        "status": "needs_clarification_bypassed",
                        "reason": "broad_civic_request_force_generation",
                        "canonical_issue": classify.canonical_issue,
                        "candidate_issues": classify.candidate_issues,
                        "script_generation_source": "pending",
                    }
                )
            else:
                clarification_hint = _clarification_question_for_classification(
                    concern_text=request.concern_text,
                    default_question=classify.clarification_question,
                )
                _log_marker(
                    "=== SCRIPT PACKAGE ROUTING DECISION ===",
                    {
                        "status": "needs_clarification",
                        "stop_after_classification": True,
                        "canonical_issue": classify.canonical_issue,
                        "candidate_issues": classify.candidate_issues,
                        "script_generation_source": None,
                    }
                )
                return ScriptPackageResponse(
                    status=BriefStatus.NEEDS_CLARIFICATION,
                    package_id=package_id,
                    canonical_context=None,
                    script_core=None,
                    office_overlays=[],
                    review_can_regenerate=True,
                    review_regenerate_hint=clarification_hint,
                    clarification_question=clarification_hint,
                    candidate_issues=classify.candidate_issues,
                    script_generation_source=None,
                    truth_trace=ScriptPackageTruthTrace(
                        normalized_input=normalized_input,
                        canonical_issue_id=(classify.canonical_issue or "unspecified").strip().lower() or "unspecified",
                        classification_reason="needs_clarification",
                        bill_source="none",
                        personalization_fields_used=[],
                        fallback_used="clarification_required",
                        raw_user_input=request.concern_text,
                        refusal_reason=None,
                    ),
                    policy_flags=classify.policy_flags,
                )

        brief = self.issue_brief_service.create_brief(
            IssueBriefRequest(
                user_id=request.user_id,
                concern_text=request.concern_text,
                requested_output="script_package",
                allow_revision=request.allow_revision,
            )
        )
        _log_marker("=== ISSUE BRIEF START ===")
        _log_marker(
            "=== ISSUE BRIEF PAYLOAD ===",
            brief.model_dump() if hasattr(brief, "model_dump")
            else brief.dict() if hasattr(brief, "dict")
            else brief.to_dict() if hasattr(brief, "to_dict")
            else brief.__dict__
        )
        _log_marker("=== ISSUE BRIEF END ===")

        if brief.status is BriefStatus.REFUSED:
            return ScriptPackageResponse(
                status=BriefStatus.REFUSED,
                package_id=package_id,
                canonical_context=None,
                script_core=None,
                office_overlays=[],
                review_can_regenerate=True,
                review_regenerate_hint=brief.review_prompt or "Try reframing as an issue-focused civic request.",
                script_generation_source=None,
                truth_trace=ScriptPackageTruthTrace(
                    normalized_input=normalized_input,
                    canonical_issue_id="policy_restricted",
                    classification_reason="policy_refusal",
                    bill_source="none",
                    personalization_fields_used=[],
                    fallback_used="refusal",
                    raw_user_input=request.concern_text,
                    refusal_reason=brief.summary_neutral,
                ),
                policy_flags=brief.policy_flags,
            )

        if brief.status is BriefStatus.NEEDS_CLARIFICATION:
            clarification_hint = (
                brief.clarification_question
                or brief.review_prompt
                or "I need one clarification before generating your scripts."
            )
            return ScriptPackageResponse(
                status=BriefStatus.NEEDS_CLARIFICATION,
                package_id=package_id,
                canonical_context=None,
                script_core=None,
                office_overlays=[],
                review_can_regenerate=True,
                review_regenerate_hint=clarification_hint,
                clarification_question=clarification_hint,
                candidate_issues=[],
                script_generation_source=None,
                truth_trace=ScriptPackageTruthTrace(
                    normalized_input=normalized_input,
                    canonical_issue_id=(brief.canonical_issue or "unspecified").strip().lower() or "unspecified",
                    classification_reason="requires_user_clarification",
                    bill_source="none",
                    personalization_fields_used=[],
                    fallback_used="clarification_required",
                    raw_user_input=request.concern_text,
                    refusal_reason=None,
                ),
                policy_flags=brief.policy_flags,
            )

        canonical_issue_id = (
            brief.canonical_issue.strip().lower()
            or classify.canonical_issue.strip().lower()
            or "general-civic-issue"
        )
        forced_issue_id = _force_policy_issue_from_concern(request.concern_text)
        force_policy_context = (
            forced_issue_id in {"healthcare_medicaid_expansion", "healthcare_medicare_expansion"}
            and (
                classify.status is BriefStatus.NEEDS_CLARIFICATION
                or "ambiguous_issue" in classify.policy_flags
                or "ambiguous_generalized" in brief.policy_flags
                or canonical_issue_id == "general-civic-issue"
            )
        )
        if canonical_issue_id in {"unspecified", "policy_restricted"}:
            canonical_issue_id = "general-civic-issue"
        if force_policy_context:
            canonical_issue_id = forced_issue_id
        force_broad_issue_generation = (
            _is_broad_advocacy_request(request.concern_text, request.selected_ask)
            and (
                canonical_issue_id == "general-civic-issue"
                or "ambiguous_issue" in classify.policy_flags
                or "ambiguous_generalized" in brief.policy_flags
            )
        )

        display_issue_title = self._resolve_issue_title(canonical_issue_id)
        title = display_issue_title

        bill_source, resolved_bill = self._resolve_bill_reference(
            canonical_issue_id=canonical_issue_id,
            optional_bill_ref=request.optional_bill_ref,
        )
        derived_target = _derive_issue_reference(request.concern_text)
        bill_display_text = resolved_bill or derived_target or "this issue"
        related_bills = [resolved_bill] if resolved_bill else []

        selected_targets = request.target_reps or [RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2]
        reps = self._select_target_reps(
            user_id=request.user_id,
            targets=selected_targets,
            rep_contexts=request.rep_contexts,
        )
        generated_draft = self._generate_llm_draft_if_needed(
            request=request,
            canonical_issue_id=canonical_issue_id,
            policy_flags=brief.policy_flags,
            reps=reps,
            force_policy_context=force_policy_context,
            force_broad_issue_generation=force_broad_issue_generation,
        )
        script_generation_source = "llm_full" if generated_draft is not None else "template_only"
        if (
            generated_draft is not None
            and canonical_issue_id == "general-civic-issue"
            and generated_draft.issue_title.strip()
        ):
            title = generated_draft.issue_title.strip()

        key_facts = brief.key_facts[:3]
        evidence_quality = "sufficient" if len(brief.key_facts) >= 2 else "limited"
        evidence_warning = None
        if evidence_quality != "sufficient":
            evidence_warning = "Evidence is limited; script uses broad issue framing."

        common_ask_phrase = _ask_phrase(request.selected_ask)
        action_focus = _issue_action_focus(canonical_issue_id, title, request.concern_text)
        if action_focus and _normalize_text(action_focus).lower() == _normalize_text(bill_display_text).lower():
            action_focus = ""
        reason_line = _build_reason_line(
            key_facts=key_facts,
            concern_text=request.concern_text,
            issue_target=bill_display_text,
        )
        if _is_medicaid_concern(request.concern_text):
            reason_line = (
                "Medicaid currently covers more than 70 million people, and coverage gaps still leave many families without care."
            )
        if action_focus and action_focus.lower() in reason_line.lower():
            reason_line = "This issue has a direct impact on constituents and deserves a clear public response."
        action_focus_sentence = (
            f"The core focus is {action_focus}." if action_focus else ""
        )
        if generated_draft is not None:
            location_label = _location_label_for_request(request, reps[0][1] if reps else None)
            core = ScriptPackageScriptCore(
                live_script_core=_render_generated_template(
                    generated_draft.live_script_template,
                    office_type="{OFFICE_TYPE}",
                    rep_name="{REP_NAME}",
                    ask=request.selected_ask,
                    bill_or_issue=bill_display_text,
                    location_label=location_label,
                    max_words=115,
                ),
                voicemail_script_core=_render_generated_template(
                    generated_draft.voicemail_script_template,
                    office_type="{OFFICE_TYPE}",
                    rep_name="{REP_NAME}",
                    ask=request.selected_ask,
                    bill_or_issue=bill_display_text,
                    location_label=location_label,
                    max_words=65,
                ),
            )
        else:
            core = ScriptPackageScriptCore(
                live_script_core=(
                    "Hi, my name is [Your Name], and I am a constituent. "
                    f"I am calling about {title}. "
                    f"I'm urging {{OFFICE_TYPE}} {{REP_NAME}} to {common_ask_phrase} {bill_display_text}. "
                    f"{action_focus_sentence} "
                    f"{reason_line} "
                    "Can you share the member's current position and next step on this issue? Thank you."
                ),
                voicemail_script_core=(
                    "Hi, constituent calling about "
                    f"{title}. I'm urging {{OFFICE_TYPE}} {{REP_NAME}} to {common_ask_phrase} {bill_display_text}. "
                    f"{reason_line} "
                    "Please share the member's current position and next step. Thank you."
                ),
            )

        overlays: list[ScriptPackageOfficeOverlay] = []
        likely_committees = _ISSUE_COMMITTEE_MAP.get(canonical_issue_id, [])
        rep_committees_by_rep_id = self.civic_service._load_rep_committees_for_examples([rep for _, rep in reps])
        for rep_target, rep in reps:
            scored = self.civic_service._score_rep(
                rep=rep,
                issue_title=title,
                bill_ref=resolved_bill,
            )
            committee_match = _build_committee_match(
                reason_badges=scored.reason_badges,
                likely_committees=likely_committees,
                rep_committees=rep_committees_by_rep_id.get(rep.rep_id, []),
            )
            role_overlays = _role_overlays_for(rep.office_type)
            location_label = _location_label_for_request(request, rep)
            if generated_draft is not None:
                rendered_live_script = _render_generated_template(
                    generated_draft.live_script_template,
                    office_type=rep.office_type,
                    rep_name=rep.rep_name,
                    ask=request.selected_ask,
                    bill_or_issue=bill_display_text,
                    location_label=location_label,
                    max_words=115,
                )
                rendered_voicemail_script = _render_generated_template(
                    generated_draft.voicemail_script_template,
                    office_type=rep.office_type,
                    rep_name=rep.rep_name,
                    ask=request.selected_ask,
                    bill_or_issue=bill_display_text,
                    location_label=location_label,
                    max_words=65,
                )
                _log_marker("=== GENERATED LIVE SCRIPT RENDERED START ===")
                _log_marker("=== GENERATED LIVE SCRIPT RENDERED ===", rendered_live_script)
                _log_marker("=== GENERATED LIVE SCRIPT RENDERED END ===")

                _log_marker("=== GENERATED VOICEMAIL SCRIPT RENDERED START ===")
                _log_marker("=== GENERATED VOICEMAIL SCRIPT RENDERED ===", rendered_voicemail_script)
                _log_marker("=== GENERATED VOICEMAIL SCRIPT RENDERED END ===")
                safe_reason_line = _safe_reason_line_for_generated(reason_line, bill_display_text)
                live_script = _prepare_generated_spoken_script(
                    raw_script=rendered_live_script,
                    script_type="live",
                    office_type=rep.office_type,
                    rep_name=rep.rep_name,
                    ask=request.selected_ask,
                    fallback_issue_title=title,
                    fallback_bill_or_issue=bill_display_text,
                    fallback_reason_line=safe_reason_line,
                    fallback_action_focus=action_focus,
                )
                voicemail_script = _prepare_generated_spoken_script(
                    raw_script=rendered_voicemail_script,
                    script_type="voicemail",
                    office_type=rep.office_type,
                    rep_name=rep.rep_name,
                    ask=request.selected_ask,
                    fallback_issue_title=title,
                    fallback_bill_or_issue=bill_display_text,
                    fallback_reason_line=safe_reason_line,
                    fallback_action_focus=action_focus,
                )
                _log_marker("=== GENERATED LIVE SCRIPT FINAL START ===")
                _log_marker("=== GENERATED LIVE SCRIPT FINAL ===", live_script)
                _log_marker("=== GENERATED LIVE SCRIPT FINAL END ===")

                _log_marker("=== GENERATED VOICEMAIL SCRIPT FINAL START ===")
                _log_marker("=== GENERATED VOICEMAIL SCRIPT FINAL ===", voicemail_script)
                _log_marker("=== GENERATED VOICEMAIL SCRIPT FINAL END ===")
            else:
                live_script = _render_for_rep(core.live_script_core, rep.office_type, rep.rep_name)
                voicemail_script = _render_for_rep(core.voicemail_script_core, rep.office_type, rep.rep_name)
                live_script = _prepare_spoken_script(
                    raw_script=live_script,
                    script_type="live",
                    office_type=rep.office_type,
                    rep_name=rep.rep_name,
                    ask=request.selected_ask,
                    issue_title=title,
                    bill_or_issue=bill_display_text,
                    reason_line=reason_line,
                    action_focus=action_focus,
                )
                voicemail_script = _prepare_spoken_script(
                    raw_script=voicemail_script,
                    script_type="voicemail",
                    office_type=rep.office_type,
                    rep_name=rep.rep_name,
                    ask=request.selected_ask,
                    issue_title=title,
                    bill_or_issue=bill_display_text,
                    reason_line=reason_line,
                    action_focus=action_focus,
                )

            if _is_medicaid_concern(request.concern_text):
                live_script = _ensure_medicaid_policy_anchor(live_script)
                voicemail_script = _ensure_medicaid_policy_anchor(voicemail_script)
            live_script = _apply_final_text_quality_guard(
                script=live_script,
                script_type="live",
                issue_title=title,
                concern_text=request.concern_text,
                location_label=location_label,
                office_type=rep.office_type,
                rep_name=rep.rep_name,
                ask=request.selected_ask,
                fallback_bill_or_issue=bill_display_text,
                fallback_reason_line=reason_line,
                fallback_action_focus=action_focus,
            )
            voicemail_script = _apply_final_text_quality_guard(
                script=voicemail_script,
                script_type="voicemail",
                issue_title=title,
                concern_text=request.concern_text,
                location_label=location_label,
                office_type=rep.office_type,
                rep_name=rep.rep_name,
                ask=request.selected_ask,
                fallback_bill_or_issue=bill_display_text,
                fallback_reason_line=reason_line,
                fallback_action_focus=action_focus,
            )

            overlay_related_committees = committee_match.matched_committees or likely_committees
            if not overlay_related_committees:
                overlay_related_committees = rep_committees_by_rep_id.get(rep.rep_id, [])[:3]

            overlays.append(
                ScriptPackageOfficeOverlay(
                    rep_id=rep.rep_id,
                    rep_name=rep.rep_name,
                    office_type=rep.office_type,
                    chamber=rep.chamber,
                    committee_match=committee_match,
                    role_overlays=role_overlays,
                    live_script_final=live_script,
                    voicemail_script_final=voicemail_script,
                    related_committees=overlay_related_committees,
                )
            )

        fallback_used = "none"
        if evidence_quality != "sufficient":
            fallback_used = "weak_evidence_fallback"
        if "auto_selected_from_ambiguous" in brief.policy_flags:
            fallback_used = "low_confidence_autopick"
        if "ambiguous_generalized" in brief.policy_flags:
            fallback_used = "general_issue_fallback"
        if canonical_issue_id == "general-civic-issue":
            fallback_used = "general_issue_fallback"
        if generated_draft is not None:
            fallback_used = "llm_generation"
        if generated_draft is not None and canonical_issue_id == "general-civic-issue":
            fallback_used = "llm_general_issue_generation"

        classification_reason = "retrieval"
        if "normalized_personal_antipathy" in brief.policy_flags:
            classification_reason = "deterministic_normalization"
        elif "auto_selected_from_ambiguous" in brief.policy_flags:
            classification_reason = "low_confidence_autopick"
        elif "ambiguous_generalized" in brief.policy_flags:
            classification_reason = "fallback_general"
        elif canonical_issue_id == "general-civic-issue":
            classification_reason = "fallback_general"
        if generated_draft is not None and canonical_issue_id == "general-civic-issue":
            classification_reason = "llm_general_issue"

        summary_plain = brief.summary_neutral
        if generated_draft is not None:
            summary_plain = _merge_summary(generated_draft.issue_summary, generated_draft.background) or summary_plain

        canonical_context = ScriptPackageCanonicalContext(
            issue_id=canonical_issue_id,
            title=title,
            summary_plain=summary_plain,
            common_ask=request.selected_ask,
            related_bills=related_bills,
            bill_source=bill_source,
            bill_display_text=bill_display_text,
            evidence_quality=evidence_quality,
            evidence_warning=evidence_warning,
            key_facts=key_facts if key_facts else [IssueFact(
                fact="Evidence is limited; this script uses broad issue framing.",
                source_name="VoteNow",
                source_url=None,
                published_at=None,
            )],
        )

        _log_marker(
            "=== SCRIPT PACKAGE ROUTING DECISION ===",
            {
                "status": "ok",
                "canonical_issue_id": canonical_issue_id,
                "display_issue_title": title,
                "script_generation_source": script_generation_source,
                "fallback_used": fallback_used,
                "generated_draft_used": generated_draft is not None,
            }
        )

        return ScriptPackageResponse(
            status=BriefStatus.OK,
            package_id=package_id,
            canonical_context=canonical_context,
            script_core=core,
            office_overlays=overlays,
            review_can_regenerate=True,
            review_regenerate_hint=brief.review_prompt or "Tell me what to change and I can regenerate.",
            script_generation_source=script_generation_source,
            truth_trace=ScriptPackageTruthTrace(
                normalized_input=normalized_input,
                canonical_issue_id=canonical_issue_id,
                classification_reason=classification_reason,
                bill_source=bill_source,
                personalization_fields_used=list(_SCRIPT_PERSONALIZATION_FIELDS),
                fallback_used=fallback_used,
                raw_user_input=request.concern_text,
                refusal_reason=None,
            ),
            policy_flags=brief.policy_flags,
        )

    def _generate_llm_draft_if_needed(
        self,
        request: ScriptPackageRequest,
        canonical_issue_id: str,
        policy_flags: list[str],
        reps: list[tuple[RepTarget, RepContext]],
        force_policy_context: bool = False,
        force_broad_issue_generation: bool = False,
    ) -> GeneratedDraft | None:
        llm_eligible_by_issue = (
            canonical_issue_id == "general-civic-issue"
            or "ambiguous_issue" in policy_flags
            or "ambiguous_generalized" in policy_flags
            or force_policy_context
            or force_broad_issue_generation
        )
        # For MAPC script-package requests, we attempt OpenAI whenever the request is non-empty
        # and an ask is present, then gracefully fall back if no usable draft is returned.
        llm_force_attempt = bool(_normalize_text(request.concern_text)) and request.selected_ask is not None
        llm_attempt_reason = "issue_eligible" if llm_eligible_by_issue else "forced_nonempty_request"

        _log_marker("=== LLM FALLBACK CHECK START ===")
        _log_marker("=== LLM FALLBACK CHECK CONTEXT ===", {
            "canonical_issue_id": canonical_issue_id,
            "policy_flags": policy_flags,
            "openai_enabled": self.civic_service.openai_assistant_enabled,
            "has_assistant": self.civic_service.openai_assistant is not None,
            "force_policy_context": force_policy_context,
            "force_broad_issue_generation": force_broad_issue_generation,
            "llm_eligible_by_issue": llm_eligible_by_issue,
            "llm_force_attempt": llm_force_attempt,
            "llm_attempt_reason": llm_attempt_reason,
            "selected_ask": request.selected_ask.value,
            "raw_user_input_preview": _preview_for_log(request.concern_text, max_chars=220),
        })

        if not (llm_eligible_by_issue or llm_force_attempt):
            _log_marker("=== LLM FALLBACK SKIPPED: issue not eligible ===")
            _log_marker("=== LLM FALLBACK CHECK END ===")
            return None
        if not self.civic_service.openai_assistant_enabled:
            _log_marker("=== LLM FALLBACK SKIPPED: assistant disabled ===")
            _log_marker("=== LLM FALLBACK CHECK END ===")
            return None
        assistant = self.civic_service.openai_assistant
        if assistant is None:
            _log_marker("=== LLM FALLBACK SKIPPED: assistant missing ===")
            _log_marker("=== LLM FALLBACK CHECK END ===")
            return None

        rep_names = [rep.rep_name for _, rep in reps if rep.rep_name.strip()]
        user_location = _location_label_for_request(request, reps[0][1] if reps else None)
        llm_generation_mode = "llm_full"
        _log_marker(
            "=== LLM FALLBACK REQUEST CONTEXT ===",
            {
                "model": getattr(assistant, "model", "unknown"),
                "generation_mode": llm_generation_mode,
                "is_template_rewrite": False,
                "canonical_issue_id": canonical_issue_id,
                "selected_ask": request.selected_ask.value,
                "raw_user_input": _preview_for_log(request.concern_text, max_chars=220),
                "context_preview": {
                    "rep_names": rep_names[:3],
                    "optional_bill_ref": _preview_for_log(request.optional_bill_ref or "", max_chars=120),
                    "user_location": _preview_for_log(user_location, max_chars=80),
                },
            }
        )
        try:
            draft = assistant.generate_draft(
                concern_text=request.concern_text,
                selected_ask=request.selected_ask.value,
                rep_names=rep_names,
                optional_bill_ref=request.optional_bill_ref,
                user_location=user_location,
                broad_issue_mode=force_broad_issue_generation,
                canonical_issue_id=canonical_issue_id,
            )
            _log_marker("=== LLM FALLBACK RAN ===")
            if draft is None:
                _log_marker(
                    "=== LLM FALLBACK RESULT ===",
                    {"result": "empty", "note": "assistant returned None after parse/validation"},
                )
            else:
                _log_marker(
                    "=== LLM FALLBACK RESULT ===",
                    {
                        "result": "ok",
                        "issue_title": draft.issue_title,
                        "live_template_words": len(draft.live_script_template.split()),
                        "voicemail_template_words": len(draft.voicemail_script_template.split()),
                        "talking_points_count": len(draft.talking_points),
                    }
                )
            _log_marker("=== LLM FALLBACK CHECK END ===")
            return draft
        except Exception as exc:
            logger.warning("script package LLM fallback failed: %s", type(exc).__name__)
            _log_marker(f"=== LLM FALLBACK FAILED: {type(exc).__name__} ===")
            _log_marker("=== LLM FALLBACK CHECK END ===")
            return None

    def _select_target_reps(
        self,
        user_id: str,
        targets: list[RepTarget],
        rep_contexts: list[RepContext],
    ) -> list[tuple[RepTarget, RepContext]]:
        cleaned_contexts = [
            rep for rep in rep_contexts
            if rep.rep_id.strip() and rep.rep_name.strip() and rep.office_type.strip()
        ]
        if not cleaned_contexts:
            return self.civic_service._select_target_reps(user_id, targets)

        by_chamber = {
            "house": [rep for rep in cleaned_contexts if rep.chamber.lower() == "house"],
            "senate": [rep for rep in cleaned_contexts if rep.chamber.lower() == "senate"],
        }

        selected: list[tuple[RepTarget, RepContext]] = []
        for target in targets:
            if target is RepTarget.HOUSE and by_chamber["house"]:
                selected.append((target, by_chamber["house"][0]))
            elif target is RepTarget.SENATE_1 and by_chamber["senate"]:
                selected.append((target, by_chamber["senate"][0]))
            elif target is RepTarget.SENATE_2:
                if len(by_chamber["senate"]) >= 2:
                    selected.append((target, by_chamber["senate"][1]))
                elif by_chamber["senate"]:
                    selected.append((target, by_chamber["senate"][0]))

        if selected:
            return selected

        fallback_targets = [RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2]
        capped = cleaned_contexts[:3]
        return [
            (fallback_targets[index], rep)
            for index, rep in enumerate(capped)
            if index < len(fallback_targets)
        ]

    def _resolve_issue_title(self, canonical_issue_id: str) -> str:
        override = _DISPLAY_ISSUE_TITLE_OVERRIDES.get(canonical_issue_id, "").strip()
        if override:
            return override
        issue_rows = self.issue_brief_service._load_issue_core()
        for row in issue_rows:
            if str(row.get("canonical_issue", "")).strip().lower() == canonical_issue_id:
                title = str(row.get("title", "")).strip()
                if title:
                    return title
        return _title_case_words(canonical_issue_id.replace("-", " "), max_words=7)

    def _resolve_bill_reference(self, canonical_issue_id: str, optional_bill_ref: str | None) -> tuple[str, str | None]:
        bill = _normalize_text(optional_bill_ref or "")
        if bill:
            return "user", bill
        curated = _CURATED_BILL_MAP.get(canonical_issue_id, "").strip()
        if curated:
            return "curated", curated
        return "none", None


def _normalize_text(value: str) -> str:
    return " ".join(value.split()).strip()


def _preview_for_log(value: str | None, max_chars: int = 240) -> str:
    text = _normalize_text(value or "")
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3] + "..."


def _title_case_words(value: str, max_words: int) -> str:
    words = [w for w in re.split(r"\s+", value) if w]
    words = words[:max_words]
    return " ".join(word[:1].upper() + word[1:].lower() for word in words)


def _ask_phrase(ask: Ask) -> str:
    if ask is Ask.SUPPORT:
        return "support"
    if ask is Ask.OPPOSE:
        return "oppose"
    if ask is Ask.COSPONSOR:
        return "cosponsor"
    if ask is Ask.VOTE_YES:
        return "vote yes on"
    if ask is Ask.VOTE_NO:
        return "vote no on"
    if ask is Ask.SEEK_OVERSIGHT:
        return "seek oversight on"
    if ask is Ask.ASK_PUBLIC_STATEMENT:
        return "issue a public statement on"
    if ask is Ask.ASK_AMENDMENT:
        return "support an amendment on"
    return "act on"


def _render_for_rep(template: str, office_type: str, rep_name: str) -> str:
    spoken_office = _spoken_title_for_office(office_type)
    spoken_last = _extract_last_name(rep_name) or rep_name
    return (
        template
        .replace("{OFFICE_TYPE}", spoken_office)
        .replace("{REP_NAME}", spoken_last)
    )


def _render_generated_template(
    template: str,
    office_type: str,
    rep_name: str,
    ask: Ask,
    bill_or_issue: str,
    location_label: str,
    max_words: int,
) -> str:
    normalized_location = _normalize_text(location_label or "")
    spoken_office = _spoken_title_for_office(office_type)
    spoken_last = _extract_last_name(rep_name) or rep_name
    filled = (
        template
        .replace("{OFFICE_TYPE}", spoken_office)
        .replace("{REP_NAME}", spoken_last)
        .replace("{ASK_ACTION}", _ask_phrase(ask))
        .replace("{LOCATION}", normalized_location)
        .replace("{BILL_OR_ISSUE}", bill_or_issue or "this issue")
    )
    if not normalized_location:
        filled = re.sub(r"(?i)\b(?:in|from|across)\s+(?=[,.;!?]|$)", "", filled)
        filled = re.sub(r"(?i)\bi\s+live\s*(?=[,.;!?]|$)", "", filled)
        filled = re.sub(r"(?i)\bi(?:'m| am)\s+from\s*(?=[,.;!?]|$)", "", filled)
    filled = re.sub(r"(?i)\b(?:my|our)\s+area\b", "", filled)
    filled = re.sub(r"\s+", " ", filled).strip()
    return _trim_sentence(filled, max_words=max_words)


def _merge_summary(issue_summary: str, background: str) -> str:
    primary = _normalize_text(issue_summary)
    context = _normalize_text(background)
    if primary and context:
        return f"{primary} Why this matters: {context}"
    return primary or context


def _role_overlays_for(office_type: str) -> list[str]:
    lowered = office_type.lower()
    overlays: list[str] = []
    if "leader" in lowered:
        overlays.append("leadership")
    if "chair" in lowered:
        overlays.append("committee_chair")
    if not overlays:
        overlays.append("none")
    return overlays


def _build_committee_match(
    reason_badges: Iterable[str],
    likely_committees: list[str],
    rep_committees: list[str],
) -> ScriptPackageCommitteeMatch:
    normalized_badges = [badge.strip() for badge in reason_badges if badge and badge.strip()]
    matched: list[str] = []
    for committee in likely_committees:
        normalized_committee = _normalize_committee_name(committee)
        if not normalized_committee:
            continue
        for rep_committee in rep_committees:
            normalized_rep_committee = _normalize_committee_name(rep_committee)
            if not normalized_rep_committee:
                continue
            if (
                normalized_committee == normalized_rep_committee
                or normalized_committee in normalized_rep_committee
                or normalized_rep_committee in normalized_committee
            ):
                matched.append(committee)
                break
        if committee in matched:
            continue
        for badge in normalized_badges:
            normalized_badge = _normalize_committee_name(badge)
            if not normalized_badge:
                continue
            if (
                normalized_committee == normalized_badge
                or normalized_committee in normalized_badge
                or normalized_badge in normalized_committee
            ):
                matched.append(committee)
                break
    deduped = list(dict.fromkeys(matched))
    if deduped:
        return ScriptPackageCommitteeMatch(
            matched=True,
            matched_committees=deduped,
            jurisdiction_callout=(
                f"This office has direct committee relevance through {', '.join(deduped)}."
            ),
        )

    fallback_callout = None
    if likely_committees:
        fallback_callout = (
            f"This issue is typically handled in {', '.join(likely_committees[:3])}."
        )
    return ScriptPackageCommitteeMatch(
        matched=False,
        matched_committees=[],
        jurisdiction_callout=fallback_callout,
    )


def _trim_sentence(value: str, max_words: int) -> str:
    text = _normalize_text(value)
    if not text:
        return ""
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(" ,;:.") + "..."


def _office_action_line(canonical_issue_id: str, issue_title: str, chamber: str, ask: Ask) -> str:
    chamber_key = (chamber or "").strip().lower()
    ask_key = _ask_label(ask)
    canonical_key = (canonical_issue_id or "").strip().lower()
    title_key = (issue_title or "").strip().lower()

    if _is_nomination_issue(canonical_key, title_key):
        if chamber_key == "senate":
            return (
                "This is a Senate confirmation issue."
                f" Please confirm whether this office will {ask_key} on the nomination."
            )
        return (
            "This issue is primarily decided in the Senate confirmation process."
            " Please ask this office for a public statement and oversight position."
        )

    if chamber_key == "house":
        return (
            "In the House, this member can press committee action and shape House floor votes."
            f" Please share whether they plan to {ask_key} this issue."
        )
    return (
        "In the Senate, this member can influence hearings, confirmations, and final Senate votes."
        f" Please share whether they plan to {ask_key} this issue."
    )


def _issue_action_focus(canonical_issue_id: str, title: str, concern_text: str) -> str:
    curated = _CURATED_ACTION_FOCUS.get(canonical_issue_id, "").strip()
    if curated:
        return curated
    derived = _derive_issue_reference(concern_text)
    if derived and derived.lower() not in {"this issue", _normalize_text(title).lower()}:
        return derived
    return ""


def _derive_issue_reference(concern_text: str) -> str:
    text = _normalize_text(concern_text)
    if not text:
        return ""

    # Remove leading ask phrasing so we keep the concrete policy object.
    ask_terms = "|".join(
        re.escape(term)
        for term in (
            "support",
            "oppose",
            "cosponsor",
            "vote yes on",
            "vote no on",
            "seek oversight on",
            "ask for public statement on",
            "ask amendment on",
            "fund",
            "block",
            "protect",
            "expand",
        )
    )
    text = re.sub(rf"(?i)^(please\s+)?(i\s+am\s+)?(i'?m\s+)?(?:{ask_terms})\s+", "", text).strip(" ,.-")
    text = re.sub(r"(?i)\bcongress\b", "", text).strip(" ,.-")
    text = _trim_sentence(text, max_words=16).strip(" .")
    if not text:
        return ""
    return text[0].lower() + text[1:] if len(text) > 1 else text.lower()


def _build_reason_line(key_facts: list[IssueFact], concern_text: str, issue_target: str) -> str:
    if key_facts:
        seeded = _trim_sentence(key_facts[0].fact.strip(), max_words=24)
        if seeded:
            return seeded

    concern = _normalize_text(concern_text)
    if concern:
        focus_source = _derive_issue_reference(concern) or concern
        focus = _trim_sentence(focus_source, max_words=24)
        if focus:
            if focus[-1] not in ".!?":
                focus += "."
            return f"The issue is {focus[0].lower() + focus[1:]}"

    target = _normalize_text(issue_target)
    if target and target.lower() != "this issue":
        return f"This request directly affects constituents and focuses on {target}."
    return "This request directly affects constituents and deserves a clear public response."


def _ask_label(ask: Ask) -> str:
    raw = ask.value if hasattr(ask, "value") else str(ask)
    normalized = raw.strip().replace("_", " ")
    return normalized or "act on"


def _normalize_committee_name(value: str) -> str:
    lowered = value.lower().strip()
    lowered = lowered.replace("&", " and ")
    lowered = lowered.removeprefix("committee on ").strip()
    lowered = lowered.removeprefix("committee of ").strip()
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _is_nomination_issue(canonical_issue_id: str, issue_title: str) -> bool:
    combined = f"{canonical_issue_id} {issue_title}".strip().lower()
    if not combined:
        return False
    nomination_markers = (
        "nomination",
        "confirm",
        "confirmation",
        "surgeon general",
        "blm director",
        "director",
        "for-surgeon-general",
        "as-blm-director",
    )
    return any(marker in combined for marker in nomination_markers)


def _prepare_spoken_script(
    raw_script: str,
    script_type: str,
    office_type: str,
    rep_name: str,
    ask: Ask,
    issue_title: str,
    bill_or_issue: str,
    reason_line: str,
    action_focus: str,
) -> str:
    cleaned = _sanitize_spoken_script(raw_script, office_type=office_type, rep_name=rep_name)
    if _is_phone_readable(cleaned, script_type=script_type, ask=ask, rep_name=rep_name):
        return cleaned

    fallback = _fallback_spoken_script(
        script_type=script_type,
        office_type=office_type,
        rep_name=rep_name,
        ask=ask,
        issue_title=issue_title,
        bill_or_issue=bill_or_issue,
        reason_line=reason_line,
        action_focus=action_focus,
    )
    return _sanitize_spoken_script(fallback, office_type=office_type, rep_name=rep_name)


def _sanitize_spoken_script(raw_script: str, office_type: str, rep_name: str) -> str:
    text = _normalize_text(raw_script.replace("\n", " "))
    if not text:
        return ""

    generic_rep = _is_generic_rep_name(rep_name)
    spoken_member = _spoken_member_label(office_type, rep_name)
    full_name = _normalize_text(rep_name)
    full_office_name = spoken_member if not generic_rep else _spoken_title_for_office(office_type)
    default_target = spoken_member if not generic_rep else "this office"

    if full_name and not generic_rep:
        escaped_full_name = re.escape(full_name)
        text = re.sub(
            rf"(?i)\bu\.?\s*s\.?\s*senator\s+{escaped_full_name}\b",
            spoken_member,
            text,
        )
        text = re.sub(
            rf"(?i)\bu\.?\s*s\.?\s*representative\s+{escaped_full_name}\b",
            spoken_member,
            text,
        )
        text = re.sub(rf"(?i)\b{escaped_full_name}\b", spoken_member, text)

    replacement_rules: tuple[tuple[str, str], ...] = (
        (r"(?i)\bu\.?\s*s\.?\s*representative\s+house office\b", full_office_name),
        (r"(?i)\bu\.?\s*s\.?\s*senator\s+senate office\s*\d+\b", full_office_name),
        (r"(?i)\bhouse office\b", default_target),
        (r"(?i)\bsenate office\s*\d*\b", default_target),
        (r"(?i)\bcongressional office\b", default_target),
    )
    for pattern, replacement in replacement_rules:
        text = re.sub(pattern, replacement, text)

    if "senator" in office_type.lower():
        text = re.sub(
            r"(?i)\bas a[n]?\s+[^,]{1,80},\s*this member can influence hearings, confirmations, and final senate votes\.?",
            "In the Senate, this office can influence hearings, confirmations, and final Senate votes.",
            text,
        )
    elif "representative" in office_type.lower() or "house" in office_type.lower():
        text = re.sub(
            r"(?i)\bas a[n]?\s+[^,]{1,80},\s*this member can press committee action and shape house floor votes\.?",
            "In the House, this office can press committee action and shape House floor votes.",
            text,
        )

    for pattern in _SCRIPT_METADATA_PATTERNS:
        text = re.sub(pattern, " ", text)

    text = re.sub(r"(?i)\b(?:my|our)\s+area\b", "", text)
    text = re.sub(r"(?i)\b(?:in|from|across)\s+(?=[,.;!?]|$)", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if generic_rep:
        text = re.sub(r"(?i)\b(U\.?\s*S\.?\s*(Senator|Representative))\s+this office\b", "this office", text)
        text = re.sub(r"(?i)\bthis office\s+this office\b", "this office", text)
    if text and text[-1] not in ".!?":
        text += "."
    return text


def _prepare_generated_spoken_script(
    raw_script: str,
    script_type: str,
    office_type: str,
    rep_name: str,
    ask: Ask,
    fallback_issue_title: str,
    fallback_bill_or_issue: str,
    fallback_reason_line: str,
    fallback_action_focus: str,
) -> str:
    cleaned = _sanitize_spoken_script(raw_script, office_type=office_type, rep_name=rep_name)
    cleaned = re.sub(r"(?i)\bplease support on ([a-z0-9][a-z0-9\s\-]*)", r"please support \1", cleaned)
    cleaned = re.sub(r"(?i)\bplease oppose on ([a-z0-9][a-z0-9\s\-]*)", r"please oppose \1", cleaned)
    cleaned = re.sub(r"(?i)\bwhere ([A-Z][^?]+) stands on this issue\b", "where they stand on this issue", cleaned)

    if _is_usable_generated_script(
        cleaned,
        script_type=script_type,
        ask=ask,
        rep_name=rep_name,
        office_type=office_type,
    ):
        return cleaned

    trimmed = _trim_sentence(cleaned, max_words=140 if script_type == "live" else 80)
    trimmed = _sanitize_spoken_script(trimmed, office_type=office_type, rep_name=rep_name)
    trimmed = re.sub(r"(?i)\bplease support on ([a-z0-9][a-z0-9\s\-]*)", r"please support \1", trimmed)
    trimmed = re.sub(r"(?i)\bplease oppose on ([a-z0-9][a-z0-9\s\-]*)", r"please oppose \1", trimmed)
    trimmed = re.sub(r"(?i)\bwhere ([A-Z][^?]+) stands on this issue\b", "where they stand on this issue", trimmed)
    if _is_usable_generated_script(
        trimmed,
        script_type=script_type,
        ask=ask,
        rep_name=rep_name,
        office_type=office_type,
    ):
        return trimmed

    fallback = _fallback_spoken_script(
        script_type=script_type,
        office_type=office_type,
        rep_name=rep_name,
        ask=ask,
        issue_title=fallback_issue_title,
        bill_or_issue=fallback_bill_or_issue,
        reason_line=fallback_reason_line,
        action_focus=fallback_action_focus,
    )
    return _sanitize_spoken_script(fallback, office_type=office_type, rep_name=rep_name)


def _safe_reason_line_for_generated(reason_line: str, bill_or_issue: str) -> str:
    text = _normalize_text(reason_line)
    lower = text.lower()
    if not text:
        return ""
    banned_fragments = (
        "this request focuses on",
        "this directly affects people in my community",
        "deserves a clear public response",
        "evidence is limited",
    )
    if any(fragment in lower for fragment in banned_fragments):
        return "This issue has a direct impact on constituents and deserves a clear response from Congress."
    normalized_target = _normalize_text(bill_or_issue).lower()
    if normalized_target and normalized_target in lower and len(text.split()) <= 6:
        return "This issue has a direct impact on constituents and deserves a clear response from Congress."
    return text


def _is_usable_generated_script(
    script: str,
    script_type: str,
    ask: Ask,
    rep_name: str,
    office_type: str,
) -> bool:
    if not script:
        return False

    text = _normalize_text(script)
    lowered = text.lower()

    for pattern in _SCRIPT_METADATA_PATTERNS:
        if re.search(pattern, text):
            return False

    blocked_placeholders = (
        r"\{OFFICE_TYPE\}",
        r"\{REP_NAME\}",
        r"\{ASK_ACTION\}",
        r"\{LOCATION\}",
        r"\{BILL_OR_ISSUE\}",
    )
    for pattern in blocked_placeholders:
        if re.search(pattern, text):
            return False

    if " as an ai " in f" {lowered} " or " language model " in f" {lowered} ":
        return False
    if " my area " in f" {lowered} " or " our area " in f" {lowered} ":
        return False

    words = re.findall(r"\b[\w'\-]+\b", text)
    if script_type == "live":
        if not (35 <= len(words) <= 170):
            return False
    else:
        if not (18 <= len(words) <= 95):
            return False

    ask_signals = _ASK_SIGNALS_BY_ASK.get(ask, ())
    generic_ask_terms = ("support", "oppose", "cosponsor", "vote", "back", "reject", "protect", "expand")
    if not any(signal in lowered for signal in ask_signals) and not any(term in lowered for term in generic_ask_terms):
        return False

    normalized_rep = _normalize_text(rep_name).lower()
    normalized_office = _normalize_text(office_type).lower()
    spoken_member = _spoken_member_label(office_type, rep_name).lower()
    spoken_office = _spoken_title_for_office(office_type).lower()
    if (
        normalized_rep
        and normalized_rep not in lowered
        and normalized_office not in lowered
        and spoken_member not in lowered
        and spoken_office not in lowered
    ):
        return False

    bad_fragments = (
        "this request focuses on",
        "this directly affects people in my community",
        "could you share the member's current position and next step on this request",
        "please share the member's position and next step",
    )
    if any(fragment in lowered for fragment in bad_fragments):
        return False

    return True


def _is_phone_readable(script: str, script_type: str, ask: Ask, rep_name: str) -> bool:
    if not script:
        return False

    lowered = script.lower()
    for pattern in _SCRIPT_METADATA_PATTERNS + _SCRIPT_PLACEHOLDER_PATTERNS:
        if re.search(pattern, script):
            return False
    if " as an ai " in f" {lowered} " or " language model " in f" {lowered} ":
        return False

    words = re.findall(r"\b[\w'\-]+\b", script)
    sentences = [chunk.strip() for chunk in re.split(r"[.!?]+", script) if chunk.strip()]
    if script_type == "live":
        if not (55 <= len(words) <= 130):
            return False
        if not (2 <= len(sentences) <= 5):
            return False
    else:
        if not (25 <= len(words) <= 85):
            return False
        if not (1 <= len(sentences) <= 3):
            return False

    for sentence in sentences:
        if len(re.findall(r"\b[\w'\-]+\b", sentence)) > 34:
            return False

    ask_signals = _ASK_SIGNALS_BY_ASK.get(ask, ())
    if ask_signals and not any(signal in lowered for signal in ask_signals):
        return False

    normalized_rep = _normalize_text(rep_name).lower()
    rep_last = normalized_rep.split()[-1] if normalized_rep else ""
    if not _is_generic_rep_name(rep_name):
        if normalized_rep and normalized_rep not in lowered and rep_last and rep_last not in lowered:
            return False

    return True


def _fallback_spoken_script(
    script_type: str,
    office_type: str,
    rep_name: str,
    ask: Ask,
    issue_title: str,
    bill_or_issue: str,
    reason_line: str,
    action_focus: str,
) -> str:
    ask_phrase = _ask_phrase(ask)
    title_text = _normalize_text(issue_title) or "this issue"
    target_text = _normalize_text(bill_or_issue) or "this issue"
    spoken_member = _spoken_member_label(office_type, rep_name)
    reason_text = _trim_sentence(_normalize_text(reason_line), max_words=22)
    if not reason_text:
        reason_text = "This issue has a direct impact on constituents."
    community_line = "This has a real impact on families and communities."
    if "real impact on families and communities" in reason_text.lower():
        community_line = ""
    focus_text = ""
    if action_focus:
        focus_text = f" This is about {action_focus}."

    if script_type == "voicemail":
        return (
            "Hi, this is [Your Name], a constituent. "
            f"I'm calling about {title_text}. "
            f"Please ask {spoken_member} to {ask_phrase} {target_text}. "
            f"{reason_text} "
            "Please share the member's position and next step. Thank you."
        )

    return (
        "Hi, my name is [Your Name], and I am a constituent. "
        f"I am calling to discuss {title_text}. "
        f"I'm asking {spoken_member} to {ask_phrase} {target_text}.{focus_text} "
        f"{reason_text} "
        f"{community_line} "
        "Could you share the member's position and any planned action on this issue? Thank you."
    )


def _is_generic_rep_name(rep_name: str) -> bool:
    normalized = _normalize_text(rep_name).lower()
    if not normalized:
        return True
    if normalized in {"house office", "senate office", "congressional office"}:
        return True
    if normalized.startswith("senate office"):
        return True
    if "house office" in normalized or "congressional office" in normalized:
        return True
    return False


def _spoken_title_for_office(office_type: str) -> str:
    lowered = _normalize_text(office_type).lower()
    if "senator" in lowered:
        return "Senator"
    if "representative" in lowered or "house" in lowered:
        return "Representative"
    if "congress" in lowered:
        return "Representative"
    return _normalize_text(office_type) or "Representative"


def _extract_last_name(rep_name: str) -> str:
    normalized = _normalize_text(rep_name)
    if not normalized:
        return ""

    tokens = re.findall(r"[A-Za-z][A-Za-z'’.\-]*", normalized)
    if not tokens:
        return normalized

    suffixes = {"jr", "sr", "ii", "iii", "iv", "v"}
    while len(tokens) > 1 and tokens[-1].lower().rstrip(".") in suffixes:
        tokens.pop()
    return tokens[-1]


def _spoken_member_label(office_type: str, rep_name: str) -> str:
    title = _spoken_title_for_office(office_type)
    last_name = _extract_last_name(rep_name)
    if not last_name:
        return title
    return f"{title} {last_name}"


def _is_broad_advocacy_request(concern_text: str, ask: Ask) -> bool:
    text = _normalize_text(concern_text)
    if not text:
        return False
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9'\-]*\b", text.lower())
    if len(words) < 2 or len(words) > 24:
        return False
    if ask not in set(_ASK_SIGNALS_BY_ASK):
        return False
    noisy_markers = ("asdf", "qwerty", "lorem ipsum", "test test test")
    if any(marker in text.lower() for marker in noisy_markers):
        return False
    return True


def _clarification_question_for_classification(concern_text: str, default_question: str | None) -> str:
    lowered = concern_text.lower()
    if "gun" in lowered or "assault weapon" in lowered or "firearm" in lowered:
        return (
            "To tailor your script, should this focus on background checks, assault weapons policy, "
            "or gun-violence prevention more broadly?"
        )
    if "medicaid" in lowered:
        return (
            "To tailor your script, should this focus on expanding Medicaid coverage, protecting funding, "
            "or opposing Medicaid cuts?"
        )
    if "iran" in lowered or "war" in lowered:
        return (
            "To tailor your script, should this focus on opposing unauthorized military action, "
            "a War Powers vote, or broader de-escalation?"
        )
    return default_question or "Could you clarify the specific congressional action you want to target?"


def _should_force_generation_after_clarification(concern_text: str, ask: Ask) -> bool:
    text = _normalize_text(concern_text).lower()
    if not text:
        return False
    if ask not in set(_ASK_SIGNALS_BY_ASK):
        return False

    # Entry-level UX: if this looks like a normal short civic ask, generate rather than block.
    if _is_broad_advocacy_request(concern_text, ask):
        return True

    single_word = re.findall(r"\b[a-zA-Z][a-zA-Z0-9'\-]*\b", text)
    if len(single_word) == 1:
        if single_word[0] in {
            "gun",
            "guns",
            "medicaid",
            "medicare",
            "immigration",
            "housing",
            "abortion",
            "crypto",
            "climate",
            "environment",
        }:
            return True

    force_terms = (
        "gun",
        "assault weapon",
        "firearm",
        "background check",
        "medicaid",
        "medicare",
        "social security",
        "immigration",
        "environment",
        "climate",
        "housing",
        "reproductive rights",
        "abortion",
        "crypto",
        "ai data center",
        "ai center",
    )
    return any(term in text for term in force_terms)


def _force_policy_issue_from_concern(concern_text: str) -> str:
    lowered = concern_text.lower()
    if "medicaid" in lowered:
        return "healthcare_medicaid_expansion"
    if "medicare" in lowered:
        return "healthcare_medicare_expansion"
    return ""


def _is_medicaid_concern(concern_text: str) -> bool:
    return "medicaid" in concern_text.lower()


def _ensure_medicaid_policy_anchor(script: str) -> str:
    anchor = "Congress should expand Medicaid eligibility and funding to cover more low-income adults."
    lowered = script.lower()
    if "expand medicaid eligibility and funding to cover more low-income adults" in lowered:
        return script
    cleaned = script.strip()
    if cleaned and cleaned[-1] not in ".!?":
        cleaned += "."
    return f"{cleaned} {anchor}".strip()


def _location_label_for_request(request: ScriptPackageRequest, rep: RepContext | None) -> str:
    request_zip = _normalize_text(request.user_zip or "")
    if request_zip:
        return request_zip
    request_city = _normalize_text(request.user_city or "")
    if request_city:
        return request_city
    request_state = _normalize_text(request.user_state or "")
    if request_state:
        return request_state

    if rep is not None:
        rep_zip = _normalize_text(rep.zip_code or "")
        if rep_zip:
            return rep_zip
        rep_city = _normalize_text(rep.city or "")
        if rep_city:
            return rep_city
        rep_state = _normalize_text(rep.state or "")
        if rep_state:
            return rep_state

    if request.include_full_address_in_script:
        address = _normalize_text(request.user_address or "")
        if address and len(address) <= 80:
            return address
    return ""


def _contains_banned_robotic_phrase(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in _BANNED_ROBOTIC_PHRASES) or "my area" in lowered or "our area" in lowered


def _cleanup_robotic_script_text(script: str, issue_title: str) -> str:
    text = _normalize_text(script)
    text = re.sub(r"(?i)\bthis request focuses on\b", "The issue is", text)
    text = re.sub(r"(?i)\bthis directly affects people in my community\.?", "This has a real impact on families and communities.", text)
    text = re.sub(
        r"(?i)\bcould you share the member's current position and next step on this request\??",
        "Could you share the member's position and any planned action on this issue?",
        text,
    )
    text = re.sub(
        r"(?i)\bi am calling about support ([^.]+)\.?",
        r"I am calling to ask for support on \1.",
        text,
    )
    text = re.sub(r"(?i)\bto support support\b", "to support", text)
    text = re.sub(r"(?i)\bto oppose oppose\b", "to oppose", text)
    text = re.sub(r"(?i)\bto support protect\b", "to protect", text)
    title = _normalize_text(issue_title)
    if title:
        title_pattern = re.escape(title)
        text = re.sub(rf"(?i)\b({title_pattern})\b(?:\s+\1\b)+", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _ensure_location_personalization(script: str, location_label: str) -> str:
    if not location_label:
        return script
    lowered = script.lower()
    normalized_location = _normalize_text(location_label)
    if normalized_location.lower() in lowered:
        return script
    updated = re.sub(
        r"(?i)\bi am a constituent\b",
        f"I am a constituent from {normalized_location}",
        script,
        count=1,
    )
    updated = re.sub(
        r"(?i)\bi'?m a constituent\b",
        f"I'm a constituent from {normalized_location}",
        updated,
        count=1,
    )
    if updated == script:
        updated = f"I'm a constituent from {normalized_location}. {script}".strip()
    return updated


def _has_duplicate_issue_phrase(script: str, concern_text: str) -> bool:
    concern = _normalize_text(concern_text).lower()
    if len(concern.split()) < 2:
        return False
    return script.lower().count(concern) > 1


def _apply_final_text_quality_guard(
    script: str,
    script_type: str,
    issue_title: str,
    concern_text: str,
    location_label: str,
    office_type: str,
    rep_name: str,
    ask: Ask,
    fallback_bill_or_issue: str,
    fallback_reason_line: str,
    fallback_action_focus: str,
) -> str:
    cleaned = _sanitize_spoken_script(script, office_type=office_type, rep_name=rep_name)
    cleaned = _cleanup_robotic_script_text(cleaned, issue_title=issue_title)
    cleaned = _ensure_location_personalization(cleaned, location_label=location_label)
    cleaned = _sanitize_spoken_script(cleaned, office_type=office_type, rep_name=rep_name)

    if not _contains_banned_robotic_phrase(cleaned) and not _has_duplicate_issue_phrase(cleaned, concern_text):
        return cleaned

    fallback = _fallback_spoken_script(
        script_type=script_type,
        office_type=office_type,
        rep_name=rep_name,
        ask=ask,
        issue_title=issue_title,
        bill_or_issue=fallback_bill_or_issue,
        reason_line=fallback_reason_line,
        action_focus=fallback_action_focus,
    )
    fallback = _cleanup_robotic_script_text(fallback, issue_title=issue_title)
    fallback = _ensure_location_personalization(fallback, location_label=location_label)
    return _sanitize_spoken_script(fallback, office_type=office_type, rep_name=rep_name)
