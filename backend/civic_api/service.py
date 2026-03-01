from __future__ import annotations

import re
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from .congress_client import CongressGovClient
from .models import (
    Ask,
    AssistantResolveRequest,
    AssistantResolveResponse,
    CallBrief,
    CallLogRecord,
    CallLogRequest,
    ExamplesResponse,
    ExampleIssueCard,
    HistoryResponse,
    RepContext,
    RepTarget,
    ResolvedEntities,
)
from .relevance import enrich_house_vote_signal, score_rep_issue, serialize_signals
from .repository import CivicRepository, InMemoryCivicRepository
from .script_composer import compose_call_scripts


class CivicService:
    def __init__(
        self,
        repository: CivicRepository | None = None,
        congress_client: CongressGovClient | None = None,
    ) -> None:
        self.repository = repository or InMemoryCivicRepository()
        self.congress = congress_client or CongressGovClient()

    def get_examples(self, user_id: str) -> ExamplesResponse:
        reps = self._load_user_reps(user_id)
        if not reps:
            return ExamplesResponse(examples=[])

        state_mentions = sorted({rep.state for rep in reps if rep.state})
        state_label = state_mentions[0] if state_mentions else "your state"

        cards = [
            ExampleIssueCard(
                issue_id="example-budget-oversight",
                title="Agency budget oversight",
                summary="Congress is reviewing agency budgets and oversight priorities for the current appropriations cycle.",
                related_bills=["H.R.____", "S.____"],
                rep_relevance=[
                    f"{rep.rep_name} is in {rep.office_type}." for rep in reps[:3]
                ],
                template_asks=[Ask.SEEK_OVERSIGHT, Ask.ASK_PUBLIC_STATEMENT, Ask.SUPPORT],
                live_script=(
                    f"Hello, constituent from {state_label}. I am calling about agency budget oversight. "
                    "Please prioritize transparent oversight hearings and share the member's current position. Thank you."
                ),
                voicemail_script=(
                    f"Constituent from {state_label} calling on budget oversight. "
                    "Please share the member's current position. Thank you."
                ),
            )
        ]
        return ExamplesResponse(examples=cards)

    def resolve_assistant(self, request: AssistantResolveRequest) -> AssistantResolveResponse:
        issue_id = str(uuid.uuid4())
        issue_title = self._resolve_issue_title(request.concern_text)
        issue_summary = request.concern_text.strip()

        reps = self._select_target_reps(request.user_id, request.target_reps)

        bills = [request.optional_bill_ref] if request.optional_bill_ref else []
        committees: list[str] = []
        agencies: list[str] = []

        call_briefs: list[CallBrief] = []
        for rep_target, rep in reps:
            scored = self._score_rep(
                rep=rep,
                issue_title=issue_title,
                bill_ref=request.optional_bill_ref,
            )
            committees = list(dict.fromkeys(committees + [badge for badge in scored.reason_badges if "Committee" in badge]))

            live_script, voicemail_script, talking_points = compose_call_scripts(
                rep=rep,
                ask=request.selected_ask,
                issue_title=issue_title,
                issue_summary=issue_summary,
                selected_bill=request.optional_bill_ref,
                user_location=rep.state or "your area",
                reason_badges=scored.reason_badges,
            )

            brief = CallBrief(
                brief_id=str(uuid.uuid4()),
                rep_id=rep.rep_id,
                rep_name=rep.rep_name,
                office_type=rep.office_type,
                primary_phone_number=rep.primary_phone_number,
                local_office_phone_number=rep.local_office_phone_number,
                relevance_badges=scored.reason_badges,
                related_bills=bills,
                related_committees=committees,
                live_script=live_script,
                voicemail_script=voicemail_script,
                talking_points=talking_points,
                issue_id=issue_id,
                rep_slot=rep_target,
            )
            call_briefs.append(brief)

            signal_row = serialize_signals(scored)
            signal_row.update({"issue_id": issue_id, "rep_slot": rep_target.value})
            self.repository.upsert_rep_issue_signal(signal_row)

        issue_row = {
            "issue_id": issue_id,
            "user_id": request.user_id,
            "issue_title": issue_title,
            "issue_summary": issue_summary,
            "selected_ask": request.selected_ask.value,
            "optional_bill_ref": request.optional_bill_ref,
            "resolved_bills": bills,
            "resolved_committees": committees,
            "resolved_agencies": agencies,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self.repository.upsert_issue_catalog(issue_row)
        self.repository.insert_call_briefs(request.user_id, issue_id, call_briefs)

        return AssistantResolveResponse(
            issue_id=issue_id,
            issue_title=issue_title,
            issue_summary=issue_summary,
            resolved_entities=ResolvedEntities(
                bills=bills,
                committees=committees,
                agencies=agencies,
            ),
            call_briefs=call_briefs,
        )

    def log_call(self, request: CallLogRequest) -> dict[str, Any]:
        history = self.history(request.user_id).history
        issue_title = "Constituent issue"
        rep_name = request.rep_id

        for group in history:
            if group.issue_id != request.issue_id:
                continue
            issue_title = group.issue_title
            for brief in group.briefs:
                if brief.brief_id == request.brief_id:
                    rep_name = brief.rep_name
                    break
            break

        log = CallLogRecord(
            log_id=str(uuid.uuid4()),
            user_id=request.user_id,
            rep_id=request.rep_id,
            rep_name=rep_name,
            issue_id=request.issue_id,
            issue_title=issue_title,
            brief_id=request.brief_id,
            outcome=request.outcome,
            staffer_position=request.staffer_position,
            notes=request.notes,
            created_at=datetime.now(timezone.utc),
        )
        self.repository.insert_call_log(log)
        return {"ok": True, "log_id": log.log_id}

    def history(self, user_id: str) -> HistoryResponse:
        return HistoryResponse(history=self.repository.load_history(user_id))

    def _load_user_reps(self, user_id: str) -> list[RepContext]:
        reps = self.repository.list_rep_context(user_id)
        if reps:
            return reps

        # Safe fallback for local/dev mode.
        return [
            RepContext(
                rep_id="house-local",
                rep_name="House Office",
                office_type="U.S. Representative",
                chamber="house",
                district="unknown",
                state="US",
                primary_phone_number="(202) 225-3121",
            ),
            RepContext(
                rep_id="senate-local-1",
                rep_name="Senate Office 1",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="US",
                primary_phone_number="(202) 224-3121",
            ),
            RepContext(
                rep_id="senate-local-2",
                rep_name="Senate Office 2",
                office_type="U.S. Senator",
                chamber="senate",
                district=None,
                state="US",
                primary_phone_number="(202) 224-3121",
            ),
        ]

    def _select_target_reps(self, user_id: str, targets: list[RepTarget]) -> list[tuple[RepTarget, RepContext]]:
        reps = self._load_user_reps(user_id)
        by_chamber = {
            "house": [rep for rep in reps if rep.chamber == "house"],
            "senate": [rep for rep in reps if rep.chamber == "senate"],
        }

        result: list[tuple[RepTarget, RepContext]] = []
        for target in targets:
            if target is RepTarget.HOUSE:
                if by_chamber["house"]:
                    result.append((target, by_chamber["house"][0]))
            elif target is RepTarget.SENATE_1:
                if by_chamber["senate"]:
                    result.append((target, by_chamber["senate"][0]))
            elif target is RepTarget.SENATE_2:
                if len(by_chamber["senate"]) >= 2:
                    result.append((target, by_chamber["senate"][1]))
                elif by_chamber["senate"]:
                    result.append((target, by_chamber["senate"][0]))

        if not result:
            for index, rep in enumerate(reps[:3]):
                target = [RepTarget.HOUSE, RepTarget.SENATE_1, RepTarget.SENATE_2][index]
                result.append((target, rep))
        return result

    def _score_rep(self, rep: RepContext, issue_title: str, bill_ref: str | None):
        sponsored: list[dict[str, Any]] = []
        cosponsored: list[dict[str, Any]] = []
        committees: list[dict[str, Any]] = []
        latest_date = None
        latest_text = None
        summary = None
        house_vote_signal = False

        if bill_ref:
            parsed = _parse_bill_ref(bill_ref)
            if parsed:
                congress, bill_type, bill_num = parsed
                try:
                    latest = self.congress.get_bill_latest_action(congress, bill_type, bill_num)
                    latest_date = latest.get("action_date")
                    latest_text = latest.get("action_text")
                    summary = self.congress.get_bill_summary(congress, bill_type, bill_num)
                except Exception:
                    latest_date = None
                    latest_text = None
                    summary = None

        house_vote_signal = enrich_house_vote_signal(
            rep=rep,
            rollcall_votes=[{"rep_id": rep.rep_id}] if rep.chamber == "house" and bill_ref else [],
        )

        return score_rep_issue(
            rep=rep,
            issue_title=issue_title,
            bill_ref=bill_ref,
            sponsored_bills=sponsored,
            cosponsored_bills=cosponsored,
            committees=committees,
            latest_action_date=latest_date,
            latest_action_text=latest_text,
            summary=summary,
            house_vote_signal=house_vote_signal,
            public_statement_signal=False,
        )

    def _resolve_issue_title(self, concern_text: str) -> str:
        concern = concern_text.strip()
        if not concern:
            return "Constituent issue"

        first_sentence = re.split(r"[.!?\n]", concern, maxsplit=1)[0].strip()
        if first_sentence:
            return _trim_words(first_sentence, 9)
        return _trim_words(concern, 9)


def _parse_bill_ref(bill_ref: str) -> tuple[int, str, int] | None:
    normalized = bill_ref.strip().lower().replace(" ", "")
    match = re.match(r"([hs]\.r?|s\.?)?(\d+)", normalized)
    if not match:
        return None

    bill_prefix = match.group(1) or "h.r"
    bill_num = int(match.group(2))
    bill_type = "hr" if bill_prefix.startswith("h") else "s"
    current_congress = 119
    return current_congress, bill_type, bill_num


def _trim_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])
