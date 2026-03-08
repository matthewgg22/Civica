from __future__ import annotations

import re
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from .congress_client import CongressGovClient
from .models import (
    BillAction,
    BillCommitteeActivity,
    BillContext,
    BillCosponsor,
    CommitteeAssignment,
    MemberProfile,
    PoliticalEvent,
)
from .senate_assignments_client import SenateAssignmentsClient

ISSUE_TO_COMMITTEES = {
    "healthcare": ["Health, Education, Labor, and Pensions", "Finance"],
    "abortion-reproductive-rights": ["Health, Education, Labor, and Pensions", "Judiciary"],
    "immigration": ["Judiciary", "Homeland Security and Governmental Affairs", "Foreign Relations"],
    "gun-safety": ["Judiciary"],
    "climate": ["Environment and Public Works", "Energy and Natural Resources", "Commerce, Science, and Transportation"],
    "education": ["Health, Education, Labor, and Pensions"],
    "labor": ["Health, Education, Labor, and Pensions"],
    "veterans": ["Veterans' Affairs", "Armed Services"],
    "housing": ["Banking, Housing, and Urban Affairs"],
    "taxes": ["Finance"],
    "technology-privacy": ["Commerce, Science, and Transportation", "Judiciary"],
    "foreign-policy": ["Foreign Relations", "Armed Services"],
}


