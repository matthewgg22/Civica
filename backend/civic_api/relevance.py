from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Any

from .models import RepContext, RepIssueScored, RepIssueSignals


def score_rep_issue(
    rep: RepContext,
    issue_title: str,
    bill_ref: str | None,
    sponsored_bills: list[dict[str, Any]],
    cosponsored_bills: list[dict[str, Any]],
    committees: list[dict[str, Any]],
    latest_action_date: str | None,
    latest_action_text: str | None,
    summary: str | None,
    house_vote_signal: bool = False,
    public_statement_signal: bool = False,
) -> RepIssueScored:
    normalized_ref = (bill_ref or "").strip().lower()

    sponsor_hit = _bill_match(normalized_ref, sponsored_bills)
    cosponsor_hit = _bill_match(normalized_ref, cosponsored_bills)

    committee_hit = _committee_relevance(issue_title, committees)
    chamber_match = _chamber_match(rep.chamber, normalized_ref)

    signals = RepIssueSignals(
        is_sponsor=sponsor_hit,
        is_cosponsor=cosponsor_hit,
        committee_relevance=committee_hit,
        chamber_match=chamber_match,
        house_vote_signal=house_vote_signal if rep.chamber == "house" else False,
        public_statement_signal=public_statement_signal,
        latest_action_date=latest_action_date,
        latest_action_text=latest_action_text,
        summary=summary,
    )

    reason_badges = reason_badges_from_signals(rep, normalized_ref, signals)

    return RepIssueScored(rep=rep, signals=signals, reason_badges=reason_badges)


def reason_badges_from_signals(rep: RepContext, bill_ref: str, signals: RepIssueSignals) -> list[str]:
    reasons: list[str] = []

    if signals.is_sponsor and bill_ref:
        reasons.append(f"Sponsors {bill_ref.upper()}")
    elif signals.is_cosponsor and bill_ref:
        reasons.append(f"Cosponsors {bill_ref.upper()}")

    if signals.committee_relevance:
        reasons.append("Serves on relevant committee")

    if signals.chamber_match:
        chamber = "House" if rep.chamber == "house" else "Senate"
        reasons.append(f"Related bill active in {chamber}")

    if signals.house_vote_signal and rep.chamber == "house":
        reasons.append("Related House vote signal available")

    if signals.public_statement_signal:
        reasons.append("Recent public statement found")

    if not reasons:
        reasons.append("No public position found")

    return reasons


def serialize_signals(scored: RepIssueScored) -> dict[str, Any]:
    payload = asdict(scored.signals)
    payload["reason_badges"] = list(scored.reason_badges)
    payload["rep_id"] = scored.rep.rep_id
    payload["generated_at"] = datetime.utcnow().isoformat() + "Z"
    return payload


def enrich_house_vote_signal(
    rep: RepContext,
    rollcall_votes: list[dict[str, Any]] | None,
) -> bool:
    if rep.chamber != "house":
        return False
    if not rollcall_votes:
        return False

    rep_id = rep.rep_id.strip().lower()
    for vote in rollcall_votes:
        member_id = str(vote.get("rep_id", "")).strip().lower()
        if member_id and member_id == rep_id:
            return True
    return False


def _bill_match(bill_ref: str, bill_rows: list[dict[str, Any]]) -> bool:
    if not bill_ref:
        return False
    normalized = bill_ref.replace(" ", "").replace("-", "").lower()
    for row in bill_rows:
        bill_id = str(row.get("bill_id", "")).replace(" ", "").replace("-", "").lower()
        if bill_id and bill_id == normalized:
            return True
    return False


def _committee_relevance(issue_title: str, committees: list[dict[str, Any]]) -> bool:
    if not issue_title.strip() or not committees:
        return False

    tokens = {token for token in issue_title.lower().split() if len(token) >= 4}
    if not tokens:
        return False

    for committee in committees:
        name = str(committee.get("committee_name", "")).lower()
        if not name:
            continue
        if any(token in name for token in tokens):
            return True
    return False


def _chamber_match(chamber: str, bill_ref: str) -> bool:
    if not bill_ref:
        return False
    normalized = bill_ref.strip().lower()
    if chamber == "house" and normalized.startswith("h."):
        return True
    if chamber == "senate" and normalized.startswith("s."):
        return True
    return False
