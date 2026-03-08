from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from .models import (
    BillAction,
    BillCommitteeActivity,
    BillContext,
    BillCosponsor,
    CommitteeAssignment,
    MemberProfile,
    PoliticalEvent,
    ScriptContext,
)
from .senate_assignments_client import SenateAssignmentsClient


class CongressGovClient:
    """Congress.gov v3 client with pagination, retries, and URL-keyed local cache."""

    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.congress.gov/v3",
        timeout_s: float = 8.0,
        max_retries: int = 3,
        senate_assignments_client: SenateAssignmentsClient | None = None,
    ) -> None:
        self.api_key = (api_key or os.environ.get("CONGRESS_GOV_API_KEY", "")).strip()
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self._cache: dict[str, Any] = {}
        self.senate_assignments = senate_assignments_client or SenateAssignmentsClient(
            timeout_s=timeout_s,
            max_retries=max_retries,
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    # ---------- Required API surface (camelCase) ----------

    def getMembersByCongress(self, congress: int, currentMember: bool | None = None) -> list[MemberProfile]:
        query: dict[str, Any] = {"congress": congress}
        if currentMember is not None:
            query["currentMember"] = str(bool(currentMember)).lower()

        rows = self._fetch_paginated("/member", query, collection_keys=("members",))
        if not rows:
            rows = self._fetch_paginated(f"/member/{congress}", query=None, collection_keys=("members",))

        profiles = [self._normalize_member_summary(row) for row in rows]
        return [profile for profile in profiles if self._member_matches_congress(profile, congress)]

    def getCurrentSenators(self, congress: int, stateCode: str | None = None) -> list[MemberProfile]:
        members = self.getMembersByCongress(congress=congress, currentMember=True)
        senators = [member for member in members if member.chamber == "senate"]
        if stateCode:
            state = stateCode.strip().upper()
            senators = [member for member in senators if (member.state or "").upper() == state]

        # Hydrate with full profile so callers get contact + leadership + ref URLs.
        hydrated: list[MemberProfile] = []
        for senator in senators:
            if not senator.bioguide_id:
                hydrated.append(senator)
                continue
            try:
                hydrated.append(self.getMemberProfile(senator.bioguide_id))
            except Exception:
                hydrated.append(senator)
        return hydrated

    def getMemberProfile(self, bioguideId: str) -> MemberProfile:
        bioguide_id = bioguideId.strip()
        payload = self._request_json(f"/member/{bioguide_id}", None)
        member = payload.get("member") or {}

        profile = self._normalize_member_summary(member)
        profile.bioguide_id = profile.bioguide_id or bioguide_id

        committees_ref = self._extract_ref_url(member.get("committees"))
        if committees_ref:
            committee_rows = self._fetch_paginated(committees_ref, None, collection_keys=("committees",))
            profile.committee_assignments = self._normalize_member_committees(committee_rows, profile)
        else:
            direct_committees = _coerce_list_of_dicts(member.get("committees"))
            if direct_committees:
                profile.committee_assignments = self._normalize_member_committees(direct_committees, profile)

        if profile.chamber == "senate":
            try:
                scraped = self.senate_assignments.assignments_for_member(
                    member_name=profile.name,
                    congress=_latest_congress_from_terms(profile.terms),
                )
                profile.committee_assignments = self._merge_committee_assignments(
                    profile.committee_assignments,
                    scraped,
                )
            except Exception:
                pass

        return profile

    def getBillDetail(self, congress: int, billType: str, billNumber: int) -> BillContext:
        normalized_bill_type = self._normalize_bill_type(billType)
        payload = self._request_json(f"/bill/{congress}/{normalized_bill_type}/{billNumber}", None)
        bill = payload.get("bill") or {}

        latest = bill.get("latestAction") or {}
        summary_text = self._extract_summary_text(bill.get("summaries"))

        return BillContext(
            congress=congress,
            bill_type=normalized_bill_type,
            bill_number=billNumber,
            title=bill.get("title") or bill.get("shortTitle"),
            introduced_date=bill.get("introducedDate"),
            origin_chamber=bill.get("originChamber"),
            policy_area=(bill.get("policyArea") or {}).get("name"),
            summary=summary_text,
            latest_action_date=latest.get("actionDate"),
            latest_action_text=latest.get("text"),
            summaries_ref=self._extract_ref_url(bill.get("summaries")),
            committees_ref=self._extract_ref_url(bill.get("committees")),
            actions_ref=self._extract_ref_url(bill.get("actions")),
            cosponsors_ref=self._extract_ref_url(bill.get("cosponsors")),
        )

    def getBillActions(self, congress: int, billType: str, billNumber: int) -> list[BillAction]:
        bill = self.getBillDetail(congress=congress, billType=billType, billNumber=billNumber)
        source = bill.actions_ref or f"/bill/{congress}/{bill.bill_type}/{billNumber}/actions"
        try:
            rows = self._fetch_paginated(source, None, collection_keys=("actions",))
            actions = [self._normalize_bill_action(row) for row in rows]
            return [action for action in actions if action.action_date or action.text]
        except Exception:
            if bill.latest_action_date or bill.latest_action_text:
                return [
                    BillAction(
                        action_date=bill.latest_action_date,
                        text=bill.latest_action_text,
                        action_code=None,
                        chamber=bill.origin_chamber,
                    )
                ]
            return []

    def getBillCosponsors(self, congress: int, billType: str, billNumber: int) -> list[BillCosponsor]:
        bill = self.getBillDetail(congress=congress, billType=billType, billNumber=billNumber)
        source = bill.cosponsors_ref or f"/bill/{congress}/{bill.bill_type}/{billNumber}/cosponsors"
        rows = self._fetch_paginated(source, None, collection_keys=("cosponsors",))
        cosponsors = [self._normalize_bill_cosponsor(row) for row in rows]
        return [cosponsor for cosponsor in cosponsors if cosponsor.bioguide_id or cosponsor.name]

    def getBillCommittees(self, congress: int, billType: str, billNumber: int) -> list[BillCommitteeActivity]:
        bill = self.getBillDetail(congress=congress, billType=billType, billNumber=billNumber)
        source = bill.committees_ref or f"/bill/{congress}/{bill.bill_type}/{billNumber}/committees"
        rows = self._fetch_paginated(source, None, collection_keys=("committees",))

        results: list[BillCommitteeActivity] = []
        for row in rows:
            committee_name = str(row.get("name") or row.get("committeeName") or "").strip()
            if not committee_name:
                continue

            activities = row.get("activities") or []
            if isinstance(activities, dict):
                activities = activities.get("item") or []
            if not isinstance(activities, list):
                activities = []

            if activities:
                for activity in activities:
                    results.append(
                        BillCommitteeActivity(
                            committee_name=committee_name,
                            chamber=row.get("chamber"),
                            activity_name=activity.get("name") or activity.get("type"),
                            activity_date=activity.get("date"),
                            subcommittee_name=(row.get("subcommittee") or {}).get("name"),
                        )
                    )
            else:
                results.append(
                    BillCommitteeActivity(
                        committee_name=committee_name,
                        chamber=row.get("chamber"),
                        activity_name=None,
                        activity_date=None,
                        subcommittee_name=(row.get("subcommittee") or {}).get("name"),
                    )
                )

        return results

    def getCommitteeMeetings(self, congress: int, chamber: str) -> list[PoliticalEvent]:
        normalized_chamber = chamber.strip().lower()
        rows = self._fetch_paginated(
            "/committee-meeting",
            {"congress": congress, "chamber": normalized_chamber},
            collection_keys=("committeeMeetings", "meetings"),
        )
        if not rows:
            rows = self._fetch_paginated(
                f"/committee-meeting/{congress}/{normalized_chamber}",
                None,
                collection_keys=("committeeMeetings", "meetings"),
            )

        events: list[PoliticalEvent] = []
        for row in rows:
            committees = [
                str(item.get("name") or "").strip()
                for item in (row.get("committees") or [])
                if str(item.get("name") or "").strip()
            ]
            related = [
                _format_bill_id(item)
                for item in (row.get("relatedBills") or row.get("bills") or [])
            ]

            events.append(
                PoliticalEvent(
                    event_type="committee_meeting",
                    title=str(row.get("title") or row.get("meetingDescription") or "Committee meeting").strip(),
                    date=row.get("meetingDate") or row.get("date"),
                    status=row.get("meetingStatus") or row.get("status"),
                    committees=committees,
                    related_bills=[bill for bill in related if bill],
                    ref_url=self._extract_ref_url(row),
                )
            )

        return events

    def getDailyCongressionalRecordIssues(
        self,
        volumeNumber: int | None = None,
        issueNumber: int | None = None,
    ) -> list[PoliticalEvent]:
        query: dict[str, Any] = {}
        if volumeNumber is not None:
            query["volumeNumber"] = volumeNumber
        if issueNumber is not None:
            query["issueNumber"] = issueNumber

        rows = self._fetch_paginated(
            "/daily-congressional-record",
            query or None,
            collection_keys=("issues", "dailyCongressionalRecord", "issue"),
        )

        events: list[PoliticalEvent] = []
        for row in rows:
            events.append(
                PoliticalEvent(
                    event_type="congressional_record_issue",
                    title=str(row.get("title") or row.get("issue") or "Congressional Record issue").strip(),
                    date=row.get("publishDate") or row.get("date"),
                    status=row.get("status"),
                    ref_url=self._extract_ref_url(row.get("articles")) or self._extract_ref_url(row),
                )
            )

        return events

    def getDailyCongressionalRecordArticles(self, volumeNumber: int, issueNumber: int) -> list[PoliticalEvent]:
        issues = self.getDailyCongressionalRecordIssues(volumeNumber=volumeNumber, issueNumber=issueNumber)
        source = next((issue.ref_url for issue in issues if issue.ref_url), None)
        source = source or f"/daily-congressional-record/{volumeNumber}/{issueNumber}/articles"

        rows = self._fetch_paginated(source, None, collection_keys=("articles", "article"))
        events: list[PoliticalEvent] = []
        for row in rows:
            events.append(
                PoliticalEvent(
                    event_type="congressional_record_article",
                    title=str(row.get("title") or row.get("heading") or "Congressional Record article").strip(),
                    date=row.get("date") or row.get("publishDate"),
                    status=row.get("status"),
                    ref_url=self._extract_ref_url(row),
                )
            )
        return events

    # ---------- Backward-compatible snake_case wrappers ----------

    def get_members_by_congress(self, congress: int, current_member: bool | None = None) -> list[MemberProfile]:
        return self.getMembersByCongress(congress=congress, currentMember=current_member)

    def get_current_senators(self, congress: int, state_code: str | None = None) -> list[MemberProfile]:
        return self.getCurrentSenators(congress=congress, stateCode=state_code)

    def get_member_profile(self, bioguide_id: str) -> MemberProfile:
        return self.getMemberProfile(bioguideId=bioguide_id)

    def get_bill_detail(self, congress: int, bill_type: str, bill_number: int) -> BillContext:
        return self.getBillDetail(congress=congress, billType=bill_type, billNumber=bill_number)

    def get_bill_actions(self, congress: int, bill_type: str, bill_number: int) -> list[BillAction]:
        return self.getBillActions(congress=congress, billType=bill_type, billNumber=bill_number)

    def get_bill_cosponsors(self, congress: int, bill_type: str, bill_number: int) -> list[BillCosponsor]:
        return self.getBillCosponsors(congress=congress, billType=bill_type, billNumber=bill_number)

    def get_bill_committees(self, congress: int, bill_type: str, bill_number: int) -> list[BillCommitteeActivity]:
        return self.getBillCommittees(congress=congress, billType=bill_type, billNumber=bill_number)

    def get_committee_meetings(self, congress: int, chamber: str) -> list[PoliticalEvent]:
        return self.getCommitteeMeetings(congress=congress, chamber=chamber)

    def get_daily_congressional_record_issues(
        self,
        volume_number: int | None = None,
        issue_number: int | None = None,
    ) -> list[PoliticalEvent]:
        return self.getDailyCongressionalRecordIssues(volumeNumber=volume_number, issueNumber=issue_number)

    def get_daily_congressional_record_articles(self, volume_number: int, issue_number: int) -> list[PoliticalEvent]:
        return self.getDailyCongressionalRecordArticles(volumeNumber=volume_number, issueNumber=issue_number)

    def get_active_members(self, state: str, district: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {
            "currentMember": "true",
            "state": state.strip().upper(),
        }
        if district is not None:
            query["district"] = district

        rows = self._fetch_paginated("/member", query, collection_keys=("members",))
        profiles = [self._normalize_member_summary(row) for row in rows]
        return [
            {
                "bioguide_id": profile.bioguide_id,
                "name": profile.name,
                "state": profile.state,
                "district": profile.district,
                "party": profile.party,
                "chamber": profile.chamber,
            }
            for profile in profiles
            if (profile.state or "").upper() == state.strip().upper()
        ]

    def get_member_sponsored_bills(self, bioguide_id: str, congress: int | None = None) -> list[dict[str, Any]]:
        profile = self.getMemberProfile(bioguide_id)
        source = profile.sponsored_legislation_ref or f"/member/{bioguide_id}/sponsored-legislation"
        query = {"congress": congress} if congress is not None else None
        rows = self._fetch_paginated(source, query, collection_keys=("sponsoredLegislation", "bills"))
        return [self._normalize_bill_reference(row) for row in rows]

    def get_member_cosponsored_bills(self, bioguide_id: str, congress: int | None = None) -> list[dict[str, Any]]:
        profile = self.getMemberProfile(bioguide_id)
        source = profile.cosponsored_legislation_ref or f"/member/{bioguide_id}/cosponsored-legislation"
        query = {"congress": congress} if congress is not None else None
        rows = self._fetch_paginated(source, query, collection_keys=("cosponsoredLegislation", "bills"))
        return [self._normalize_bill_reference(row) for row in rows]

    def get_member_committees(self, bioguide_id: str) -> list[dict[str, Any]]:
        profile = self.getMemberProfile(bioguide_id)
        return [asdict(item) for item in profile.committee_assignments]

    def get_bill_latest_action(self, congress: int, bill_type: str, bill_number: int) -> dict[str, Any]:
        detail = self.getBillDetail(congress=congress, billType=bill_type, billNumber=bill_number)
        return {
            "action_date": detail.latest_action_date,
            "action_text": detail.latest_action_text,
        }

    def get_bill_policy_area(self, congress: int, bill_type: str, bill_number: int) -> str | None:
        detail = self.getBillDetail(congress=congress, billType=bill_type, billNumber=bill_number)
        return detail.policy_area

    def get_bill_summary(self, congress: int, bill_type: str, bill_number: int) -> str | None:
        detail = self.getBillDetail(congress=congress, billType=bill_type, billNumber=bill_number)
        if detail.summary:
            return detail.summary
        if detail.summaries_ref:
            rows = self._fetch_paginated(detail.summaries_ref, None, collection_keys=("summaries", "summary"))
            if rows:
                return rows[0].get("text") or rows[0].get("summary")
        return None

    def get_house_rollcall_member_vote(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return {
            "supported": False,
            "source": "not_implemented",
            "details": "House roll-call member vote ingestion is a phase-2 capability.",
        }

    def build_script_context(
        self,
        rep_name: str,
        rep_state: str | None,
        rep_chamber: str,
        bill_ref: tuple[int, str, int] | None,
    ) -> ScriptContext:
        congress = bill_ref[0] if bill_ref else 119
        member_profile = self._resolve_member_profile_by_name(
            rep_name=rep_name,
            rep_state=rep_state,
            rep_chamber=rep_chamber,
            congress=congress,
        )

        bill_context: BillContext | None = None
        bill_actions: list[BillAction] = []
        bill_cosponsors: list[BillCosponsor] = []
        bill_committees: list[BillCommitteeActivity] = []
        political_events: list[PoliticalEvent] = []

        if bill_ref is not None:
            bill_congress, bill_type, bill_number = bill_ref
            bill_context = self.getBillDetail(bill_congress, bill_type, bill_number)
            bill_actions = self.getBillActions(bill_congress, bill_type, bill_number)
            bill_cosponsors = self.getBillCosponsors(bill_congress, bill_type, bill_number)
            bill_committees = self.getBillCommittees(bill_congress, bill_type, bill_number)
            try:
                chamber = (bill_context.origin_chamber or rep_chamber or "senate").lower()
                political_events = self.getCommitteeMeetings(congress=bill_congress, chamber=chamber)
            except Exception:
                political_events = []

        committee_assignments: list[CommitteeAssignment] = []
        if member_profile is not None:
            committee_assignments = list(member_profile.committee_assignments)

        if rep_chamber.strip().lower() == "senate" and not committee_assignments:
            try:
                committee_assignments = self.senate_assignments.assignments_for_member(
                    member_name=rep_name,
                    congress=congress,
                )
            except Exception:
                committee_assignments = []

        return ScriptContext(
            member_profile=member_profile,
            bill_context=bill_context,
            bill_actions=bill_actions,
            bill_cosponsors=bill_cosponsors,
            bill_committee_activity=bill_committees,
            committee_assignments=committee_assignments,
            political_events=political_events,
        )

    # ---------- Internal helpers ----------

    def _request_json(self, path: str, query: dict[str, Any] | None) -> dict[str, Any]:
        url = self._build_url(path, query)
        return self._request_json_url(url)

    def _request_json_url(self, url: str) -> dict[str, Any]:
        if url in self._cache:
            return self._cache[url]

        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                    self._cache[url] = payload
                    return payload
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code in self.RETRYABLE_STATUS_CODES and attempt < self.max_retries:
                    time.sleep(0.4 * (2 ** (attempt - 1)))
                    continue
                break
            except urllib.error.URLError as exc:
                last_error = exc
                if attempt < self.max_retries:
                    time.sleep(0.4 * (2 ** (attempt - 1)))
                    continue
                break

        raise RuntimeError(f"Congress.gov request failed for {url}: {last_error}")

    def _fetch_paginated(
        self,
        path_or_url: str,
        query: dict[str, Any] | None,
        collection_keys: tuple[str, ...],
    ) -> list[dict[str, Any]]:
        current_url = self._build_url(path_or_url, query)
        rows: list[dict[str, Any]] = []

        while current_url:
            payload = self._request_json_url(current_url)
            rows.extend(self._extract_collection(payload, collection_keys))

            next_url = self._extract_next_url(payload)
            if not next_url:
                break

            normalized_next = self._normalize_ref_url(next_url)
            if normalized_next == current_url:
                break
            current_url = normalized_next

        return rows

    def _build_url(self, path_or_url: str, query: dict[str, Any] | None) -> str:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            parsed = urllib.parse.urlparse(path_or_url)
            base = urllib.parse.urlunparse(parsed._replace(query=""))
            params = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
            params.update(query or {})
        else:
            base = f"{self.base_url}/{path_or_url.lstrip('/')}"
            params = dict(query or {})

        if self.api_key:
            params.setdefault("api_key", self.api_key)

        if not params:
            return base

        return f"{base}?{urllib.parse.urlencode(params, doseq=True)}"

    def _extract_collection(self, payload: dict[str, Any], keys: tuple[str, ...]) -> list[dict[str, Any]]:
        for key in keys:
            candidate = payload.get(key)
            rows = _coerce_list_of_dicts(candidate)
            if rows:
                return rows

            if isinstance(candidate, dict):
                for nested_key in ("items", "item", "records", "results"):
                    rows = _coerce_list_of_dicts(candidate.get(nested_key))
                    if rows:
                        return rows

        for nested in payload.values():
            if isinstance(nested, dict):
                rows = self._extract_collection(nested, keys)
                if rows:
                    return rows

        return []

    def _extract_next_url(self, payload: dict[str, Any]) -> str | None:
        pagination = payload.get("pagination")
        if isinstance(pagination, dict):
            next_url = pagination.get("next") or pagination.get("nextPage")
            if isinstance(next_url, str) and next_url.strip():
                return next_url.strip()
        return None

    def _extract_ref_url(self, payload: Any) -> str | None:
        if isinstance(payload, str):
            return payload.strip() or None
        if isinstance(payload, dict):
            for key in ("url", "referrer", "referrerUrl", "href", "link"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return None

    def _normalize_ref_url(self, ref_url: str) -> str:
        return self._build_url(ref_url, None)

    def _normalize_member_summary(self, row: dict[str, Any]) -> MemberProfile:
        terms = _member_terms(row)

        leadership_rows = row.get("leadership") or []
        if isinstance(leadership_rows, dict):
            leadership_rows = leadership_rows.get("item") or []

        return MemberProfile(
            bioguide_id=str(row.get("bioguideId") or row.get("memberId") or ""),
            name=str(row.get("name") or "").strip(),
            party=row.get("partyName") or row.get("party"),
            state=row.get("state"),
            district=row.get("district"),
            chamber=_member_chamber_from_terms(terms),
            phone=row.get("phone") or row.get("officePhoneNumber"),
            office_address=row.get("address") or row.get("officeAddress"),
            website=row.get("officialWebsiteUrl") or row.get("url"),
            contact_form=row.get("contactFormUrl"),
            leadership_roles=[
                str(item.get("type") or item.get("role") or "").strip()
                for item in leadership_rows
                if str(item.get("type") or item.get("role") or "").strip()
            ],
            sponsored_legislation_ref=self._extract_ref_url(row.get("sponsoredLegislation")),
            cosponsored_legislation_ref=self._extract_ref_url(row.get("cosponsoredLegislation")),
            committees_ref=self._extract_ref_url(row.get("committees")),
            committee_assignments=[],
            terms=terms,
        )

    def _normalize_member_committees(
        self,
        rows: list[dict[str, Any]],
        profile: MemberProfile,
    ) -> list[CommitteeAssignment]:
        assignments: list[CommitteeAssignment] = []
        congress = _latest_congress_from_terms(profile.terms)
        for row in rows:
            committee_name = str(row.get("name") or row.get("committeeName") or "").strip()
            if not committee_name:
                continue

            assignments.append(
                CommitteeAssignment(
                    committee_name=committee_name,
                    subcommittee_name=(row.get("subcommittee") or {}).get("name"),
                    role=_normalize_role(str(row.get("position") or row.get("role") or "member")),
                    congress=_safe_int(row.get("congress")) or congress,
                    chamber=str(row.get("chamber") or profile.chamber or "").lower() or "senate",
                    member_name=profile.name,
                )
            )
        return assignments

    def _normalize_bill_action(self, row: dict[str, Any]) -> BillAction:
        return BillAction(
            action_date=row.get("actionDate") or row.get("date"),
            text=row.get("text") or row.get("description"),
            action_code=row.get("actionCode"),
            chamber=row.get("chamber"),
        )

    def _normalize_bill_cosponsor(self, row: dict[str, Any]) -> BillCosponsor:
        member = row.get("member") if isinstance(row.get("member"), dict) else {}
        return BillCosponsor(
            bioguide_id=row.get("bioguideId") or member.get("bioguideId"),
            name=row.get("fullName") or row.get("name") or member.get("name"),
            party=row.get("party") or row.get("partyName") or member.get("party"),
            state=row.get("state") or member.get("state"),
            sponsorship_date=row.get("sponsorshipDate") or row.get("date"),
            is_original_cosponsor=bool(row.get("isOriginalCosponsor", False)),
        )

    def _extract_summary_text(self, summaries_payload: Any) -> str | None:
        if isinstance(summaries_payload, dict):
            rows = _coerce_list_of_dicts(summaries_payload.get("summaries") or summaries_payload.get("item"))
            if rows:
                return str(rows[0].get("text") or rows[0].get("summary") or "").strip() or None

            maybe_text = summaries_payload.get("text") or summaries_payload.get("summary")
            if isinstance(maybe_text, str) and maybe_text.strip():
                return maybe_text.strip()

        if isinstance(summaries_payload, list) and summaries_payload:
            first = summaries_payload[0]
            if isinstance(first, dict):
                text = first.get("text") or first.get("summary")
                if isinstance(text, str) and text.strip():
                    return text.strip()

        return None

    def _normalize_bill_reference(self, row: dict[str, Any]) -> dict[str, Any]:
        bill_type = self._normalize_bill_type(str(row.get("type") or row.get("billType") or ""))
        number = _safe_int(row.get("number") or row.get("billNumber"))
        latest = row.get("latestAction") if isinstance(row.get("latestAction"), dict) else {}
        return {
            "bill_id": _format_bill_id({"type": bill_type, "number": number}),
            "congress": _safe_int(row.get("congress")),
            "bill_type": bill_type,
            "bill_number": number,
            "title": row.get("title"),
            "latest_action_date": latest.get("actionDate"),
            "latest_action_text": latest.get("text"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _resolve_member_profile_by_name(
        self,
        rep_name: str,
        rep_state: str | None,
        rep_chamber: str,
        congress: int,
    ) -> MemberProfile | None:
        candidates = self.getMembersByCongress(congress=congress, currentMember=True)
        if rep_state:
            state = rep_state.strip().upper()
            candidates = [candidate for candidate in candidates if (candidate.state or "").upper() == state]

        chamber = rep_chamber.strip().lower()
        if chamber:
            candidates = [candidate for candidate in candidates if candidate.chamber == chamber]

        matched = _best_name_match(rep_name, candidates)
        if matched is None or not matched.bioguide_id:
            return None

        try:
            return self.getMemberProfile(matched.bioguide_id)
        except Exception:
            return matched

    def _merge_committee_assignments(
        self,
        first: list[CommitteeAssignment],
        second: list[CommitteeAssignment],
    ) -> list[CommitteeAssignment]:
        merged: list[CommitteeAssignment] = []
        seen: set[tuple[str, str | None, str, int | None]] = set()
        for row in [*first, *second]:
            key = (row.committee_name.lower(), (row.subcommittee_name or "").lower() or None, row.role, row.congress)
            if key in seen:
                continue
            seen.add(key)
            merged.append(row)
        return merged

    def _normalize_bill_type(self, value: str) -> str:
        return value.strip().lower()

    def _member_matches_congress(self, member: MemberProfile, congress: int) -> bool:
        if not member.terms:
            return True
        for term in member.terms:
            if _safe_int(term.get("congress")) == congress:
                return True
        return False


def _coerce_list_of_dicts(candidate: Any) -> list[dict[str, Any]]:
    if isinstance(candidate, list):
        return [row for row in candidate if isinstance(row, dict)]
    if isinstance(candidate, dict):
        item = candidate.get("item")
        if isinstance(item, list):
            return [row for row in item if isinstance(row, dict)]
        if isinstance(item, dict):
            return [item]
    return []


def _member_terms(row: dict[str, Any]) -> list[dict[str, Any]]:
    terms = row.get("terms")
    if isinstance(terms, dict):
        items = terms.get("item")
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
        if isinstance(items, dict):
            return [items]
    if isinstance(terms, list):
        return [item for item in terms if isinstance(item, dict)]
    return []


def _latest_congress_from_terms(terms: list[dict[str, Any]]) -> int | None:
    congresses = [_safe_int(term.get("congress")) for term in terms]
    numeric = [value for value in congresses if value is not None]
    return max(numeric) if numeric else None


def _member_chamber_from_terms(term_rows: list[dict[str, Any]]) -> str:
    if not term_rows:
        return "unknown"
    latest = term_rows[-1]
    chamber = str(latest.get("chamber") or "").lower()
    if "senate" in chamber:
        return "senate"
    if "house" in chamber:
        return "house"
    return chamber or "unknown"


def _normalize_role(value: str) -> str:
    lowered = value.strip().lower()
    if "ranking" in lowered:
        return "ranking"
    if "chair" in lowered:
        return "chairman"
    return "member"


def _safe_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _format_bill_id(row: dict[str, Any]) -> str | None:
    bill_type = str(row.get("type") or row.get("billType") or "").strip().lower()
    number = _safe_int(row.get("number") or row.get("billNumber"))
    if not bill_type or number is None:
        return None
    return f"{bill_type.upper()}.{number}"


def _best_name_match(rep_name: str, candidates: list[MemberProfile]) -> MemberProfile | None:
    target = _normalize_name(rep_name)
    if not target:
        return None

    target_tokens = set(target.split())
    target_parts = target.split()
    target_last = target_parts[-1] if target_parts else ""

    best: tuple[int, MemberProfile] | None = None
    for candidate in candidates:
        candidate_name = _normalize_name(candidate.name)
        if not candidate_name:
            continue

        candidate_tokens = set(candidate_name.split())
        overlap = len(target_tokens & candidate_tokens)
        last_name_bonus = 2 if target_last and candidate_name.split()[-1] == target_last else 0
        score = overlap + last_name_bonus

        if best is None or score > best[0]:
            best = (score, candidate)

    if best is None or best[0] <= 0:
        return None
    return best[1]


def _normalize_name(value: str) -> str:
    lowered = value.lower().replace("-", " ")
    cleaned = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()