class ContextRanker:
    eventRecencyWeight = 0.35
    billDirectnessWeight = 0.25
    committeeMatchWeight = 0.20
    personalizationWeight = 0.20

    def __init__(
        self,
        congress_client: CongressGovClient | None = None,
        senate_assignments_client: SenateAssignmentsClient | None = None,
    ) -> None:
        self.congress = congress_client or CongressGovClient()
        self.senate_assignments = senate_assignments_client or self.congress.senate_assignments

    def rank_context(
        self,
        callerProfile: dict[str, Any],
        targetSenator: dict[str, Any] | MemberProfile | str,
        billIdentifier: str | None = None,
        issueTaxonomyTags: list[str] | None = None,
    ) -> dict[str, Any]:
        caller = self._normalize_caller_profile(callerProfile)
        tags = [tag.strip() for tag in (issueTaxonomyTags or []) if tag and tag.strip()]

        senator = self._resolve_target_senator(targetSenator, caller_state=caller.get("state"))
        congress = _infer_congress(senator.terms)

        committee_assignments = self._load_committee_assignments(senator, congress)

        bill_tuple = _parse_bill_identifier(billIdentifier)
        bill_context: BillContext | None = None
        bill_actions: list[BillAction] = []
        bill_cosponsors: list[BillCosponsor] = []
        bill_committees: list[BillCommitteeActivity] = []

        if bill_tuple is not None:
            bill_congress, bill_type, bill_number = bill_tuple
            bill_context = self.congress.getBillDetail(bill_congress, bill_type, bill_number)
            bill_actions = self.congress.getBillActions(bill_congress, bill_type, bill_number)
            bill_cosponsors = self.congress.getBillCosponsors(bill_congress, bill_type, bill_number)
            bill_committees = self.congress.getBillCommittees(bill_congress, bill_type, bill_number)

        events = self._load_political_events(
            congress=bill_tuple[0] if bill_tuple else congress,
            chamber="senate",
        )

        cosponsor_status = self._is_cosponsor(senator, bill_cosponsors)
        committee_scores = self._score_committees(
            assignments=committee_assignments,
            bill_committees=bill_committees,
            caller=caller,
            issue_tags=tags,
        )
        relevant_committees = [item["committee"] for item in committee_scores if item["score"] > 0.0]

        legislative_stage = self._legislative_stage(bill_context, bill_actions)

        ranked_events, personalization_evidence = self._rank_events(
            events=events,
            bill_context=bill_context,
            relevant_committees=relevant_committees,
            caller=caller,
            issue_tags=tags,
        )

        recommended_ask = self._recommended_ask(
            caller=caller,
            bill_context=bill_context,
            cosponsor_status=cosponsor_status,
            committee_relevance=bool(relevant_committees),
        )

        rationale = self._build_rationale(
            senator=senator,
            bill_context=bill_context,
            cosponsor_status=cosponsor_status,
            legislative_stage=legislative_stage,
            ranked_events=ranked_events,
            personalization_evidence=personalization_evidence,
            recommended_ask=recommended_ask,
            direct_personal_angle=any(e.startswith("personal:") for e in personalization_evidence),
        )

        return {
            "targetSenator": {
                "bioguideId": senator.bioguide_id,
                "name": senator.name,
                "party": senator.party,
                "state": senator.state,
                "phone": senator.phone,
                "website": senator.website,
                "leadershipRoles": list(senator.leadership_roles),
            },
            "billContext": asdict(bill_context) if bill_context else None,
            "committeeAssignments": [asdict(item) for item in committee_assignments],
            "relevantCommittees": relevant_committees,
            "politicalEvents": ranked_events,
            "personalizationEvidence": personalization_evidence,
            "recommendedAsk": recommended_ask,
            "rationale": rationale,
        }

    def _normalize_caller_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "state": str(payload.get("state") or "").strip().upper() or None,
            "zip": str(payload.get("zip") or "").strip() or None,
            "city": str(payload.get("city") or "").strip() or None,
            "issuePriority": str(payload.get("issuePriority") or "").strip() or None,
            "personalStory": str(payload.get("personalStory") or "").strip() or None,
            "occupation": str(payload.get("occupation") or "").strip() or None,
            "identities": [
                str(value).strip()
                for value in (payload.get("identities") or [])
                if str(value).strip()
            ],
            "tone": str(payload.get("tone") or "").strip() or None,
            "pastCalls": list(payload.get("pastCalls") or []),
            "preferredScriptLength": payload.get("preferredScriptLength"),
        }

    def _resolve_target_senator(
        self,
        target: dict[str, Any] | MemberProfile | str,
        caller_state: str | None,
    ) -> MemberProfile:
        if isinstance(target, MemberProfile):
            if target.bioguide_id:
                return self.congress.getMemberProfile(target.bioguide_id)
            return target

        if isinstance(target, dict):
            bioguide = str(target.get("bioguideId") or target.get("bioguide_id") or "").strip()
            if bioguide:
                profile = self.congress.getMemberProfile(bioguide)
                if profile.chamber != "senate":
                    raise ValueError("targetSenator must resolve to a Senate member.")
                return profile

            name = str(target.get("name") or "").strip()
            state = str(target.get("state") or caller_state or "").strip().upper()
            congress = int(target.get("congress") or 119)
            candidates = self.congress.getCurrentSenators(congress=congress, stateCode=state or None)
            resolved = _best_name_match(name, candidates) if name else (candidates[0] if candidates else None)
            if resolved is None:
                raise ValueError("Unable to resolve target senator by name/state.")
            return resolved

        name = str(target).strip()
        candidates = self.congress.getCurrentSenators(congress=119, stateCode=caller_state)
        resolved = _best_name_match(name, candidates)
        if resolved is None:
            raise ValueError("Unable to resolve target senator by string input.")
        return resolved

    def _load_committee_assignments(
        self,
        senator: MemberProfile,
        congress: int,
    ) -> list[CommitteeAssignment]:
        assignments: list[CommitteeAssignment] = []
        try:
            assignments = self.senate_assignments.assignments_for_member(
                member_name=senator.name,
                congress=congress,
            )
        except Exception:
            assignments = []

        if assignments:
            return assignments

        # Explicit fallback only: use direct assignments on member profile if present.
        return list(senator.committee_assignments)

    def _load_political_events(self, congress: int, chamber: str) -> list[PoliticalEvent]:
        events = self.congress.getCommitteeMeetings(congress=congress, chamber=chamber)

        try:
            issues = self.congress.getDailyCongressionalRecordIssues()
            for issue in issues[:5]:
                volume_issue = _parse_record_ref(issue.ref_url)
                if volume_issue is None:
                    continue
                volume_number, issue_number = volume_issue
                articles = self.congress.getDailyCongressionalRecordArticles(volume_number, issue_number)
                events.extend(articles)
        except Exception:
            pass

        return events

    def _is_cosponsor(self, senator: MemberProfile, cosponsors: list[BillCosponsor]) -> bool:
        target_id = senator.bioguide_id.strip().upper()
        if not target_id:
            return False
        for cosponsor in cosponsors:
            if (cosponsor.bioguide_id or "").strip().upper() == target_id:
                return True
        return False

    def _score_committees(
        self,
        assignments: list[CommitteeAssignment],
        bill_committees: list[BillCommitteeActivity],
        caller: dict[str, Any],
        issue_tags: list[str],
    ) -> list[dict[str, Any]]:
        bill_committee_tokens = {
            _normalize_text(item.committee_name)
            for item in bill_committees
            if item.committee_name
        }
        taxonomy_committee_tokens = {
            _normalize_text(name)
            for name in _committees_for_issue_tags(issue_tags)
            if _normalize_text(name)
        }

        user_tokens = set(_tokens(caller.get("issuePriority")))
        user_tokens.update(_tokens(caller.get("occupation")))
        for identity in caller.get("identities") or []:
            user_tokens.update(_tokens(identity))
        for tag in issue_tags:
            user_tokens.update(_tokens(tag))

        scored: list[dict[str, Any]] = []
        for assignment in assignments:
            committee_key = _normalize_text(assignment.committee_name)
            score = 0.0
            if committee_key and any(_committee_match(committee_key, bill_key) for bill_key in bill_committee_tokens):
                score += 0.45
            if committee_key and any(_committee_match(committee_key, mapped_key) for mapped_key in taxonomy_committee_tokens):
                score += 0.35
            if user_tokens and any(token in committee_key for token in user_tokens):
                score += 0.20

            scored.append(
                {
                    "committee": assignment.committee_name,
                    "role": assignment.role,
                    "score": min(score, 1.0),
                }
            )

        scored.sort(key=lambda row: row["score"], reverse=True)
        return scored

    def _legislative_stage(self, bill_context: BillContext | None, actions: list[BillAction]) -> str:
        if bill_context is None:
            return "No bill context"

        candidate = ""
        if actions and actions[0].text:
            candidate = actions[0].text or ""
        elif bill_context.latest_action_text:
            candidate = bill_context.latest_action_text

        text = candidate.lower()
        if "signed" in text or "became public law" in text:
            return "Enacted"
        if "presented" in text and "president" in text:
            return "Awaiting presidential action"
        if "passed" in text and "senate" in text:
            return "Passed Senate"
        if "passed" in text and "house" in text:
            return "Passed House"
        if "committee" in text or "referred" in text:
            return "In committee"
        if bill_context.introduced_date:
            return "Introduced"
        return "Stage unavailable"

    def _rank_events(
        self,
        events: list[PoliticalEvent],
        bill_context: BillContext | None,
        relevant_committees: list[str],
        caller: dict[str, Any],
        issue_tags: list[str],
    ) -> tuple[list[dict[str, Any]], list[str]]:
        bill_id = None
        if bill_context is not None:
            bill_id = f"{bill_context.bill_type.upper()}.{bill_context.bill_number}"

        personalization_evidence: list[str] = []
        event_rows: list[dict[str, Any]] = []

        personal_tokens = set(_tokens(caller.get("issuePriority")))
        personal_tokens.update(_tokens(caller.get("occupation")))
        for identity in caller.get("identities") or []:
            personal_tokens.update(_tokens(identity))
        for tag in issue_tags:
            personal_tokens.update(_tokens(tag))

        state_code = (caller.get("state") or "").upper()
        state_name = _state_name_from_code(state_code)
        city = caller.get("city") or ""

        for event in events:
            recency_score = self._recency_score(event.date)
            bill_directness = 0.0
            if bill_id and any(_normalize_text(value) == _normalize_text(bill_id) for value in event.related_bills):
                bill_directness = 1.0
            elif bill_id:
                bill_directness = 0.35
            else:
                bill_directness = 0.2

            committee_match = 0.0
            event_committees = [committee for committee in event.committees if committee]
            if event_committees and relevant_committees:
                if any(_normalize_text(c1) == _normalize_text(c2) for c1 in event_committees for c2 in relevant_committees):
                    committee_match = 1.0
                elif any(
                    _normalize_text(c1) in _normalize_text(c2) or _normalize_text(c2) in _normalize_text(c1)
                    for c1 in event_committees
                    for c2 in relevant_committees
                ):
                    committee_match = 0.65

            personalization = 0.0
            haystack = " ".join([event.title, *event.committees, *event.related_bills]).lower()
            if state_code and (state_code.lower() in haystack or (state_name and state_name.lower() in haystack)):
                personalization += 0.35
                personalization_evidence.append(f"state:{state_code} matched event '{event.title}'")
            if city and city.lower() in haystack:
                personalization += 0.25
                personalization_evidence.append(f"city:{city} matched event '{event.title}'")
            if personal_tokens and any(token in haystack for token in personal_tokens):
                personalization += 0.4
                personalization_evidence.append(f"issue/identity/occupation tokens matched event '{event.title}'")
            if caller.get("personalStory"):
                story_tokens = set(_tokens(caller.get("personalStory")))
                if story_tokens and any(token in haystack for token in story_tokens):
                    personalization += 0.2
                    personalization_evidence.append("personal:personalStory aligned with event context")

            personalization = min(personalization, 1.0)

            weighted_score = (
                self.eventRecencyWeight * recency_score
                + self.billDirectnessWeight * bill_directness
                + self.committeeMatchWeight * committee_match
                + self.personalizationWeight * personalization
            )

            event_rows.append(
                {
                    "eventType": event.event_type,
                    "title": event.title,
                    "date": _to_absolute_date(event.date),
                    "status": event.status,
                    "committees": event_committees,
                    "relatedBills": list(event.related_bills),
                    "refUrl": event.ref_url,
                    "relevanceScore": round(weighted_score, 4),
                }
            )

        event_rows.sort(key=lambda row: row["relevanceScore"], reverse=True)
        deduped_evidence = list(dict.fromkeys(personalization_evidence))
        return event_rows[:10], deduped_evidence

    def _recommended_ask(
        self,
        caller: dict[str, Any],
        bill_context: BillContext | None,
        cosponsor_status: bool,
        committee_relevance: bool,
    ) -> str:
        issue_priority = (caller.get("issuePriority") or "").lower()
        oppose_intent = any(token in issue_priority for token in ("oppose", "block", "stop", "reject", "vote no"))

        if bill_context is not None:
            chamber_bill_type = (bill_context.bill_type or "").lower()
            senate_can_cosponsor = chamber_bill_type.startswith("s")

            if senate_can_cosponsor and not cosponsor_status:
                return "cosponsor"
            if oppose_intent:
                return "vote_no"
            if cosponsor_status:
                return "ask_public_statement"
            return "support"

        if committee_relevance:
            return "seek_oversight"
        if oppose_intent:
            return "oppose"
        return "support"

    def _build_rationale(
        self,
        senator: MemberProfile,
        bill_context: BillContext | None,
        cosponsor_status: bool,
        legislative_stage: str,
        ranked_events: list[dict[str, Any]],
        personalization_evidence: list[str],
        recommended_ask: str,
        direct_personal_angle: bool,
    ) -> list[str]:
        rationale: list[str] = []

        rationale.append(f"Targeted senator: {senator.name} ({senator.party or 'Unknown'}, {senator.state or 'Unknown state'}).")

        if bill_context is not None:
            bill_id = f"{bill_context.bill_type.upper()}.{bill_context.bill_number}"
            introduced = _to_absolute_date(bill_context.introduced_date)
            latest = _to_absolute_date(bill_context.latest_action_date)
            rationale.append(
                f"Bill context: {bill_id} ({bill_context.title or 'Untitled bill'}) introduced on {introduced}; latest action on {latest}."
            )
            rationale.append(f"Legislative stage: {legislative_stage}.")
            rationale.append(f"Cosponsor status for {senator.name}: {'Yes' if cosponsor_status else 'No'}.")

        if ranked_events:
            top_event = ranked_events[0]
            rationale.append(
                f"Highest-ranked event: '{top_event['title']}' dated {top_event['date']} (score {top_event['relevanceScore']})."
            )

        if personalization_evidence:
            rationale.append("Personalization signals were used in retrieval and ranking.")
        if direct_personal_angle:
            rationale.append("Direct personal angle detected; generic talking points should be suppressed.")

        rationale.append(f"Recommended ask: {recommended_ask}.")
        return rationale

    def _recency_score(self, date_value: str | None) -> float:
        if not date_value:
            return 0.0
        parsed = _parse_date(date_value)
        if parsed is None:
            return 0.0

        now = datetime.now(timezone.utc)
        delta_days = max((now - parsed).days, 0)
        if delta_days <= 7:
            return 1.0
        if delta_days <= 14:
            return 0.9
        if delta_days <= 30:
            return 0.75
        if delta_days <= 90:
            return 0.5
        if delta_days <= 180:
            return 0.3
        return 0.1


