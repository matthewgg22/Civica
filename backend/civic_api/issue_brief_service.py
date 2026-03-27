from __future__ import annotations

import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

from .issue_catalog import baseline_issue_variants
from .models import (
    BriefStatus,
    IssueArgumentView,
    IssueBriefRequest,
    IssueBriefResponse,
    IssueClassifyRequest,
    IssueClassifyResponse,
    IssueEvidenceItem,
    IssueFact,
)
from .repository import CivicRepository


_SCRIPT_REQUEST_PATTERNS = (
    "call script",
    "voicemail script",
    "email template",
    "text template",
    "draft a message",
    "what should i say",
    "talking points",
    "persuade",
    "convince",
    "pressure campaign",
    "turnout message",
)

_DEMOGRAPHIC_TARGETING_PATTERNS = (
    "target suburban",
    "target women",
    "target men",
    "target black",
    "target latino",
    "target hispanic",
    "target asian",
    "target jewish",
    "target christian",
    "target young",
    "target seniors",
    "for suburban moms",
)

_CANDIDATE_ENDORSEMENT_PATTERNS = (
    "endorse ",
    "endorsing ",
    "endorsement ",
    "support candidate",
    "vote for ",
    "re-elect ",
    "reelect ",
    "elect ",
    "campaign for ",
)

_ALLOWED_NOMINATION_CONTEXT = (
    "nomination",
    "confirm",
    "confirmation",
    "senate vote",
    "senate hearing",
)

_PUBLIC_FIGURE_TOKENS = (
    "trump",
    "biden",
    "harris",
    "vance",
    "obama",
    "desantis",
    "newsom",
)

_ANTIPATHY_PATTERNS = (
    "i hate ",
    "hate ",
    "can't stand ",
    "cannot stand ",
    "sick of ",
    "fed up with ",
)

_POLICY_SIGNAL_TOKENS = (
    "bill",
    "law",
    "act",
    "policy",
    "budget",
    "tax",
    "immigration",
    "healthcare",
    "abortion",
    "gun",
    "climate",
    "fema",
    "tsa",
    "crypto",
    "housing",
    "inflation",
    "medicare",
    "social security",
    "war",
    "iran",
)

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


@dataclass
class NormalizedEvidence:
    evidence_id: str
    claim: str
    source_name: str
    source_url: str | None
    published_at: datetime | None
    retrieved_at: datetime
    is_stale: bool
    supports_view: str | None

    def published_label(self) -> str | None:
        if self.published_at is None:
            return None
        return self.published_at.astimezone(timezone.utc).date().isoformat()


@dataclass
class _LLMFact:
    evidence_id: str
    fact: str


@dataclass
class _LLMArgument:
    view: str
    argument: str


@dataclass
class _LLMBriefPayload:
    summary_neutral: str
    current_status: str
    key_facts: list[_LLMFact]
    arguments_by_view: list[_LLMArgument]
    unknowns: list[str]
    questions_to_consider: list[str]


