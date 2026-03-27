from __future__ import annotations

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
    RepTarget,
    ScriptPackageCanonicalContext,
    ScriptPackageCommitteeMatch,
    ScriptPackageOfficeOverlay,
    ScriptPackageRequest,
    ScriptPackageResponse,
    ScriptPackageScriptCore,
    ScriptPackageTruthTrace,
)
from .service import CivicService


_CURATED_BILL_MAP: dict[str, str] = {
    "oppose-the-save-america-act": "SAVE America Act",
    "save-america-act": "SAVE America Act",
    "stop-unauthorized-military-strikes-on-iran": "War Powers Resolution",
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
}

_SCRIPT_PERSONALIZATION_FIELDS = [
    "rep_name",
    "office_type",
    "chamber",
    "committee_match",
    "leadership_role",
]


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

        if classify.status is BriefStatus.REFUSED:
            return ScriptPackageResponse(
                status=BriefStatus.REFUSED,
                package_id=package_id,
                canonical_context=None,
                script_core=None,
                office_overlays=[],
                review_can_regenerate=True,
                review_regenerate_hint="Try reframing as an issue-focused civic request.",
                truth_trace=ScriptPackageTruthTrace(
                    normalized_input=normalized_input,
                    canonical_issue_id="policy_restricted",
                    classification_reason="policy_refusal",
                    bill_source="none",
                    personalization_fields_used=[],
                    fallback_used="refusal",
                    refusal_reason="Request asked for disallowed campaign/endorsement or harmful content.",
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

        if brief.status is BriefStatus.REFUSED:
            return ScriptPackageResponse(
                status=BriefStatus.REFUSED,
                package_id=package_id,
                canonical_context=None,
                script_core=None,
                office_overlays=[],
                review_can_regenerate=True,
                review_regenerate_hint=brief.review_prompt or "Try reframing as an issue-focused civic request.",
                truth_trace=ScriptPackageTruthTrace(
                    normalized_input=normalized_input,
                    canonical_issue_id="policy_restricted",
                    classification_reason="policy_refusal",
                    bill_source="none",
                    personalization_fields_used=[],
                    fallback_used="refusal",
                    refusal_reason=brief.summary_neutral,
                ),
                policy_flags=brief.policy_flags,
            )

        canonical_issue_id = (
            brief.canonical_issue.strip().lower()
            or classify.canonical_issue.strip().lower()
            or "general-civic-issue"
        )
        if canonical_issue_id in {"unspecified", "policy_restricted"}:
            canonical_issue_id = "general-civic-issue"

        title = self._resolve_issue_title(canonical_issue_id, fallback=request.concern_text)

        bill_source, resolved_bill = self._resolve_bill_reference(
            canonical_issue_id=canonical_issue_id,
            optional_bill_ref=request.optional_bill_ref,
        )
        bill_display_text = resolved_bill or "this issue"
        related_bills = [resolved_bill] if resolved_bill else []

        key_facts = brief.key_facts[:3]
        evidence_quality = "sufficient" if len(brief.key_facts) >= 2 else "limited"
        evidence_warning = None
        if evidence_quality != "sufficient":
            evidence_warning = "Evidence is limited; script uses broad issue framing."

        common_ask_phrase = _ask_phrase(request.selected_ask)
        reason_line = (
            key_facts[0].fact.strip()
            if key_facts and key_facts[0].fact.strip()
            else "This issue is directly affecting constituents."
        )
        core = ScriptPackageScriptCore(
            live_script_core=(
                "Hi, my name is [Your Name], and I am a constituent. "
                f"I am calling about {title}. "
                f"I'm urging {{OFFICE_TYPE}} {{REP_NAME}} to {common_ask_phrase} {bill_display_text}. "
                f"{reason_line} "
                "Can you share the member's current position and next step on this issue? Thank you."
            ),
            voicemail_script_core=(
                "Hi, constituent calling about "
                f"{title}. I'm urging {{OFFICE_TYPE}} {{REP_NAME}} to {common_ask_phrase} {bill_display_text}. "
                "Please share the member's current position and next step. Thank you."
            ),
        )

        selected_targets = request.target_reps or [RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2]
        reps = self.civic_service._select_target_reps(request.user_id, selected_targets)
        overlays: list[ScriptPackageOfficeOverlay] = []
        likely_committees = _ISSUE_COMMITTEE_MAP.get(canonical_issue_id, [])
        for rep_target, rep in reps:
            scored = self.civic_service._score_rep(
                rep=rep,
                issue_title=title,
                bill_ref=resolved_bill,
            )
            committee_match = _build_committee_match(scored.reason_badges, likely_committees)
            role_overlays = _role_overlays_for(rep.office_type)
            live_script = core.live_script_core
            voicemail_script = core.voicemail_script_core
            live_script = _render_for_rep(live_script, rep.office_type, rep.rep_name)
            voicemail_script = _render_for_rep(voicemail_script, rep.office_type, rep.rep_name)

            if committee_match.jurisdiction_callout:
                live_script = f"{live_script}\n\n{committee_match.jurisdiction_callout}"
                voicemail_script = f"{voicemail_script}\n\n{committee_match.jurisdiction_callout}"

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
                    related_committees=likely_committees,
                )
            )

        fallback_used = "none"
        if evidence_quality != "sufficient":
            fallback_used = "weak_evidence_fallback"
        if "auto_selected_from_ambiguous" in brief.policy_flags:
            fallback_used = "low_confidence_autopick"
        if canonical_issue_id == "general-civic-issue":
            fallback_used = "general_issue_fallback"

        classification_reason = "retrieval"
        if "normalized_personal_antipathy" in brief.policy_flags:
            classification_reason = "deterministic_normalization"
        elif "auto_selected_from_ambiguous" in brief.policy_flags:
            classification_reason = "low_confidence_autopick"
        elif canonical_issue_id == "general-civic-issue":
            classification_reason = "fallback_general"

        canonical_context = ScriptPackageCanonicalContext(
            issue_id=canonical_issue_id,
            title=title,
            summary_plain=brief.summary_neutral,
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

        return ScriptPackageResponse(
            status=BriefStatus.OK,
            package_id=package_id,
            canonical_context=canonical_context,
            script_core=core,
            office_overlays=overlays,
            review_can_regenerate=True,
            review_regenerate_hint=brief.review_prompt or "Tell me what to change and I can regenerate.",
            truth_trace=ScriptPackageTruthTrace(
                normalized_input=normalized_input,
                canonical_issue_id=canonical_issue_id,
                classification_reason=classification_reason,
                bill_source=bill_source,
                personalization_fields_used=list(_SCRIPT_PERSONALIZATION_FIELDS),
                fallback_used=fallback_used,
                refusal_reason=None,
            ),
            policy_flags=brief.policy_flags,
        )

    def _resolve_issue_title(self, canonical_issue_id: str, fallback: str) -> str:
        issue_rows = self.issue_brief_service._load_issue_core()
        for row in issue_rows:
            if str(row.get("canonical_issue", "")).strip().lower() == canonical_issue_id:
                title = str(row.get("title", "")).strip()
                if title:
                    return title
        cleaned = _normalize_text(fallback)
        if cleaned:
            return _title_case_words(cleaned, max_words=7)
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
    return (
        template
        .replace("{OFFICE_TYPE}", office_type)
        .replace("{REP_NAME}", rep_name)
    )


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


def _build_committee_match(reason_badges: Iterable[str], likely_committees: list[str]) -> ScriptPackageCommitteeMatch:
    normalized_badges = [badge.strip() for badge in reason_badges if badge and badge.strip()]
    matched: list[str] = []
    for committee in likely_committees:
        c = committee.lower()
        for badge in normalized_badges:
            if c in badge.lower():
                matched.append(committee)
                break
    deduped = list(dict.fromkeys(matched))
    if deduped:
        return ScriptPackageCommitteeMatch(
            matched=True,
            matched_committees=deduped,
            jurisdiction_callout=(
                f"This office has committee jurisdiction relevance through {', '.join(deduped)}."
            ),
        )
    return ScriptPackageCommitteeMatch(matched=False, matched_committees=[], jurisdiction_callout=None)