def _infer_congress(terms: list[dict[str, Any]]) -> int:
    candidates = []
    for term in terms:
        try:
            value = int(term.get("congress"))
            candidates.append(value)
        except (TypeError, ValueError):
            continue
    return max(candidates) if candidates else 119


def _parse_bill_identifier(bill_identifier: str | None) -> tuple[int, str, int] | None:
    if not bill_identifier:
        return None

    normalized = bill_identifier.strip().lower().replace(" ", "")
    match = re.match(r"(?:(\d+)-)?([a-z\.]+)(\d+)$", normalized)
    if not match:
        return None

    congress = int(match.group(1)) if match.group(1) else 119
    bill_type = match.group(2).replace(".", "")
    bill_number = int(match.group(3))
    return congress, bill_type.lower(), bill_number


def _parse_record_ref(ref_url: str | None) -> tuple[int, int] | None:
    if not ref_url:
        return None
    match = re.search(r"/daily-congressional-record/(\d+)/(\d+)", ref_url)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def _best_name_match(name: str, candidates: list[MemberProfile]) -> MemberProfile | None:
    target = _normalize_text(name)
    if not target:
        return None

    target_tokens = set(target.split())
    best: tuple[int, MemberProfile] | None = None
    for candidate in candidates:
        candidate_tokens = set(_normalize_text(candidate.name).split())
        overlap = len(target_tokens & candidate_tokens)
        if best is None or overlap > best[0]:
            best = (overlap, candidate)

    if best is None or best[0] == 0:
        return None
    return best[1]