class OpenAIIssueBriefer:
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-5.4-nano",
        base_url: str = "https://api.openai.com",
        timeout_seconds: int = 30,
    ) -> None:
        self.api_key = api_key.strip()
        self.model = model.strip() or "gpt-5.4-nano"
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = max(5, timeout_seconds)

    @classmethod
    def from_env(cls) -> OpenAIIssueBriefer | None:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        enabled = _env_flag("VOTENOW_ENABLE_OPENAI_ISSUE_BRIEF", default=False)
        if not api_key or not enabled:
            return None
        model = os.getenv("VOTENOW_OPENAI_MODEL", "gpt-5.4-nano")
        return cls(api_key=api_key, model=model)

    def generate(
        self,
        concern_text: str,
        canonical_issue: str,
        evidence_packet: list[dict[str, Any]],
        policy_flags: list[str],
        user_stance: str | None,
    ) -> tuple[_LLMBriefPayload | None, dict[str, Any]]:
        system_prompt = _read_prompt(
            "issue_brief_system.txt",
            "Create source-grounded issue briefings. Output strict JSON only.",
        )
        user_template = _read_prompt(
            "issue_brief_user.txt",
            (
                "Concern: {concern_text}\n"
                "Canonical issue: {canonical_issue}\n"
                "Policy flags: {policy_flags}\n"
                "User stance: {user_stance}\n"
                "Evidence packet: {evidence_packet}\n"
            ),
        )
        user_prompt = user_template.format(
            concern_text=concern_text.strip(),
            canonical_issue=canonical_issue,
            policy_flags=", ".join(policy_flags) if policy_flags else "none",
            user_stance=user_stance or "unspecified",
            evidence_packet=json.dumps(evidence_packet, ensure_ascii=True),
        )

        payload = {
            "model": self.model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        response = self._post_json("/v1/chat/completions", payload)
        usage = response.get("usage") if isinstance(response, dict) else {}
        choices = response.get("choices") or []
        message = (choices[0] or {}).get("message") if choices else {}
        content = (message or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            return None, usage if isinstance(usage, dict) else {}

        parsed = _parse_json(content)
        if not isinstance(parsed, dict):
            return None, usage if isinstance(usage, dict) else {}
        brief = _validate_llm_payload(parsed)
        if brief is None:
            return None, usage if isinstance(usage, dict) else {}
        return brief, usage if isinstance(usage, dict) else {}

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            url=f"{self.base_url}{path}",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urlrequest.urlopen(req, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except urlerror.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ValueError(f"OpenAI HTTP {exc.code}: {detail}") from exc
        except Exception as exc:
            raise ValueError(f"OpenAI request failed: {exc}") from exc
        decoded = _parse_json(raw)
        if not isinstance(decoded, dict):
            raise ValueError("OpenAI response was not JSON object.")
        return decoded


class IssueBriefService:
    def __init__(self, repository: CivicRepository, max_fact_age_days: int = 30) -> None:
        self.repository = repository
        self.max_fact_age_days = max(1, max_fact_age_days)
        self.openai_briefer = OpenAIIssueBriefer.from_env()
        self._seed_defaults_if_needed()

    def classify(self, request: IssueClassifyRequest) -> IssueClassifyResponse:
        policy_flags, refusal_reason = _evaluate_policy(
            concern_text=request.concern_text,
            requested_output=request.requested_output,
        )
        if refusal_reason:
            self._store_policy_event(
                user_id=request.user_id,
                event_type="policy_refusal",
                reason=refusal_reason,
                concern_text=request.concern_text,
                policy_flags=policy_flags,
            )
            return IssueClassifyResponse(
                status=BriefStatus.REFUSED,
                canonical_issue="policy_restricted",
                confidence=1.0,
                clarification_question="I can provide a policy briefing instead.",
                candidate_issues=[],
                policy_flags=policy_flags,
            )

        if _is_person_antipathy_without_policy(request.concern_text):
            return IssueClassifyResponse(
                status=BriefStatus.OK,
                canonical_issue="executive-accountability-and-oversight",
                confidence=0.42,
                clarification_question=None,
                candidate_issues=[],
                policy_flags=list(dict.fromkeys(policy_flags + ["normalized_personal_antipathy"])),
            )

        issue_core = self._load_issue_core()
        ranked = self._rank_issues(request.concern_text, issue_core)
        if not ranked or ranked[0][1] <= 0:
            return IssueClassifyResponse(
                status=BriefStatus.NEEDS_CLARIFICATION,
                canonical_issue="unspecified",
                confidence=0.0,
                clarification_question=(
                    "Could you clarify the issue area (for example: disaster aid, transportation, healthcare, or nominations)?"
                ),
                candidate_issues=[row["canonical_issue"] for row, _score in ranked[:3]],
                policy_flags=policy_flags + ["ambiguous_issue"],
            )

        top_issue, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else -1
        concern_token_count = len(_tokenize(request.concern_text))
        # Only block for clarification when signal is truly weak and tied.
        if (
            second_score >= 0
            and top_score - second_score <= 0
            and top_score <= 1
            and concern_token_count <= 3
        ):
            return IssueClassifyResponse(
                status=BriefStatus.NEEDS_CLARIFICATION,
                canonical_issue=str(top_issue["canonical_issue"]),
                confidence=round(top_score / max(6.0, top_score), 3),
                clarification_question=(
                    "I found multiple close issue matches. Which one should I focus on?"
                ),
                candidate_issues=[row["canonical_issue"] for row, _score in ranked[:3]],
                policy_flags=policy_flags + ["ambiguous_issue"],
            )

        confidence = min(0.99, max(0.25, top_score / 8.0))
        return IssueClassifyResponse(
            status=BriefStatus.OK,
            canonical_issue=str(top_issue["canonical_issue"]),
            confidence=round(confidence, 3),
            clarification_question=None,
            candidate_issues=[],
            policy_flags=policy_flags,
        )

    def create_brief(self, request: IssueBriefRequest) -> IssueBriefResponse:
        now = datetime.now(timezone.utc)
        request_id = str(uuid.uuid4())
        safety_identifier = self._safety_identifier(request.user_id)
        self._store_brief_request(
            request_id=request_id,
            request=request,
            safety_identifier=safety_identifier,
            created_at=now,
        )

        classify = self.classify(
            IssueClassifyRequest(
                user_id=request.user_id,
                concern_text=request.concern_text,
                requested_output=request.requested_output,
            )
        )

        if classify.status is BriefStatus.REFUSED:
            response = IssueBriefResponse(
                status=BriefStatus.REFUSED,
                canonical_issue="policy_restricted",
                summary_neutral=(
                    "I can’t create lobbying or candidate-endorsement messaging. I can provide a factual issue briefing instead."
                ),
                current_status="Request blocked by policy safeguards.",
                key_facts=[],
                arguments_by_view=[],
                unknowns=["No brief generated because the request asked for disallowed persuasion output."],
                questions_to_consider=[
                    "Do you want a neutral factual briefing on the same issue instead?",
                ],
                policy_flags=classify.policy_flags,
                clarification_question=classify.clarification_question,
                review_prompt="If you want, restate the issue and I can regenerate as a factual brief.",
            )
            self._store_brief_response(request_id, request.user_id, safety_identifier, response, now, llm_usage={})
            return response

        if classify.status is BriefStatus.NEEDS_CLARIFICATION:
            canonical = (classify.canonical_issue or "").strip().lower()
            if request.allow_revision:
                if canonical in {"", "unspecified", "policy_restricted"}:
                    canonical = ""
                    if classify.candidate_issues:
                        candidate = str(classify.candidate_issues[0]).strip().lower()
                        if candidate and candidate not in {"unspecified", "policy_restricted"}:
                            canonical = candidate
                    if not canonical:
                        canonical = "general-civic-issue"
                classify = IssueClassifyResponse(
                    status=BriefStatus.OK,
                    canonical_issue=canonical,
                    confidence=max(0.3, classify.confidence),
                    clarification_question=classify.clarification_question,
                    candidate_issues=classify.candidate_issues,
                    policy_flags=list(dict.fromkeys(classify.policy_flags + ["auto_selected_from_ambiguous"])),
                )
            else:
                response = IssueBriefResponse(
                    status=BriefStatus.NEEDS_CLARIFICATION,
                    canonical_issue=classify.canonical_issue,
                    summary_neutral="I need one clarification before drafting the full brief.",
                    current_status="Awaiting issue clarification.",
                    key_facts=[],
                    arguments_by_view=[],
                    unknowns=["The concern text maps to multiple possible issues."],
                    questions_to_consider=["Which issue should this brief focus on first?"],
                    policy_flags=classify.policy_flags,
                    clarification_question=classify.clarification_question,
                    review_prompt="Reply with your preferred issue focus and I will regenerate.",
                )
                self._store_brief_response(request_id, request.user_id, safety_identifier, response, now, llm_usage={})
                return response

        issue_core = self._load_issue_core()
        core = next(
            (row for row in issue_core if str(row.get("canonical_issue", "")) == classify.canonical_issue),
            {"canonical_issue": classify.canonical_issue, "title": classify.canonical_issue.replace("-", " ").title()},
        )
        evidence = self._normalize_evidence(self.repository.list_issue_evidence_items(classify.canonical_issue), now=now)
        user_stance = _infer_user_stance(request.concern_text)

        llm_usage: dict[str, Any] = {}
        llm_payload: _LLMBriefPayload | None = None
        if self.openai_briefer is not None and evidence:
            try:
                llm_payload, llm_usage = self.openai_briefer.generate(
                    concern_text=request.concern_text,
                    canonical_issue=classify.canonical_issue,
                    evidence_packet=[_evidence_packet_row(item) for item in evidence],
                    policy_flags=classify.policy_flags,
                    user_stance=user_stance,
                )
            except Exception as exc:
                self._store_policy_event(
                    user_id=request.user_id,
                    event_type="llm_fallback",
                    reason=str(exc),
                    concern_text=request.concern_text,
                    policy_flags=classify.policy_flags,
                )

        if llm_payload is not None:
            response = self._from_llm_payload(
                payload=llm_payload,
                canonical_issue=classify.canonical_issue,
                evidence=evidence,
                policy_flags=classify.policy_flags,
            )
            if response is None:
                response = self._deterministic_brief(
                    request=request,
                    canonical_issue=classify.canonical_issue,
                    core=core,
                    evidence=evidence,
                    policy_flags=classify.policy_flags,
                    user_stance=user_stance,
                )
        else:
            response = self._deterministic_brief(
                request=request,
                canonical_issue=classify.canonical_issue,
                core=core,
                evidence=evidence,
                policy_flags=classify.policy_flags,
                user_stance=user_stance,
            )

        self._store_issue_snapshot(
            user_id=request.user_id,
            safety_identifier=safety_identifier,
            canonical_issue=classify.canonical_issue,
            response=response,
            evidence=evidence,
            created_at=now,
        )
        self._store_brief_response(request_id, request.user_id, safety_identifier, response, now, llm_usage=llm_usage)
        return response

    def _from_llm_payload(
        self,
        payload: _LLMBriefPayload,
        canonical_issue: str,
        evidence: list[NormalizedEvidence],
        policy_flags: list[str],
    ) -> IssueBriefResponse | None:
        evidence_by_id = {item.evidence_id: item for item in evidence}
        facts: list[IssueFact] = []
        for fact in payload.key_facts:
            source = evidence_by_id.get(fact.evidence_id)
            if source is None:
                return None
            facts.append(
                IssueFact(
                    fact=fact.fact,
                    source_name=source.source_name,
                    source_url=source.source_url,
                    published_at=source.published_label(),
                )
            )

        combined_text = " ".join(
            [payload.summary_neutral, payload.current_status, *payload.unknowns, *(item.argument for item in payload.arguments_by_view)]
        )
        if _contains_unverified_legislation_or_quote(combined_text, evidence):
            return None

        return IssueBriefResponse(
            status=BriefStatus.OK,
            canonical_issue=canonical_issue,
            summary_neutral=payload.summary_neutral,
            current_status=payload.current_status,
            key_facts=facts,
            arguments_by_view=[IssueArgumentView(view=item.view, argument=item.argument) for item in payload.arguments_by_view],
            unknowns=list(payload.unknowns),
            questions_to_consider=list(payload.questions_to_consider),
            policy_flags=policy_flags + self._evidence_flags(evidence),
            clarification_question=None,
            review_prompt="Did this address your issue? If not, tell me what to revise.",
        )

    def _deterministic_brief(
        self,
        request: IssueBriefRequest,
        canonical_issue: str,
        core: dict[str, Any],
        evidence: list[NormalizedEvidence],
        policy_flags: list[str],
        user_stance: str | None,
    ) -> IssueBriefResponse:
        title = str(core.get("title", canonical_issue.replace("-", " ").title()))
        summary = (
            f"You raised concerns about {title}. This brief summarizes available evidence and open questions in plain language."
        )
        if user_stance:
            summary += f" Your current position appears to be: {user_stance}."

        if evidence:
            freshest = evidence[0]
            current_status = (
                f"Most recent evidence points to ongoing activity on this issue. "
                f"Latest item: {freshest.source_name}"
                + (f" ({freshest.published_label()})" if freshest.published_label() else "")
                + "."
            )
        else:
            current_status = "No verified evidence items are available yet for this issue in the current packet."

        facts: list[IssueFact] = []
        for item in evidence[:5]:
            fact_text = item.claim
            if item.is_stale:
                fact_text = f"{fact_text} (Older than 30 days.)"
            facts.append(
                IssueFact(
                    fact=fact_text,
                    source_name=item.source_name,
                    source_url=item.source_url,
                    published_at=item.published_label(),
                )
            )

        arguments = [
            IssueArgumentView(
                view="Supporters' perspective",
                argument=(
                    "Supporters argue the evidence supports timely action and clearer public commitments from decision-makers."
                ),
            ),
            IssueArgumentView(
                view="Skeptics' perspective",
                argument=(
                    "Skeptics argue implementation details, tradeoffs, and costs should be resolved before broader commitments are made."
                ),
            ),
        ]

        unknowns = [
            "What updates are expected in the next 30 days?",
            "Which agencies or committees have formal next-step authority?",
        ]
        if not evidence:
            unknowns.insert(0, "No curated evidence items were available for this issue.")
        if any(item.is_stale for item in evidence):
            unknowns.append("Some evidence items are older than 30 days and may need refresh.")

        questions = [
            "What outcome do you want in the next legislative or agency step?",
            "What evidence would change your view on this issue?",
            "What timeline would count as meaningful progress?",
        ]

        response = IssueBriefResponse(
            status=BriefStatus.OK,
            canonical_issue=canonical_issue,
            summary_neutral=summary,
            current_status=current_status,
            key_facts=facts,
            arguments_by_view=arguments,
            unknowns=unknowns[:5],
            questions_to_consider=questions,
            policy_flags=policy_flags + self._evidence_flags(evidence),
            clarification_question=None,
            review_prompt="Did this address your issue? If not, tell me what to revise.",
        )
        return response

    def _evidence_flags(self, evidence: list[NormalizedEvidence]) -> list[str]:
        flags: list[str] = []
        if not evidence:
            return ["weak_evidence"]
        stale_count = sum(1 for item in evidence if item.is_stale)
        if stale_count:
            flags.append("stale_evidence")
        if len(evidence) < 2:
            flags.append("weak_evidence")
        supports = {item.supports_view for item in evidence if item.supports_view}
        if "support" in supports and "oppose" in supports:
            flags.append("conflicting_evidence")
        return flags

    def _rank_issues(self, concern_text: str, issue_core: list[dict[str, Any]]) -> list[tuple[dict[str, Any], int]]:
        cleaned = _normalize_space(concern_text.lower())
        concern_tokens = _tokenize(cleaned)
        ranked: list[tuple[dict[str, Any], int]] = []
        for row in issue_core:
            title = _normalize_space(str(row.get("title", "")).lower())
            tags = [str(value).lower() for value in row.get("tags", []) if str(value).strip()]
            synonyms = [str(value).lower() for value in row.get("synonyms", []) if str(value).strip()]
            canonical = str(row.get("canonical_issue", "")).lower().replace("-", " ")
            haystack_tokens = set(_tokenize(" ".join([title, canonical, *tags, *synonyms])))
            overlap_tokens = concern_tokens.intersection(haystack_tokens)
            overlap = len(overlap_tokens)
            phrase_hits = sum(1 for phrase in [title, *synonyms] if phrase and phrase in cleaned)
            score = overlap + (2 * phrase_hits)
            high_signal_tokens = {"crypto", "cryptocurrency", "bitcoin", "stablecoin", "blockchain", "token"}
            if overlap_tokens.intersection(high_signal_tokens):
                score += 3
            ranked.append((row, score))
        return sorted(ranked, key=lambda item: item[1], reverse=True)

    def _load_issue_core(self) -> list[dict[str, Any]]:
        try:
            rows = self.repository.list_issue_core()
        except Exception:
            rows = []
        if rows:
            return rows
        return self._seed_defaults_if_needed()

    def _seed_defaults_if_needed(self) -> list[dict[str, Any]]:
        seed_rows = _seed_issue_core_rows()
        try:
            existing = self.repository.list_issue_core()
        except Exception:
            existing = []

        if not existing:
            for row in seed_rows:
                try:
                    self.repository.upsert_issue_core(row)
                except Exception:
                    continue
            for evidence in _seed_evidence_rows():
                try:
                    self.repository.upsert_issue_evidence_item(evidence)
                except Exception:
                    continue
        else:
            existing_canonicals = {
                str(row.get("canonical_issue", "")).strip().lower()
                for row in existing
                if str(row.get("canonical_issue", "")).strip()
            }
            missing_canonicals: set[str] = set()
            for row in seed_rows:
                canonical = str(row.get("canonical_issue", "")).strip().lower()
                if not canonical or canonical in existing_canonicals:
                    continue
                missing_canonicals.add(canonical)
                try:
                    self.repository.upsert_issue_core(row)
                except Exception:
                    continue

            if missing_canonicals:
                for evidence in _seed_evidence_rows():
                    canonical = str(evidence.get("canonical_issue", "")).strip().lower()
                    if canonical not in missing_canonicals:
                        continue
                    try:
                        self.repository.upsert_issue_evidence_item(evidence)
                    except Exception:
                        continue

        try:
            existing = self.repository.list_issue_core()
        except Exception:
            existing = []
        return existing or seed_rows

    def _normalize_evidence(self, evidence_items: list[IssueEvidenceItem], now: datetime) -> list[NormalizedEvidence]:
        normalized: list[NormalizedEvidence] = []
        freshness_cutoff = now - timedelta(days=self.max_fact_age_days)
        for item in evidence_items:
            claim = _normalize_space(item.claim)
            if not claim:
                continue
            reference_time = item.published_at or item.retrieved_at
            is_stale = reference_time < freshness_cutoff
            normalized.append(
                NormalizedEvidence(
                    evidence_id=item.evidence_id,
                    claim=claim,
                    source_name=item.source_name,
                    source_url=item.source_url,
                    published_at=item.published_at,
                    retrieved_at=item.retrieved_at,
                    is_stale=is_stale,
                    supports_view=item.supports_view,
                )
            )
        normalized.sort(
            key=lambda item: (
                item.published_at or item.retrieved_at,
                item.retrieved_at,
            ),
            reverse=True,
        )
        return normalized

    def _store_brief_request(
        self,
        request_id: str,
        request: IssueBriefRequest,
        safety_identifier: str,
        created_at: datetime,
    ) -> None:
        row = {
            "id": request_id,
            "user_id": request.user_id,
            "safety_identifier": safety_identifier,
            "concern_text": request.concern_text,
            "requested_output": request.requested_output,
            "allow_revision": request.allow_revision,
            "created_at": created_at.astimezone(timezone.utc).isoformat(),
        }
        try:
            self.repository.insert_brief_request(row)
        except Exception:
            return

    def _store_brief_response(
        self,
        request_id: str,
        user_id: str,
        safety_identifier: str,
        response: IssueBriefResponse,
        created_at: datetime,
        llm_usage: dict[str, Any],
    ) -> None:
        row = {
            "id": str(uuid.uuid4()),
            "request_id": request_id,
            "user_id": user_id,
            "safety_identifier": safety_identifier,
            "status": response.status.value,
            "canonical_issue": response.canonical_issue,
            "response_json": response.to_dict(),
            "llm_model": os.getenv("VOTENOW_OPENAI_MODEL", "gpt-5.4-nano"),
            "llm_usage": llm_usage,
            "created_at": created_at.astimezone(timezone.utc).isoformat(),
        }
        try:
            self.repository.insert_brief_response(row)
        except Exception:
            return

    def _store_issue_snapshot(
        self,
        user_id: str,
        safety_identifier: str,
        canonical_issue: str,
        response: IssueBriefResponse,
        evidence: list[NormalizedEvidence],
        created_at: datetime,
    ) -> None:
        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "safety_identifier": safety_identifier,
            "canonical_issue": canonical_issue,
            "snapshot_json": response.to_dict(),
            "evidence_ids": [item.evidence_id for item in evidence],
            "created_at": created_at.astimezone(timezone.utc).isoformat(),
        }
        try:
            self.repository.insert_issue_snapshot(row)
        except Exception:
            return

    def _store_policy_event(
        self,
        user_id: str,
        event_type: str,
        reason: str,
        concern_text: str,
        policy_flags: list[str],
    ) -> None:
        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "safety_identifier": self._safety_identifier(user_id),
            "event_type": event_type,
            "reason": reason[:500],
            "policy_flags": policy_flags,
            "concern_excerpt": _normalize_space(concern_text)[:240],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            self.repository.insert_policy_event(row)
        except Exception:
            return

    def _safety_identifier(self, user_id: str) -> str:
        salt = os.getenv("VOTENOW_SAFETY_SALT", "votenow")
        digest = hashlib.sha256(f"{salt}:{user_id}".encode("utf-8")).hexdigest()
        return f"sha256:{digest[:16]}"


def _evaluate_policy(concern_text: str, requested_output: str | None) -> tuple[list[str], str | None]:
    text = _normalize_space(f"{concern_text} {requested_output or ''}".lower())
    flags: list[str] = []

    if any(pattern in text for pattern in _SCRIPT_REQUEST_PATTERNS):
        flags.append("persuasion_or_script_request")
        return flags, "Script-generation and persuasion templates are disabled in this endpoint."

    if any(pattern in text for pattern in _DEMOGRAPHIC_TARGETING_PATTERNS) or re.search(
        r"\btarget(?:ed|s|ing)?\b.{0,30}\b(suburban|women|men|black|latino|hispanic|asian|jewish|christian|young|seniors)\b",
        text,
    ):
        flags.append("demographic_targeting")
        return flags, "Demographic targeting requests are not allowed."

    has_candidate_endorsement = any(pattern in text for pattern in _CANDIDATE_ENDORSEMENT_PATTERNS) or bool(
        re.search(r"\bendorse(?:ment|d|s|ing)?\b", text)
    )
    if has_candidate_endorsement:
        is_nomination_context = any(token in text for token in _ALLOWED_NOMINATION_CONTEXT)
        if not is_nomination_context:
            flags.append("candidate_endorsement")
            return flags, "Candidate or individual endorsement messaging is not allowed."
        flags.append("nomination_context")

    return flags, None


def _infer_user_stance(concern_text: str) -> str | None:
    lower = concern_text.lower()
    if "support" in lower or "vote yes" in lower:
        return "supportive of action"
    if "oppose" in lower or "vote no" in lower:
        return "opposed to action"
    if "concerned" in lower or "worried" in lower:
        return "seeking risk reduction"
    return None


def _is_person_antipathy_without_policy(concern_text: str) -> bool:
    text = _normalize_space(concern_text.lower())
    if not text:
        return False
    has_figure = any(token in text for token in _PUBLIC_FIGURE_TOKENS)
    has_antipathy = any(pattern in text for pattern in _ANTIPATHY_PATTERNS)
    has_policy_signal = any(token in text for token in _POLICY_SIGNAL_TOKENS)
    token_count = len(_tokenize(text))
    return has_figure and has_antipathy and not has_policy_signal and token_count <= 8


def _contains_unverified_legislation_or_quote(text: str, evidence: list[NormalizedEvidence]) -> bool:
    if not text.strip():
        return False
    combined_evidence = " ".join(item.claim for item in evidence).lower()
    bill_mentions = re.findall(r"\b(?:h\.r\.|s\.)\s*\d+\b", text.lower())
    for bill in bill_mentions:
        if bill not in combined_evidence:
            return True
    quote_segments = re.findall(r"\"([^\"]{8,200})\"", text)
    for quote in quote_segments:
        if quote.lower() not in combined_evidence:
            return True
    return False


def _seed_issue_core_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for variant in baseline_issue_variants():
        rows.append(
            {
                "canonical_issue": variant.slug,
                "title": variant.title,
                "category": variant.category,
                "overview": variant.overview,
                "tags": list(variant.tags),
                "synonyms": [variant.title.lower()],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    rows.extend(
        [
            {
                "canonical_issue": "executive-accountability-and-oversight",
                "title": "Executive Accountability and Oversight",
                "category": "Government Oversight",
                "overview": (
                    "This issue focuses on executive-branch accountability, transparency, and constitutional checks and "
                    "balances. Constituents can ask Congress to use hearings, public statements, and oversight authorities "
                    "to hold executive officials accountable."
                ),
                "tags": ["oversight", "accountability", "executive branch", "white house", "checks and balances"],
                "synonyms": [
                    "executive accountability",
                    "presidential accountability",
                    "white house oversight",
                    "congressional oversight",
                ],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "canonical_issue": "crypto-consumer-protection",
                "title": "Cryptocurrency Consumer Protection",
                "category": "Financial Services",
                "overview": (
                    "Digital asset users can face fraud, market manipulation, platform insolvency risk, and unclear dispute "
                    "processes. This issue focuses on stronger consumer protections, clearer disclosure rules, safer custody "
                    "standards, and better enforcement coordination."
                ),
                "tags": ["crypto", "cryptocurrency", "digital assets", "consumer protection", "financial services"],
                "synonyms": [
                    "crypto consumer protection",
                    "cryptocurrency safeguards",
                    "digital asset consumer safety",
                    "stablecoin consumer protections",
                    "exchange transparency and custody",
                ],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "canonical_issue": "hawaii-flood-relief",
                "title": "Hawaii Flood Relief",
                "category": "Disaster Response",
                "overview": (
                    "Hawaii is dealing with major flooding, emergency rescues, and infrastructure damage. "
                    "State leaders are requesting federal disaster support and higher FEMA cost share."
                ),
                "tags": ["hawaii", "flood", "fema", "disaster", "recovery"],
                "synonyms": ["hawaii flooding", "fema disaster declaration", "flood recovery aid"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "canonical_issue": "tsa-staffing-travel-delays",
                "title": "TSA Staffing and Travel Delays",
                "category": "Transportation",
                "overview": (
                    "High passenger volume and TSA staffing strain can increase checkpoint bottlenecks. "
                    "Funding staffing and compensation is one direct lever for improving security throughput."
                ),
                "tags": ["tsa", "airports", "travel delays", "aviation", "staffing"],
                "synonyms": ["airport security lines", "tsa officer staffing", "checkpoint delays"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        ]
    )
    return rows


def _seed_evidence_rows() -> list[dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[dict[str, Any]] = []
    for variant in baseline_issue_variants():
        rows.append(
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": variant.slug,
                "source_name": "VoteNow curated issue packet",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": variant.overview,
                "evidence_type": "curated_packet",
                "supports_view": None,
            }
        )

    rows.extend(
        [
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "executive-accountability-and-oversight",
                "source_name": "Congressional oversight baseline",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "Congress has oversight tools including hearings, investigations, appropriations controls, and public reporting requirements."
                ),
                "evidence_type": "institutional_context",
                "supports_view": None,
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "executive-accountability-and-oversight",
                "source_name": "Constituent accountability framing",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "Constituents can ask members of Congress to publicly state positions and use oversight powers to increase executive accountability."
                ),
                "evidence_type": "civic_process",
                "supports_view": "support",
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "crypto-consumer-protection",
                "source_name": "Federal financial consumer and market oversight context",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "Crypto users can be exposed to fraud, insolvency risk, and custody failures when platform disclosures and safeguards are weak."
                ),
                "evidence_type": "regulatory_context",
                "supports_view": "support",
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "crypto-consumer-protection",
                "source_name": "Digital asset policy coordination context",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "Clear standards for disclosures, reserves, custody, and enforcement coordination are frequently identified as core consumer-protection levers."
                ),
                "evidence_type": "policy_context",
                "supports_view": None,
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "hawaii-flood-relief",
                "source_name": "Hawaii emergency operations updates",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "Major flooding has led to rescues, evacuations, and broad infrastructure damage across affected communities."
                ),
                "evidence_type": "official_update",
                "supports_view": "support",
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "hawaii-flood-relief",
                "source_name": "Governor disaster declaration request",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "State leadership requested a presidential major disaster declaration and elevated federal cost share support."
                ),
                "evidence_type": "official_request",
                "supports_view": "support",
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "tsa-staffing-travel-delays",
                "source_name": "Federal aviation delay data",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "Delay causes are split across airlines, aviation system constraints, weather, and a smaller share from security screening."
                ),
                "evidence_type": "federal_data",
                "supports_view": None,
            },
            {
                "evidence_id": str(uuid.uuid4()),
                "canonical_issue": "tsa-staffing-travel-delays",
                "source_name": "TSA workforce reporting",
                "source_url": None,
                "published_at": now_iso,
                "retrieved_at": now_iso,
                "claim": (
                    "TSA staffing turnover and attrition pressures can contribute to checkpoint bottlenecks during high travel demand."
                ),
                "evidence_type": "workforce_report",
                "supports_view": "support",
            },
        ]
    )
    return rows