def _parse_date(value: str) -> datetime | None:
    if not value:
        return None
    raw = value.strip()
    for candidate in (raw, raw.replace("Z", "+00:00"), f"{raw}T00:00:00+00:00"):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def _to_absolute_date(value: str | None) -> str | None:
    if not value:
        return None
    parsed = _parse_date(value)
    if parsed is None:
        return value
    return parsed.strftime("%Y-%m-%d")


def _tokens(value: str | None) -> set[str]:
    if not value:
        return set()
    cleaned = _normalize_text(value)
    return {token for token in cleaned.split() if len(token) >= 3}


def _normalize_text(value: str | None) -> str:
    normalized = (value or "").lower().replace("-", " ")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _committees_for_issue_tags(issue_tags: list[str]) -> list[str]:
    mapped: list[str] = []
    for raw in issue_tags:
        key = (raw or "").strip().lower()
        if not key:
            continue
        mapped.extend(ISSUE_TO_COMMITTEES.get(key, []))
    return list(dict.fromkeys(mapped))


def _committee_match(left: str, right: str) -> bool:
    if not left or not right:
        return False
    if left == right:
        return True
    if left in right or right in left:
        return True
    left_without_prefix = left.removeprefix("committee on ").strip()
    right_without_prefix = right.removeprefix("committee on ").strip()
    return (
        left_without_prefix == right_without_prefix
        or left_without_prefix in right_without_prefix
        or right_without_prefix in left_without_prefix
    )