def _evidence_packet_row(item: NormalizedEvidence) -> dict[str, Any]:
    return {
        "evidence_id": item.evidence_id,
        "claim": item.claim,
        "source_name": item.source_name,
        "source_url": item.source_url,
        "published_at": item.published_label(),
        "supports_view": item.supports_view,
    }


def _read_prompt(filename: str, fallback: str) -> str:
    path = _PROMPTS_DIR / filename
    try:
        text = path.read_text(encoding="utf-8").strip()
        return text or fallback
    except Exception:
        return fallback


def _parse_json(raw: str) -> Any:
    text = raw.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            snippet = text[start : end + 1]
            try:
                return json.loads(snippet)
            except json.JSONDecodeError:
                return None
        return None


def _normalize_space(value: str) -> str:
    return " ".join(value.split()).strip()


def _tokenize(value: str) -> set[str]:
    return {token for token in re.split(r"[^a-z0-9]+", value.lower()) if len(token) >= 3}


def _validate_llm_payload(payload: dict[str, Any]) -> _LLMBriefPayload | None:
    summary = _coerce_text(payload.get("summary_neutral"), max_len=800)
    current = _coerce_text(payload.get("current_status"), max_len=500)
    unknowns = _coerce_string_list(payload.get("unknowns"), max_items=6, min_items=1, max_len=220)
    questions = _coerce_string_list(payload.get("questions_to_consider"), max_items=6, min_items=2, max_len=220)
    raw_facts = payload.get("key_facts")
    raw_args = payload.get("arguments_by_view")

    if not summary or not current or not unknowns or not questions:
        return None
    if not isinstance(raw_facts, list) or not (1 <= len(raw_facts) <= 6):
        return None
    if not isinstance(raw_args, list) or not (2 <= len(raw_args) <= 4):
        return None

    facts: list[_LLMFact] = []
    for item in raw_facts:
        if not isinstance(item, dict):
            return None
        evidence_id = _coerce_text(item.get("evidence_id"), max_len=120)
        fact = _coerce_text(item.get("fact"), max_len=280)
        if not evidence_id or not fact:
            return None
        facts.append(_LLMFact(evidence_id=evidence_id, fact=fact))

    arguments: list[_LLMArgument] = []
    for item in raw_args:
        if not isinstance(item, dict):
            return None
        view = _coerce_text(item.get("view"), max_len=120)
        argument = _coerce_text(item.get("argument"), max_len=360)
        if not view or not argument:
            return None
        arguments.append(_LLMArgument(view=view, argument=argument))

    return _LLMBriefPayload(
        summary_neutral=summary,
        current_status=current,
        key_facts=facts,
        arguments_by_view=arguments,
        unknowns=unknowns,
        questions_to_consider=questions,
    )


def _coerce_text(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = _normalize_space(value)
    if not cleaned:
        return ""
    return cleaned[:max_len]


def _coerce_string_list(value: Any, max_items: int, min_items: int, max_len: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = _coerce_text(item, max_len=max_len)
        if text:
            out.append(text)
    deduped: list[str] = []
    seen: set[str] = set()
    for item in out:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    sliced = deduped[:max_items]
    if len(sliced) < min_items:
        return []
    return sliced


def _env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