def _state_name_from_code(code: str | None) -> str | None:
    if not code:
        return None

    state_names = {
        "AL": "Alabama",
        "AK": "Alaska",
        "AZ": "Arizona",
        "AR": "Arkansas",
        "CA": "California",
        "CO": "Colorado",
        "CT": "Connecticut",
        "DE": "Delaware",
        "FL": "Florida",
        "GA": "Georgia",
        "HI": "Hawaii",
        "ID": "Idaho",
        "IL": "Illinois",
        "IN": "Indiana",
        "IA": "Iowa",
        "KS": "Kansas",
        "KY": "Kentucky",
        "LA": "Louisiana",
        "ME": "Maine",
        "MD": "Maryland",
        "MA": "Massachusetts",
        "MI": "Michigan",
        "MN": "Minnesota",
        "MS": "Mississippi",
        "MO": "Missouri",
        "MT": "Montana",
        "NE": "Nebraska",
        "NV": "Nevada",
        "NH": "New Hampshire",
        "NJ": "New Jersey",
        "NM": "New Mexico",
        "NY": "New York",
        "NC": "North Carolina",
        "ND": "North Dakota",
        "OH": "Ohio",
        "OK": "Oklahoma",
        "OR": "Oregon",
        "PA": "Pennsylvania",
        "RI": "Rhode Island",
        "SC": "South Carolina",
        "SD": "South Dakota",
        "TN": "Tennessee",
        "TX": "Texas",
        "UT": "Utah",
        "VT": "Vermont",
        "VA": "Virginia",
        "WA": "Washington",
        "WV": "West Virginia",
        "WI": "Wisconsin",
        "WY": "Wyoming",
        "DC": "District of Columbia",
    }
    return state_names.get(code.upper())
