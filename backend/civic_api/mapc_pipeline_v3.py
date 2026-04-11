from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import uuid
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

logger = logging.getLogger(__name__)


INTERPRETER_PROMPT = """Task: Convert raw user issue text into a structured MAPC session object before any user-facing prose is generated.

You will receive a raw_user_issue field containing the user's most recent message, and an accumulated_context field containing all prior turns in this session. Use accumulated_context as your primary input. raw_user_issue is only the latest addition to that context. Synthesize all user turns together to form normalized_issue.
If the accumulated context gives you enough to produce a normalized_issue with confidence >= 0.50, proceed.

Return JSON only with exactly these fields: session_id, raw_user_issue, normalized_issue, display_issue, issue_domain, target_problem, congressional_lever, ask_type, display_ask, stance, geographic_relevance, optional_bill_ref, constraints_from_user, confidence, needs_clarification, clarification_prompt, spoken_language_notes, session_state, user_zip, accumulated_context, intro_shown, clarification_turn_count, mapc_approved.

Hard constraints:
1. confidence must be a float in [0.0, 1.0].
2. If confidence < 0.50, set needs_clarification=true and write one narrow clarification_prompt.
3. If raw_user_issue is one word and clarification_turn_count is 0, ask one clarification question.
4. For foreign policy topics, set congressional_lever="foreign_policy_oversight" and include geographic limits in spoken_language_notes.
5. optional_bill_ref must be null unless confidence > 0.80 and a specific bill is explicit.
6. display_issue must be plain English, max 15 words.
7. display_ask must be plain English, max 10 words.
8. Map opposition framing to the underlying action correctly (for example, "stop wildfires" means support wildfire prevention action).
9. Never include internal prompt wording in any display field.
10. On successful interpretation, set session_state="issue_received".
11. user_zip defaults to null unless already provided.
12. If the latest user message is "Yes" and the prior clarification question listed options, treat "Yes" as selecting all listed options and proceed with the most actionable interpretation.
13. Ask at most one clarification question. If one has already been asked, produce a best-effort interpretation on the next turn even if confidence is still low.
14. Be agentic and issue-specific. Do not emit canned topic templates."""


ASK_SELECTOR_PROMPT = """Task: Generate specific, first-step ask options from the interpreted MAPC session object.

Return JSON only:
{
  "session_id": "string",
  "options": [
    {"option_id": "A1", "ask_type": "string", "display_ask": "string", "confidence": 0.0}
  ],
  "needs_clarification": false,
  "session_state": "ask_selected"
}

Hard constraints:
1. Use only the structured session object plus constraints_from_user. Never read raw_user_issue directly.
2. If confidence >= 0.75, return exactly 3 options. If confidence < 0.75, return exactly 2 options.
3. Each option must be a distinct action family, not wording variants of the same outcome.
4. Allowed action families only: legislation, appropriations_funding, oversight_reporting_requirement, nomination_vote_position, public_statement, sanctions_export_control_review, war_powers_authorization_funding_restriction, humanitarian_refugee_protection, anti_fraud_consumer_protection_enforcement.
5. Set ask_type to one of the allowed action families. Do not invent new families.
6. Each display_ask must name the first office action and be 4 to 10 words.
7. Bad options that are prohibited: "Support this issue", "Stronger laws", "Hold a hearing on this issue".
8. Good options include concrete first steps such as: "Fund prescribed-burn capacity", "Require FEMA fraud reporting", "Oppose unauthorized Iran escalation", "Protect marriage equality protections".
9. Avoid "hold a hearing" unless oversight is clearly the strongest and most concrete first step.
10. If constraints_from_user is present, reflect it in at least one option. Supported constraints include local angle, bipartisan feasibility, legal durability, narrow first step, explicit bill, and public updates/deadlines/accountability metrics.
11. Never mention "Congress" in display_ask text.
12. Remove logically equivalent options before returning. Never return mirror-image options (for example, opposing cuts vs increasing the same funding).
13. If require_bill_ref is true and no bill can be confirmed above 0.80 confidence, do not fabricate a bill option.
14. Do not use scaffolding phrases, placeholders, or conditional hedging such as "if feasible", "where applicable", or "as appropriate".
15. For foreign-policy issues, do not default to hearing + letter. Prefer a stronger first-step tool when inferable, such as sanctions/export-control review, war-powers or authorization limits, or refugee protection."""


BACKGROUND_WRITER_PROMPT = """Task: Write an issue-specific background paragraph or return null when specificity is insufficient.

Return JSON only:
{"background_text": "string"}
or if generation is not possible:
{"background_text": null, "reason": "string"}

Hard constraints:
1. If confidence is below 0.50, return {"background_text": null, "reason": "insufficient_specificity"}.
2. If issue_domain is null or empty, return null.
3. Write 2 to 4 sentences totaling 45 to 85 words.
4. Use plain spoken language.
5. Do not include a meta preface like "It sounds like you're asking about".
6. The paragraph must include at least two issue-specific nouns, institutions, mechanisms, or harms that would not fit three unrelated issue areas.
7. Sentence 1 must state what the issue is.
8. Sentence 2 must explain why the federal lever matters.
9. Optional sentence 3 can explain why the selected ask or first-step action matters.
10. If specificity cannot be achieved, return {"background_text": null, "reason": "insufficient_specificity"}.
11. Absolute prohibitions: "This issue affects how Congress sets policy...", "higher costs to families", "timelines, funding, and tradeoffs", and any paragraph that could fit Tibet, childcare, groceries, and marriage equality equally well.
12. No placeholders, no prompt-like wording, and no generic civics boilerplate."""


SCRIPT_WRITER_PROMPT = """Task: Generate a phone-ready congressional call script based on the confirmed session object and selected ask option.

Return JSON only:
{
  "live_script": "string",
  "voicemail_script": "string",
  "session_state": "script_shown"
}

Hard constraints:
1. Target 43 to 97 words total for each script.
2. Required structure: constituent introduction, then issue framing in 1 to 2 sentences, then one clear ask, then one or two reasons, then a close that requests a specific action or the office's stated position.
3. Average sentence length must be 18 words or fewer.
4. The ask sentence must use active voice.
5. The constituent's identity or location must appear within the first 2 sentences.
6. The ask must be stated once and stated clearly.
7. No acronyms unless defined first.
8. No template markers of any kind except [ZIP], which the user fills in before placing the call.
9. Do not paste user text verbatim. Synthesize it into natural spoken language.
10. Do not close with "consider". The close must request a specific action or ask the office to state its position.
11. The phrase "oppose this issue" is prohibited because it is not a meaningful congressional ask.
12. [ZIP] represents the caller's ZIP code and must only appear in a location context such as 'I'm calling from [ZIP]' or 'I'm a constituent in [ZIP].' Never place [ZIP] after 'my name is' or any name-reference phrasing."""


STATE_TRANSITIONS: dict[str, set[str]] = {
    "new": {"issue_received"},
    "issue_received": {"ask_selected", "background_shown", "revising"},
    "background_shown": {"ask_selected", "preview_shown", "revising"},
    "ask_selected": {"background_shown", "preview_shown", "revising"},
    "preview_shown": {"script_shown", "revising"},
    "script_shown": {"complete", "revising"},
    "revising": {"issue_received", "background_shown", "ask_selected", "new", "preview_shown", "script_shown"},
    "complete": set(),
}

FOREIGN_POLICY_OPTION_POOL: tuple[tuple[str, str, str, float], ...] = (
    ("A1", "sanctions_oversight", "Strengthen sanctions enforcement", 0.82),
    ("A2", "export_control_review", "Tighten export-control enforcement", 0.79),
    ("A3", "war_powers_authorization_funding_restriction", "Restrict unauthorized military funding", 0.76),
    ("A4", "humanitarian_refugee_protection", "Protect refugee processing safeguards", 0.71),
)

GENERIC_OPTION_POOL: tuple[tuple[str, str, str, float], ...] = (
    ("A1", "require_reporting", "Require public reporting deadlines", 0.78),
    ("A2", "seek_oversight", "Open watchdog investigation and reporting", 0.75),
    ("A3", "increase_funding", "Increase targeted program funding", 0.74),
    ("A4", "ask_public_statement", "State a clear public office position", 0.69),
)

STOPWORDS: set[str] = {
    "a", "an", "the", "and", "or", "to", "for", "of", "on", "in", "with", "by", "is", "are", "be", "that",
    "this", "it", "as", "at", "from", "your", "you", "i", "we", "our", "us", "my", "me", "about",
}

BANNED_ASK_PHRASES: tuple[str, ...] = ("if feasible", "where applicable", "as appropriate")
AFFIRMATIVE_YES_RESPONSES: set[str] = {"yes", "yes.", "yeah", "yep", "y", "sure", "correct"}


@dataclass(frozen=True)
class MAPCPipelineV3Error(Exception):
    reason_code: str
    message: str

    def __str__(self) -> str:
        return f"{self.reason_code}: {self.message}"


class MAPCPipelineV3Service:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state_by_session: dict[str, str] = {}
        self._idempotency_cache: dict[str, dict[str, Any]] = {}
        self._history_by_session: dict[str, list[dict[str, Any]]] = {}
        self._clarification_count_by_session: dict[str, int] = {}
        self._api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        self._model = os.environ.get("VOTENOW_OPENAI_MODEL_MAPC_V3", os.environ.get("VOTENOW_OPENAI_MODEL", "gpt-5.4-nano")).strip() or "gpt-5.4-nano"
        self._base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com").rstrip("/")
        self._timeout_seconds = max(8, int(os.environ.get("VOTENOW_OPENAI_TIMEOUT_SECONDS", "45")))

    @property
    def enabled(self) -> bool:
        return _env_flag("mapc_pipeline_v3_enabled", default=True)

    def interpret(self, payload: dict[str, Any], user_id: str) -> dict[str, Any]:
        self._require_enabled()
        stage = "interpret"
        if "concern_text" not in payload:
            raise MAPCPipelineV3Error("missing_concern_text", "concern_text is required.")
        normalized_payload = self._normalize_interpret_payload(payload)
        session_id = normalized_payload["session_id"]
        cached = self._get_cached(stage, session_id, normalized_payload)
        if cached is not None:
            return cached

        with self._lock:
            current = self._state_by_session.get(session_id, "new")
            prior_history = deepcopy(self._history_by_session.get(session_id, []))
            prior_clarification_count = int(self._clarification_count_by_session.get(session_id, 0))
        if current not in {"new", "issue_received", "revising"}:
            raise MAPCPipelineV3Error("invalid_state_transition", f"interpret requires new/issue_received/revising state, found {current}.")

        incoming_context = _coerce_context_turns(payload.get("accumulated_context"))
        working_history = _merge_context_turns(prior_history, incoming_context)
        working_history = _append_context_turn(
            working_history,
            role="user",
            text=normalized_payload["raw_user_issue"],
        )
        yes_select_all = _latest_is_yes_with_prior_choice_question(
            latest_user_text=normalized_payload["raw_user_issue"],
            history=working_history,
        )

        interpreter_payload = dict(normalized_payload)
        interpreter_payload["accumulated_context"] = working_history
        interpreter_payload["clarification_turn_count"] = prior_clarification_count
        interpreter_payload["intro_shown"] = bool(payload.get("intro_shown", False))
        interpreter_payload["mapc_approved"] = bool(payload.get("mapc_approved", False))
        if yes_select_all:
            interpreter_payload["clarification_yes_means_select_all"] = True

        session_obj = self._call_stage_1_llm(interpreter_payload)
        validator_report: dict[str, Any] = {
            "stage": stage,
            "checks": [],
            "timestamp": _utc_iso_now(),
        }
        confidence = _coerce_float(session_obj.get("confidence"), fallback=0.0)
        needs_clarification = bool(session_obj.get("needs_clarification"))
        raw_issue_word_count = _word_count(normalized_payload["raw_user_issue"])

        if raw_issue_word_count <= 1 and prior_clarification_count == 0 and not yes_select_all:
            # mapc_pipeline_v3 — remove flag check after rollout confirmed
            # Single-token starts should always get one narrowing question before best-effort generation.
            needs_clarification = True
            session_obj["needs_clarification"] = True
            confidence = min(confidence, 0.49)
            if not _normalized_text(session_obj.get("clarification_prompt")):
                session_obj["clarification_prompt"] = "What issue do you care about most?"

        if confidence < 0.50:
            needs_clarification = True
            session_obj["needs_clarification"] = True
            if not _normalized_text(session_obj.get("clarification_prompt")):
                session_obj["clarification_prompt"] = "What issue do you care about most?"
        if yes_select_all and needs_clarification:
            # mapc_pipeline_v3 — remove flag check after rollout confirmed
            session_obj = _force_best_effort_interpretation(session_obj, working_history)
            needs_clarification = False
            confidence = max(0.50, _coerce_float(session_obj.get("confidence"), fallback=0.50))

        clarification_turn_count = prior_clarification_count
        if needs_clarification:
            clarification_turn_count += 1
            if clarification_turn_count >= 2:
                # mapc_pipeline_v3 — remove flag check after rollout confirmed
                session_obj = _force_best_effort_interpretation(session_obj, working_history)
                needs_clarification = False
                confidence = max(0.50, _coerce_float(session_obj.get("confidence"), fallback=0.50))
                clarification_turn_count = 2
        else:
            clarification_turn_count = 0

        session_obj["confidence"] = confidence
        session_obj["needs_clarification"] = needs_clarification
        session_obj["clarification_turn_count"] = clarification_turn_count
        session_obj["intro_shown"] = bool(payload.get("intro_shown", session_obj.get("intro_shown", False)))
        session_obj["mapc_approved"] = bool(payload.get("mapc_approved", session_obj.get("mapc_approved", False)))
        if not needs_clarification:
            session_obj["clarification_prompt"] = None

        if needs_clarification:
            clarification_prompt = _normalized_text(session_obj.get("clarification_prompt")) or "What issue do you care about most?"
            working_history = _append_context_turn(working_history, role="assistant", text=clarification_prompt)
            session_obj["clarification_prompt"] = clarification_prompt

        session_obj["accumulated_context"] = working_history
        session_obj["session_state"] = "issue_received"
        validator_report["checks"].append({
            "name": "confidence_gate",
            "passed": confidence >= 0.50 and not needs_clarification,
            "confidence": confidence,
            "needs_clarification": needs_clarification,
        })
        validator_report["checks"].append({
            "name": "one_word_gate",
            "passed": not (raw_issue_word_count <= 1 and prior_clarification_count == 0 and needs_clarification),
            "raw_issue_word_count": raw_issue_word_count,
            "clarification_turn_count_before": prior_clarification_count,
        })
        validator_report["checks"].append({
            "name": "clarification_turn_limit",
            "passed": clarification_turn_count < 2 or not needs_clarification,
            "clarification_turn_count": clarification_turn_count,
        })
        validator_report["checks"].append({
            "name": "accumulated_context_used",
            "passed": len(working_history) > 0,
            "context_turns": len(working_history),
        })
        with self._lock:
            self._history_by_session[session_id] = deepcopy(working_history)
            self._clarification_count_by_session[session_id] = clarification_turn_count
        self._set_state(session_id, "issue_received")
        response = {
            "session": session_obj,
            "validator_report": validator_report,
        }
        self._cache(stage, session_id, normalized_payload, response)
        self._log_request(stage=stage, session_id=session_id, state_before=current, state_after="issue_received", confidence=confidence, needs_clarification=needs_clarification, validator_report=validator_report)
        _ = user_id  # reserved for future auditing hooks.
        return response

    def ask_options(self, payload: dict[str, Any], user_id: str) -> dict[str, Any]:
        self._require_enabled()
        stage = "ask_options"
        if "concern_text" not in payload:
            raise MAPCPipelineV3Error("missing_concern_text", "concern_text is required.")
        session_obj = _coerce_session_object(payload)
        require_bill_ref = bool(payload.get("require_bill_ref", False))
        normalized_payload = {
            "session": session_obj,
            "require_bill_ref": require_bill_ref,
            "concern_text": _normalized_text(payload.get("concern_text")),
        }
        session_id = _required_session_id(session_obj)
        cached = self._get_cached(stage, session_id, normalized_payload)
        if cached is not None:
            return cached

        with self._lock:
            current = self._state_by_session.get(session_id, "new")
        if current not in {"issue_received", "ask_selected", "background_shown", "preview_shown", "revising"}:
            raise MAPCPipelineV3Error("invalid_state_transition", f"ask-options requires issue_received/ask_selected/background_shown/preview_shown/revising, found {current}.")

        options_payload = self._call_stage_2_llm(session_obj=session_obj, require_bill_ref=require_bill_ref)
        validator_report: dict[str, Any] = {
            "stage": stage,
            "checks": [],
            "timestamp": _utc_iso_now(),
        }

        options = options_payload.get("options")
        if not isinstance(options, list):
            raise MAPCPipelineV3Error("ask_options_parse_error", "ask options response missing options array.")
        passed = self._validate_display_ask_lengths(options)
        validator_report["checks"].append({"name": "display_ask_word_limit", "passed": passed})
        if not passed:
            options_payload = self._call_stage_2_llm(
                session_obj=session_obj,
                require_bill_ref=require_bill_ref,
                extra_user_instruction="Shorten every display_ask to 10 words or fewer.",
            )
            options = options_payload.get("options")
            if not isinstance(options, list) or not self._validate_display_ask_lengths(options):
                raise MAPCPipelineV3Error("display_ask_length_violation", "display_ask exceeds 10 words.")
            validator_report["checks"].append({"name": "display_ask_word_limit_retry", "passed": True})

        options = _dedupe_logically_equivalent_options(options)
        options = _ensure_minimum_distinct_options(options=options, session_obj=session_obj)
        options = _drop_hearing_when_alternatives_exist(options)
        options = _ensure_minimum_distinct_options(options=options, session_obj=session_obj)
        validator_report["checks"].append({
            "name": "logical_option_dedup",
            "passed": len(options) >= 1,
            "remaining_options": len(options),
        })

        for entry in options:
            display = _normalized_text(entry.get("display_ask")).lower()
            if any(phrase in display for phrase in BANNED_ASK_PHRASES):
                raise MAPCPipelineV3Error("banned_phrase_in_option", "ask option contains prohibited phrase.")

        response_session = deepcopy(session_obj)
        response_session["needs_clarification"] = bool(options_payload.get("needs_clarification", False)) or len(options) < 2
        response_session["session_state"] = "ask_selected"
        self._set_state(session_id, "ask_selected")
        response = {
            "session": response_session,
            "options": options,
            "validator_report": validator_report,
        }
        self._cache(stage, session_id, normalized_payload, response)
        self._log_request(stage=stage, session_id=session_id, state_before=current, state_after="ask_selected", confidence=_coerce_float(session_obj.get("confidence"), fallback=0.0), needs_clarification=response_session["needs_clarification"], validator_report=validator_report)
        _ = user_id
        return response

    def background(self, payload: dict[str, Any], user_id: str, generic_retry_hint: str | None = None) -> dict[str, Any]:
        self._require_enabled()
        stage = "background"
        if "concern_text" not in payload:
            raise MAPCPipelineV3Error("missing_concern_text", "concern_text is required.")
        session_obj = _coerce_session_object(payload)
        session_id = _required_session_id(session_obj)
        normalized_payload = {
            "session": session_obj,
            "concern_text": _normalized_text(payload.get("concern_text")),
            "generic_retry_hint": _normalized_text(generic_retry_hint),
        }
        cached = self._get_cached(stage, session_id, normalized_payload)
        if cached is not None:
            return cached

        with self._lock:
            current = self._state_by_session.get(session_id, "new")
        if current not in {"issue_received", "ask_selected", "preview_shown", "revising"}:
            raise MAPCPipelineV3Error("invalid_state_transition", f"background requires issue_received/ask_selected/preview_shown/revising, found {current}.")

        validator_report: dict[str, Any] = {"stage": stage, "checks": [], "timestamp": _utc_iso_now()}
        confidence = _coerce_float(session_obj.get("confidence"), fallback=0.0)
        issue_domain = _normalized_text(session_obj.get("issue_domain"))
        if confidence < 0.50:
            validator_report["checks"].append({"name": "precheck_low_confidence", "passed": False})
            response = {
                "session": deepcopy(session_obj),
                "background_text": None,
                "reason": "low_confidence",
                "validator_report": validator_report,
            }
            self._cache(stage, session_id, normalized_payload, response)
            self._log_request(stage=stage, session_id=session_id, state_before=current, state_after=current, confidence=confidence, needs_clarification=True, validator_report=validator_report)
            return response
        if not issue_domain:
            validator_report["checks"].append({"name": "precheck_missing_domain", "passed": False})
            response = {
                "session": deepcopy(session_obj),
                "background_text": None,
                "reason": "missing_domain",
                "validator_report": validator_report,
            }
            self._cache(stage, session_id, normalized_payload, response)
            self._log_request(stage=stage, session_id=session_id, state_before=current, state_after=current, confidence=confidence, needs_clarification=True, validator_report=validator_report)
            return response

        generated = self._call_stage_3_llm(session_obj=session_obj, extra_user_instruction=generic_retry_hint)
        background_text = _normalized_text(generated.get("background_text"))
        reason = _normalized_text(generated.get("reason")) or None
        if not background_text:
            response = {
                "session": deepcopy(session_obj),
                "background_text": None,
                "reason": reason or "model_returned_null",
                "validator_report": validator_report,
            }
            self._cache(stage, session_id, normalized_payload, response)
            self._log_request(stage=stage, session_id=session_id, state_before=current, state_after=current, confidence=confidence, needs_clarification=True, validator_report=validator_report)
            return response

        topic_ok, topic_report = self._topic_match_report(session_obj=session_obj, background_text=background_text)
        validator_report["checks"].append(topic_report)
        if not topic_ok:
            response = {
                "session": deepcopy(session_obj),
                "background_text": None,
                "reason": "topic_match_failed",
                "validator_report": validator_report,
            }
            self._cache(stage, session_id, normalized_payload, response)
            self._log_request(stage=stage, session_id=session_id, state_before=current, state_after=current, confidence=confidence, needs_clarification=True, validator_report=validator_report)
            return response

        generic_ok, generic_report = self._generic_background_report(session_obj=session_obj, background_text=background_text)
        validator_report["checks"].append(generic_report)
        if not generic_ok:
            response = {
                "session": deepcopy(session_obj),
                "background_text": None,
                "reason": "generic_background_detected",
                "validator_report": validator_report,
            }
            self._cache(stage, session_id, normalized_payload, response)
            self._log_request(stage=stage, session_id=session_id, state_before=current, state_after=current, confidence=confidence, needs_clarification=True, validator_report=validator_report)
            return response

        response_session = deepcopy(session_obj)
        response_session["session_state"] = "background_shown"
        self._set_state(session_id, "background_shown")
        response = {
            "session": response_session,
            "background_text": background_text,
            "reason": None,
            "validator_report": validator_report,
        }
        self._cache(stage, session_id, normalized_payload, response)
        self._log_request(stage=stage, session_id=session_id, state_before=current, state_after="background_shown", confidence=confidence, needs_clarification=False, validator_report=validator_report)
        _ = user_id
        return response

    def script(self, payload: dict[str, Any], user_id: str) -> dict[str, Any]:
        self._require_enabled()
        stage = "script"
        if "concern_text" not in payload:
            raise MAPCPipelineV3Error("missing_concern_text", "concern_text is required.")
        confirmed = bool(payload.get("confirmed", False))
        if not confirmed:
            raise MAPCPipelineV3Error("preview_not_confirmed", "Script generation requires confirmed=true.")

        session_obj = _coerce_session_object(payload)
        session_id = _required_session_id(session_obj)
        selected_option_id = _normalized_text(payload.get("selected_option_id"))
        if not selected_option_id:
            raise MAPCPipelineV3Error("missing_selected_option", "selected_option_id is required.")
        options = payload.get("options")
        if not isinstance(options, list):
            raise MAPCPipelineV3Error("missing_options", "options array is required.")

        normalized_payload = {
            "session": session_obj,
            "selected_option_id": selected_option_id,
            "confirmed": confirmed,
            "concern_text": _normalized_text(payload.get("concern_text")),
            "options": options,
        }
        cached = self._get_cached(stage, session_id, normalized_payload)
        if cached is not None:
            return cached

        with self._lock:
            current = self._state_by_session.get(session_id, "new")
        if current not in {"ask_selected", "background_shown", "preview_shown", "revising"}:
            raise MAPCPipelineV3Error("invalid_state_transition", f"script requires ask_selected/background_shown/preview_shown/revising, found {current}.")

        selected_option = self._selected_option(options=options, selected_option_id=selected_option_id)
        if selected_option is None:
            raise MAPCPipelineV3Error("invalid_selected_option", "selected_option_id was not found in options.")
        working_session = deepcopy(session_obj)
        working_session["ask_type"] = _normalized_text(selected_option.get("ask_type")) or working_session.get("ask_type")
        working_session["display_ask"] = _normalized_text(selected_option.get("display_ask")) or working_session.get("display_ask")
        self._set_state(session_id, "preview_shown")

        validator_report: dict[str, Any] = {"stage": stage, "checks": [], "timestamp": _utc_iso_now()}
        script_payload = self._call_stage_4_llm(session_obj=working_session, selected_option=selected_option)
        live_script = _normalized_text(script_payload.get("live_script"))
        voicemail_script = _normalized_text(script_payload.get("voicemail_script"))
        if not live_script or not voicemail_script:
            raise MAPCPipelineV3Error("script_parse_error", "script stage returned empty live/voicemail content.")

        live_script, voicemail_script = self._run_script_validators(
            session_obj=working_session,
            selected_option=selected_option,
            live_script=live_script,
            voicemail_script=voicemail_script,
            validator_report=validator_report,
        )

        response_session = deepcopy(working_session)
        response_session["session_state"] = "script_shown"
        self._set_state(session_id, "script_shown")
        response = {
            "session": response_session,
            "live_script": live_script,
            "voicemail_script": voicemail_script,
            "validator_report": validator_report,
        }
        self._cache(stage, session_id, normalized_payload, response)
        self._log_request(stage=stage, session_id=session_id, state_before=current, state_after="script_shown", confidence=_coerce_float(working_session.get("confidence"), fallback=0.0), needs_clarification=bool(working_session.get("needs_clarification")), validator_report=validator_report)
        _ = user_id
        return response

    def revise(self, payload: dict[str, Any], user_id: str) -> dict[str, Any]:
        self._require_enabled()
        action = _normalized_text(payload.get("action")).lower()
        if not action:
            raise MAPCPipelineV3Error("missing_revision_action", "action is required.")
        session_obj = _coerce_session_object(payload)
        session_id = _required_session_id(session_obj)
        with self._lock:
            current = self._state_by_session.get(session_id, "new")
        self._set_state(session_id, "revising")

        normalized_action = action.replace(" ", "_")
        if normalized_action == "too_generic":
            return self.background(payload={"session": session_obj, "concern_text": payload.get("concern_text")}, user_id=user_id, generic_retry_hint="The previous background was too generic. Write a paragraph that is highly specific to this issue_domain and target_problem.")
        if normalized_action == "wrong_issue":
            # mapc_pipeline_v3 — remove flag check after rollout confirmed
            with self._lock:
                self._history_by_session[session_id] = []
                self._clarification_count_by_session[session_id] = 0
            reset = _blank_session(session_id=session_id)
            self._set_state(session_id, "new")
            return {"session": reset, "prompt": "Please restate the issue in one sentence."}
        if normalized_action == "wrong_stance":
            flipped = deepcopy(session_obj)
            flipped["stance"] = "oppose" if _normalized_text(flipped.get("stance")).lower() == "support" else "support"
            self._set_state(session_id, "preview_shown")
            return self.script(
                payload={
                    "session": flipped,
                    "options": payload.get("options", []),
                    "selected_option_id": payload.get("selected_option_id"),
                    "confirmed": True,
                    "concern_text": payload.get("concern_text"),
                },
                user_id=user_id,
            )
        if normalized_action == "too_broad":
            updated = deepcopy(session_obj)
            updated["needs_clarification"] = True
            updated["clarification_prompt"] = _normalized_text(updated.get("clarification_prompt")) or "What issue do you care about most?"
            updated["session_state"] = "issue_received"
            self._set_state(session_id, "issue_received")
            return {"session": updated, "clarification_prompt": updated["clarification_prompt"]}
        if normalized_action == "needs_local_angle":
            localized = deepcopy(session_obj)
            localized["geographic_relevance"] = "constituent_district"
            self._set_state(session_id, "preview_shown")
            return self.script(
                payload={
                    "session": localized,
                    "options": payload.get("options", []),
                    "selected_option_id": payload.get("selected_option_id"),
                    "confirmed": True,
                    "concern_text": payload.get("concern_text"),
                },
                user_id=user_id,
            )
        if normalized_action == "needs_a_bill":
            self._set_state(session_id, "background_shown")
            return self.ask_options(
                payload={
                    "session": session_obj,
                    "require_bill_ref": True,
                    "concern_text": payload.get("concern_text"),
                },
                user_id=user_id,
            )
        if normalized_action == "start_over":
            # mapc_pipeline_v3 — remove flag check after rollout confirmed
            with self._lock:
                self._history_by_session[session_id] = []
                self._clarification_count_by_session[session_id] = 0
            reset = _blank_session(session_id=session_id)
            self._set_state(session_id, "new")
            return {"session": reset}
        if normalized_action == "something_else":
            text = _normalized_text(payload.get("free_text"))
            if not text:
                raise MAPCPipelineV3Error("missing_free_text", "free_text is required for something_else.")
            # mapc_pipeline_v3 — remove flag check after rollout confirmed
            with self._lock:
                self._history_by_session[session_id] = []
                self._clarification_count_by_session[session_id] = 0
            self._set_state(session_id, "new")
            return self.interpret(
                payload={
                    "session_id": session_id,
                    "raw_user_issue": text,
                    "concern_text": text,
                    "session_state": "new",
                    "user_zip": session_obj.get("user_zip"),
                },
                user_id=user_id,
            )

        raise MAPCPipelineV3Error("unknown_revision_action", f"unsupported action: {action}")

    def _run_script_validators(
        self,
        *,
        session_obj: dict[str, Any],
        selected_option: dict[str, Any],
        live_script: str,
        voicemail_script: str,
        validator_report: dict[str, Any],
    ) -> tuple[str, str]:
        scripts = {"live_script": live_script, "voicemail_script": voicemail_script}

        def rerun(extra_instruction: str) -> dict[str, Any]:
            return self._call_stage_4_llm(session_obj=session_obj, selected_option=selected_option, extra_user_instruction=extra_instruction)

        expected_stance = _normalized_text(session_obj.get("stance")).lower()
        stance_ok, detected = _stance_aligned(scripts["live_script"], expected_stance)
        validator_report["checks"].append({"name": "stance_consistency", "passed": stance_ok, "detected_verb": detected, "expected_stance": expected_stance})
        if not stance_ok:
            retried = rerun("Align the ask verb with the session stance exactly.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            stance_ok, detected = _stance_aligned(scripts["live_script"], expected_stance)
            validator_report["checks"].append({"name": "stance_consistency_retry", "passed": stance_ok, "detected_verb": detected})
            if not stance_ok:
                raise MAPCPipelineV3Error("stance_mismatch", "script ask verb did not align with stance.")

        verbatim_ok, offending_source = _verbatim_ok(
            scripts["live_script"],
            _normalized_text(session_obj.get("raw_user_issue")),
            _normalized_text(session_obj.get("constraints_from_user")),
        )
        validator_report["checks"].append({"name": "verbatim_paste", "passed": verbatim_ok, "source": offending_source})
        if not verbatim_ok:
            retried = rerun("Do not copy user text verbatim. Synthesize fresh spoken language.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            verbatim_ok, offending_source = _verbatim_ok(
                scripts["live_script"],
                _normalized_text(session_obj.get("raw_user_issue")),
                _normalized_text(session_obj.get("constraints_from_user")),
            )
            validator_report["checks"].append({"name": "verbatim_paste_retry", "passed": verbatim_ok, "source": offending_source})
            if not verbatim_ok:
                raise MAPCPipelineV3Error("verbatim_paste_detected", "verbatim phrase remained after retry.")

        leak_ok_live, leaked_live = _placeholder_leak_ok(scripts["live_script"])
        leak_ok_vm, leaked_vm = _placeholder_leak_ok(scripts["voicemail_script"])
        leak_ok = leak_ok_live and leak_ok_vm
        leaked = leaked_live if not leak_ok_live else leaked_vm
        validator_report["checks"].append({"name": "placeholder_leak", "passed": leak_ok, "token": leaked})
        if not leak_ok:
            retried = rerun("Remove all template markers. [ZIP] is the only allowed bracket token.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            leak_ok_live, leaked_live = _placeholder_leak_ok(scripts["live_script"])
            leak_ok_vm, leaked_vm = _placeholder_leak_ok(scripts["voicemail_script"])
            leak_ok = leak_ok_live and leak_ok_vm
            leaked = leaked_live if not leak_ok_live else leaked_vm
            validator_report["checks"].append({"name": "placeholder_leak_retry", "passed": leak_ok, "token": leaked})
            if not leak_ok:
                # mapc_pipeline_v3 — remove flag check after rollout confirmed
                # Deterministic final cleanup for known leaked template tokens.
                scripts["live_script"] = _sanitize_disallowed_placeholders(scripts["live_script"])
                scripts["voicemail_script"] = _sanitize_disallowed_placeholders(scripts["voicemail_script"])
                leak_ok_live, leaked_live = _placeholder_leak_ok(scripts["live_script"])
                leak_ok_vm, leaked_vm = _placeholder_leak_ok(scripts["voicemail_script"])
                leak_ok = leak_ok_live and leak_ok_vm
                leaked = leaked_live if not leak_ok_live else leaked_vm
                validator_report["checks"].append({"name": "placeholder_leak_sanitized", "passed": leak_ok, "token": leaked})
            if not leak_ok:
                raise MAPCPipelineV3Error("placeholder_leak", f"disallowed token remained: {leaked}")

        zip_ok_live, zip_issue_live = _zip_context_ok(scripts["live_script"])
        zip_ok_vm, zip_issue_vm = _zip_context_ok(scripts["voicemail_script"])
        zip_ok = zip_ok_live and zip_ok_vm
        zip_issue = zip_issue_live if not zip_ok_live else zip_issue_vm
        validator_report["checks"].append({"name": "zip_location_context", "passed": zip_ok, "issue": zip_issue})
        if not zip_ok:
            retried = rerun("Use [ZIP] only in location phrases like 'I'm calling from [ZIP]'. Never write 'my name is [ZIP]'.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            zip_ok_live, zip_issue_live = _zip_context_ok(scripts["live_script"])
            zip_ok_vm, zip_issue_vm = _zip_context_ok(scripts["voicemail_script"])
            zip_ok = zip_ok_live and zip_ok_vm
            zip_issue = zip_issue_live if not zip_ok_live else zip_issue_vm
            validator_report["checks"].append({"name": "zip_location_context_retry", "passed": zip_ok, "issue": zip_issue})
            if not zip_ok:
                raise MAPCPipelineV3Error("zip_context_invalid", f"invalid [ZIP] usage: {zip_issue}")

        deduped_live, duplicate_found = _dedupe_repeated_phrase(scripts["live_script"])
        validator_report["checks"].append({"name": "duplicate_phrase", "passed": not duplicate_found})
        scripts["live_script"] = deduped_live
        if duplicate_found:
            retried = rerun("Avoid repeating any phrase of six or more words.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            _, duplicate_found_retry = _dedupe_repeated_phrase(scripts["live_script"])
            validator_report["checks"].append({"name": "duplicate_phrase_retry", "passed": not duplicate_found_retry})
            if duplicate_found_retry:
                raise MAPCPipelineV3Error("duplicate_phrase", "duplicate phrase remained after retry.")

        malformed_ok = not _is_malformed_ask(scripts["live_script"]) and not _is_malformed_ask(scripts["voicemail_script"])
        validator_report["checks"].append({"name": "malformed_ask", "passed": malformed_ok})
        if not malformed_ok:
            repaired = self._call_stage_1_llm({
                "session_id": _required_session_id(session_obj),
                "raw_user_issue": _normalized_text(session_obj.get("raw_user_issue")),
                "concern_text": _normalized_text(session_obj.get("raw_user_issue")),
                "session_state": "new",
                "user_zip": session_obj.get("user_zip"),
            })
            session_obj["normalized_issue"] = repaired.get("normalized_issue", session_obj.get("normalized_issue"))
            retried = rerun("Rewrite ask sentence to avoid double prepositions or recursive stacking.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            malformed_ok = not _is_malformed_ask(scripts["live_script"])
            validator_report["checks"].append({"name": "malformed_ask_retry", "passed": malformed_ok})
            if not malformed_ok:
                raise MAPCPipelineV3Error("malformed_ask", "malformed ask remained after retry.")

        live_wc = _word_count(scripts["live_script"])
        vm_wc = _word_count(scripts["voicemail_script"])
        in_range = 43 <= live_wc <= 97 and 43 <= vm_wc <= 97
        validator_report["checks"].append({"name": "word_count", "passed": in_range, "live_words": live_wc, "voicemail_words": vm_wc})
        if not in_range:
            retried = rerun("Ensure each script is between 43 and 97 words.")
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            live_wc = _word_count(scripts["live_script"])
            vm_wc = _word_count(scripts["voicemail_script"])
            in_range = 43 <= live_wc <= 97 and 43 <= vm_wc <= 97
            validator_report["checks"].append({"name": "word_count_retry", "passed": in_range, "live_words": live_wc, "voicemail_words": vm_wc})
            if not in_range:
                raise MAPCPipelineV3Error("word_count_out_of_range", "script word count remained out of range after retry.")

        universal_ok, universal_reason = _universal_mapc_script_lint_ok(
            live_script=scripts["live_script"],
            voicemail_script=scripts["voicemail_script"],
            raw_user_issue=_normalized_text(session_obj.get("raw_user_issue")),
        )
        validator_report["checks"].append({
            "name": "universal_script_lint",
            "passed": universal_ok,
            "reason": universal_reason,
        })
        if not universal_ok:
            retried = rerun(
                "Apply strict MAPC script lint. Remove placeholders except [ZIP]. Keep [ZIP] only in a location phrase. "
                "Do not write 'support this issue' or 'oppose this issue'. Avoid malformed asks. "
                "Use one concrete ask action verb (support, oppose, vote yes, vote no, fund, investigate, require reporting, "
                "back protections, restrict funding, or issue a public statement). "
                "Close by asking the office's position, the member's next step, or whether the office will support the action. "
                "Do not copy raw user wording verbatim."
            )
            scripts = {k: _normalized_text(retried.get(k)) for k in scripts}
            universal_ok, universal_reason = _universal_mapc_script_lint_ok(
                live_script=scripts["live_script"],
                voicemail_script=scripts["voicemail_script"],
                raw_user_issue=_normalized_text(session_obj.get("raw_user_issue")),
            )
            validator_report["checks"].append({
                "name": "universal_script_lint_retry",
                "passed": universal_ok,
                "reason": universal_reason,
            })
            if not universal_ok:
                raise MAPCPipelineV3Error("universal_script_lint_failed", f"script lint failed: {universal_reason}")

        return scripts["live_script"], scripts["voicemail_script"]

    def _call_stage_1_llm(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw_issue = _normalized_text(payload.get("raw_user_issue"))
        if not self._api_key:
            return _offline_interpret(payload)
        model_payload = {
            "model": self._model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": INTERPRETER_PROMPT},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
        }
        parsed = self._chat_json(model_payload, parse_reason_code="interpreter_parse_error")
        if not isinstance(parsed, dict):
            raise MAPCPipelineV3Error("interpreter_parse_error", "Interpreter response was not a JSON object.")
        parsed.setdefault("raw_user_issue", raw_issue)
        parsed.setdefault("session_id", payload.get("session_id") or str(uuid.uuid4()))
        parsed.setdefault("user_zip", payload.get("user_zip"))
        parsed.setdefault("accumulated_context", payload.get("accumulated_context", []))
        parsed.setdefault("intro_shown", bool(payload.get("intro_shown", False)))
        parsed.setdefault("clarification_turn_count", int(payload.get("clarification_turn_count", 0) or 0))
        parsed.setdefault("mapc_approved", bool(payload.get("mapc_approved", False)))
        return _sanitize_session(parsed)

    def _call_stage_2_llm(
        self,
        *,
        session_obj: dict[str, Any],
        require_bill_ref: bool,
        extra_user_instruction: str | None = None,
    ) -> dict[str, Any]:
        if not self._api_key:
            return _offline_ask_options(session_obj=session_obj, require_bill_ref=require_bill_ref)
        messages = [
            {"role": "system", "content": ASK_SELECTOR_PROMPT},
            {"role": "user", "content": json.dumps({"session": session_obj, "require_bill_ref": require_bill_ref}, ensure_ascii=False)},
        ]
        if _normalized_text(extra_user_instruction):
            messages.append({"role": "user", "content": _normalized_text(extra_user_instruction)})
        model_payload = {
            "model": self._model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }
        parsed = self._chat_json(model_payload, parse_reason_code="ask_options_parse_error")
        if not isinstance(parsed, dict):
            raise MAPCPipelineV3Error("ask_options_parse_error", "Ask selector response was not a JSON object.")
        return parsed

    def _call_stage_3_llm(self, *, session_obj: dict[str, Any], extra_user_instruction: str | None = None) -> dict[str, Any]:
        if not self._api_key:
            return _offline_background(session_obj=session_obj)
        messages = [
            {"role": "system", "content": BACKGROUND_WRITER_PROMPT},
            {"role": "user", "content": json.dumps({"session": session_obj}, ensure_ascii=False)},
        ]
        if _normalized_text(extra_user_instruction):
            messages.append({"role": "user", "content": _normalized_text(extra_user_instruction)})
        model_payload = {
            "model": self._model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }
        parsed = self._chat_json(model_payload, parse_reason_code="background_parse_error")
        if not isinstance(parsed, dict):
            raise MAPCPipelineV3Error("background_parse_error", "Background writer response was not a JSON object.")
        return parsed

    def _call_stage_4_llm(
        self,
        *,
        session_obj: dict[str, Any],
        selected_option: dict[str, Any],
        extra_user_instruction: str | None = None,
    ) -> dict[str, Any]:
        if not self._api_key:
            return _offline_script(session_obj=session_obj, selected_option=selected_option)
        messages = [
            {"role": "system", "content": SCRIPT_WRITER_PROMPT},
            {"role": "user", "content": json.dumps({"session": session_obj, "selected_option": selected_option}, ensure_ascii=False)},
        ]
        if _normalized_text(extra_user_instruction):
            messages.append({"role": "user", "content": _normalized_text(extra_user_instruction)})
        model_payload = {
            "model": self._model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": messages,
        }
        parsed = self._chat_json(model_payload, parse_reason_code="script_parse_error")
        if not isinstance(parsed, dict):
            raise MAPCPipelineV3Error("script_parse_error", "Script writer response was not a JSON object.")
        return parsed

    def _chat_json(self, payload: dict[str, Any], parse_reason_code: str) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            url=f"{self._base_url}/v1/chat/completions",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urlrequest.urlopen(req, timeout=self._timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except urlerror.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise MAPCPipelineV3Error("llm_http_error", f"OpenAI HTTP {exc.code}: {detail[:400]}") from exc
        except Exception as exc:
            raise MAPCPipelineV3Error("llm_transport_error", f"OpenAI request failed: {type(exc).__name__}") from exc

        decoded = _parse_possible_json(raw)
        if not isinstance(decoded, dict):
            raise MAPCPipelineV3Error(parse_reason_code, "LLM response was not valid JSON.")

        message = ((decoded.get("choices") or [{}])[0] or {}).get("message") or {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise MAPCPipelineV3Error(parse_reason_code, "LLM returned empty message content.")
        parsed = _parse_possible_json(content)
        if not isinstance(parsed, dict):
            raise MAPCPipelineV3Error(parse_reason_code, "LLM content was not valid JSON object.")
        return parsed

    def _topic_match_report(self, *, session_obj: dict[str, Any], background_text: str) -> tuple[bool, dict[str, Any]]:
        noun_candidates = _extract_key_tokens(" ".join([
            _normalized_text(session_obj.get("normalized_issue")),
            _normalized_text(session_obj.get("issue_domain")),
        ]))
        background_stems = {_stem(token) for token in _extract_key_tokens(background_text)}
        matched = [token for token in noun_candidates if _stem(token) in background_stems]
        report = {
            "name": "topic_match",
            "passed": len(matched) >= 2,
            "nouns_checked": noun_candidates,
            "matched_count": len(matched),
            "background_fingerprint": _fingerprint(background_text),
        }
        return len(matched) >= 2, report

    def _generic_background_report(self, *, session_obj: dict[str, Any], background_text: str) -> tuple[bool, dict[str, Any]]:
        lowered = background_text.lower()
        issue_domain = _normalized_text(session_obj.get("issue_domain")).lower()
        has_generic_pattern = (
            "congress" in lowered
            and ("timeline" in lowered or "timelines" in lowered)
            and ("tradeoff" in lowered or "tradeoffs" in lowered)
            and ("costs to families" in lowered or "family costs" in lowered)
        )
        missing_domain_anchor = not issue_domain or issue_domain not in lowered
        passed = not (has_generic_pattern and missing_domain_anchor)
        report = {
            "name": "generic_background",
            "passed": passed,
            "specificity_score": _specificity_score(background_text, issue_domain),
            "pattern_detected": has_generic_pattern,
        }
        return passed, report

    def _validate_display_ask_lengths(self, options: list[dict[str, Any]]) -> bool:
        for option in options:
            display = _normalized_text(option.get("display_ask"))
            if _word_count(display) > 10:
                return False
        return True

    def _selected_option(self, *, options: list[Any], selected_option_id: str) -> dict[str, Any] | None:
        target = selected_option_id.strip().lower()
        for candidate in options:
            if not isinstance(candidate, dict):
                continue
            option_id = _normalized_text(candidate.get("option_id")).lower()
            if option_id == target:
                return candidate
        return None

    def _normalize_interpret_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw_user_issue = _required_text(payload.get("raw_user_issue"), field="raw_user_issue")
        session_id = _normalized_text(payload.get("session_id")) or str(uuid.uuid4())
        session_state = _normalized_text(payload.get("session_state")) or "new"
        if session_state not in {"new", "issue_received", "revising"}:
            raise MAPCPipelineV3Error("invalid_initial_state", "interpret requires session_state in {new, issue_received, revising}.")
        concern_text = _normalized_text(payload.get("concern_text")) or raw_user_issue
        return {
            "session_id": session_id,
            "raw_user_issue": raw_user_issue,
            "concern_text": concern_text,
            "session_state": session_state,
            "user_zip": _normalized_text(payload.get("user_zip")) or None,
            "accumulated_context": _coerce_context_turns(payload.get("accumulated_context")),
            "clarification_turn_count": _coerce_non_negative_int(payload.get("clarification_turn_count"), fallback=0),
            "intro_shown": bool(payload.get("intro_shown", False)),
            "mapc_approved": bool(payload.get("mapc_approved", False)),
        }

    def _set_state(self, session_id: str, next_state: str) -> None:
        with self._lock:
            current = self._state_by_session.get(session_id, "new")
            if current == next_state:
                return
            allowed = STATE_TRANSITIONS.get(current, set())
            if next_state not in allowed:
                raise MAPCPipelineV3Error("invalid_state_transition", f"{current} -> {next_state} is not allowed.")
            self._state_by_session[session_id] = next_state

    def _get_cached(self, stage: str, session_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        cache_key = self._cache_key(stage, session_id, payload)
        with self._lock:
            cached = self._idempotency_cache.get(cache_key)
        return deepcopy(cached) if cached is not None else None

    def _cache(self, stage: str, session_id: str, payload: dict[str, Any], response: dict[str, Any]) -> None:
        cache_key = self._cache_key(stage, session_id, payload)
        with self._lock:
            self._idempotency_cache[cache_key] = deepcopy(response)

    def _cache_key(self, stage: str, session_id: str, payload: dict[str, Any]) -> str:
        serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return f"{stage}:{session_id}:{digest}"

    def _log_request(
        self,
        *,
        stage: str,
        session_id: str,
        state_before: str,
        state_after: str,
        confidence: float,
        needs_clarification: bool,
        validator_report: dict[str, Any],
    ) -> None:
        logger.info(
            "mapc_v3 stage=%s session_id=%s state_before=%s state_after=%s confidence=%.3f needs_clarification=%s validators=%s",
            stage,
            session_id,
            state_before,
            state_after,
            confidence,
            needs_clarification,
            _compact_validator_log(validator_report),
        )

    def _require_enabled(self) -> None:
        if not self.enabled:
            raise MAPCPipelineV3Error("feature_flag_disabled", "mapc_pipeline_v3_enabled is not enabled.")


def _coerce_session_object(payload: dict[str, Any]) -> dict[str, Any]:
    session_obj = payload.get("session")
    if not isinstance(session_obj, dict):
        raise MAPCPipelineV3Error("missing_session_object", "session object is required.")
    return _sanitize_session(session_obj)


def _required_session_id(session_obj: dict[str, Any]) -> str:
    session_id = _normalized_text(session_obj.get("session_id"))
    if not session_id:
        raise MAPCPipelineV3Error("missing_session_id", "session_id is required in session object.")
    return session_id


def _required_text(value: Any, *, field: str) -> str:
    text = _normalized_text(value)
    if not text:
        raise MAPCPipelineV3Error("missing_required_field", f"{field} is required.")
    return text


def _normalized_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip())


def _coerce_float(value: Any, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number < 0.0:
        return 0.0
    if number > 1.0:
        return 1.0
    return number


def _coerce_non_negative_int(value: Any, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return max(0, fallback)
    return max(0, number)


def _utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _word_count(text: str) -> int:
    return len(re.findall(r"\b[\w'\-]+\b", text))


def _fingerprint(text: str) -> str:
    normalized = _normalized_text(text).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _extract_key_tokens(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z\-]{1,}", text.lower())
    filtered = [token for token in tokens if token not in STOPWORDS and len(token) > 2]
    return list(dict.fromkeys(filtered))


def _stem(token: str) -> str:
    value = token.lower().strip()
    for suffix in ("ing", "ed", "es", "s"):
        if value.endswith(suffix) and len(value) - len(suffix) >= 3:
            return value[: -len(suffix)]
    return value


def _specificity_score(text: str, issue_domain: str) -> float:
    tokens = _extract_key_tokens(text)
    if not tokens:
        return 0.0
    domain_tokens = _extract_key_tokens(issue_domain)
    overlap = len({_stem(token) for token in tokens}.intersection({_stem(token) for token in domain_tokens}))
    return overlap / max(1, len(domain_tokens))


def _coerce_context_turns(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    turns: list[dict[str, Any]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        role = _normalized_text(entry.get("role")).lower()
        text = _normalized_text(entry.get("text"))
        turn_value = entry.get("turn")
        try:
            turn_number = int(turn_value)
        except (TypeError, ValueError):
            turn_number = len(turns) + 1
        if role not in {"user", "assistant"} or not text:
            continue
        turns.append({"turn": turn_number, "role": role, "text": text})
    turns = sorted(turns, key=lambda item: item.get("turn", 0))
    normalized_turns: list[dict[str, Any]] = []
    for index, entry in enumerate(turns, start=1):
        normalized_turns.append({"turn": index, "role": entry["role"], "text": entry["text"]})
    return normalized_turns


def _merge_context_turns(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not existing and not incoming:
        return []
    if not existing:
        return _coerce_context_turns(incoming)
    if not incoming:
        return _coerce_context_turns(existing)
    merged = _coerce_context_turns(existing)
    for entry in _coerce_context_turns(incoming):
        if merged and merged[-1]["role"] == entry["role"] and merged[-1]["text"].lower() == entry["text"].lower():
            continue
        merged.append({"turn": len(merged) + 1, "role": entry["role"], "text": entry["text"]})
    return _coerce_context_turns(merged)


def _append_context_turn(history: list[dict[str, Any]], *, role: str, text: str) -> list[dict[str, Any]]:
    normalized_history = _coerce_context_turns(history)
    normalized_text = _normalized_text(text)
    normalized_role = _normalized_text(role).lower()
    if normalized_role not in {"user", "assistant"} or not normalized_text:
        return normalized_history
    if normalized_history and normalized_history[-1]["role"] == normalized_role and normalized_history[-1]["text"].lower() == normalized_text.lower():
        return normalized_history
    normalized_history.append({"turn": len(normalized_history) + 1, "role": normalized_role, "text": normalized_text})
    return normalized_history


def _latest_is_yes_with_prior_choice_question(*, latest_user_text: str, history: list[dict[str, Any]]) -> bool:
    if _normalized_text(latest_user_text).lower() not in AFFIRMATIVE_YES_RESPONSES:
        return False
    normalized_history = _coerce_context_turns(history)
    assistant_turns = [entry for entry in normalized_history if entry.get("role") == "assistant"]
    if not assistant_turns:
        return False
    question = _normalized_text(assistant_turns[-1].get("text", "")).lower()
    if "?" not in question:
        return False
    return (" or " in question) or ("," in question and "which" in question)


def _force_best_effort_interpretation(session_obj: dict[str, Any], history: list[dict[str, Any]]) -> dict[str, Any]:
    working = _sanitize_session(session_obj)
    user_texts = [
        _normalized_text(entry.get("text"))
        for entry in _coerce_context_turns(history)
        if _normalized_text(entry.get("role")).lower() == "user" and _normalized_text(entry.get("text"))
    ]
    synthesized = _normalized_text(" ".join(user_texts[-4:])) or _normalized_text(working.get("raw_user_issue")) or "Federal policy issue"
    if not _normalized_text(working.get("normalized_issue")):
        working["normalized_issue"] = synthesized
    if not _normalized_text(working.get("display_issue")):
        working["display_issue"] = _limit_words(working["normalized_issue"], 15)
    if not _normalized_text(working.get("issue_domain")):
        working["issue_domain"] = "general_policy"
    if not _normalized_text(working.get("target_problem")):
        working["target_problem"] = "User requests federal action on the interpreted issue"
    if not _normalized_text(working.get("congressional_lever")):
        working["congressional_lever"] = "oversight"
    if not _normalized_text(working.get("ask_type")):
        working["ask_type"] = "require_reporting"
    if not _normalized_text(working.get("display_ask")):
        working["display_ask"] = "Require public reporting deadlines"
    working["confidence"] = max(0.50, _coerce_float(working.get("confidence"), fallback=0.50))
    working["needs_clarification"] = False
    working["clarification_prompt"] = None
    return working


def _is_negative_frame(text: str) -> bool:
    lowered = _normalized_text(text).lower()
    return any(phrase in lowered for phrase in ("oppose", "block", "stop", "against", "cut", "cuts", "reduce", "reduction"))


def _is_affirmative_frame(text: str) -> bool:
    lowered = _normalized_text(text).lower()
    return any(phrase in lowered for phrase in ("support", "increase", "fund", "expand", "strengthen", "protect"))


def _option_outcome_signature(option: dict[str, Any]) -> tuple[str, tuple[str, ...]]:
    ask_type = _normalized_text(option.get("ask_type")).lower()
    display = _normalized_text(option.get("display_ask")).lower()
    framing_stopwords = {
        "support", "oppose", "block", "stop", "against", "cut", "cuts", "reduce", "reduction",
        "increase", "fund", "funding", "expand", "strengthen", "protect", "hold", "hearing",
        "request", "public", "position", "review", "oversight",
    }
    nouns = [
        _stem(token)
        for token in _extract_key_tokens(display)
        if token not in framing_stopwords
    ]
    return ask_type, tuple(sorted(set(nouns)))


def _are_options_logically_equivalent(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_signature = _option_outcome_signature(left)
    right_signature = _option_outcome_signature(right)
    if left_signature[0] == right_signature[0]:
        return True
    left_tokens = set(left_signature[1])
    right_tokens = set(right_signature[1])
    if left_tokens and right_tokens and len(left_tokens.intersection(right_tokens)) >= 1:
        return True
    return False


def _preferred_option(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    left_display = _normalized_text(left.get("display_ask"))
    right_display = _normalized_text(right.get("display_ask"))
    left_positive = _is_affirmative_frame(left_display)
    right_positive = _is_affirmative_frame(right_display)
    left_negative = _is_negative_frame(left_display)
    right_negative = _is_negative_frame(right_display)
    if left_positive and right_negative:
        return left
    if right_positive and left_negative:
        return right
    left_conf = _coerce_float(left.get("confidence"), fallback=0.0)
    right_conf = _coerce_float(right.get("confidence"), fallback=0.0)
    return left if left_conf >= right_conf else right


def _dedupe_logically_equivalent_options(options: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_options = [entry for entry in options if isinstance(entry, dict)]
    kept: list[dict[str, Any]] = []
    for candidate in normalized_options:
        replaced = False
        for index, existing in enumerate(kept):
            if _are_options_logically_equivalent(candidate, existing):
                kept[index] = _preferred_option(existing, candidate)
                replaced = True
                break
        if not replaced:
            kept.append(candidate)

    distinct_by_ask_type: list[dict[str, Any]] = []
    seen_ask_types: set[str] = set()
    for option in kept:
        ask_type = _normalized_text(option.get("ask_type")).lower()
        if ask_type in seen_ask_types:
            continue
        seen_ask_types.add(ask_type)
        distinct_by_ask_type.append(option)
    return distinct_by_ask_type


def _is_hearing_option(option: dict[str, Any]) -> bool:
    ask_type = _normalized_text(option.get("ask_type")).lower()
    display = _normalized_text(option.get("display_ask")).lower()
    return ("hearing" in ask_type) or ("hearing" in display)


def _drop_hearing_when_alternatives_exist(options: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = [entry for entry in options if isinstance(entry, dict)]
    non_hearing = [entry for entry in cleaned if not _is_hearing_option(entry)]
    if non_hearing:
        return non_hearing
    return cleaned


def _ensure_minimum_distinct_options(*, options: list[dict[str, Any]], session_obj: dict[str, Any]) -> list[dict[str, Any]]:
    deduped = [entry for entry in options if isinstance(entry, dict)]
    used_ask_types = {_normalized_text(entry.get("ask_type")).lower() for entry in deduped}
    lever = _normalized_text(session_obj.get("congressional_lever")).lower()
    pool: list[dict[str, Any]] = []
    if lever == "foreign_policy_oversight":
        pool = [
            {"option_id": option_id, "ask_type": ask_type, "display_ask": display_ask, "confidence": confidence}
            for option_id, ask_type, display_ask, confidence in FOREIGN_POLICY_OPTION_POOL
        ]
    else:
        pool = [
            {"option_id": option_id, "ask_type": ask_type, "display_ask": display_ask, "confidence": confidence}
            for option_id, ask_type, display_ask, confidence in GENERIC_OPTION_POOL
        ]
    next_index = len(deduped) + 1
    for candidate in pool:
        ask_type = _normalized_text(candidate.get("ask_type")).lower()
        if ask_type in used_ask_types:
            continue
        deduped.append({
            "option_id": f"A{next_index}",
            "ask_type": ask_type,
            "display_ask": _limit_words(_normalized_text(candidate.get("display_ask")), 10),
            "confidence": _coerce_float(candidate.get("confidence"), fallback=0.67),
        })
        used_ask_types.add(ask_type)
        next_index += 1
        if len(deduped) >= 2:
            break
    return deduped[:4]


def _parse_possible_json(raw: str) -> Any:
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


def _sanitize_session(raw: dict[str, Any]) -> dict[str, Any]:
    session = {
        "session_id": _normalized_text(raw.get("session_id")) or str(uuid.uuid4()),
        "raw_user_issue": _normalized_text(raw.get("raw_user_issue")),
        "normalized_issue": _normalized_text(raw.get("normalized_issue")),
        "display_issue": _limit_words(_normalized_text(raw.get("display_issue")), 15),
        "issue_domain": _normalized_text(raw.get("issue_domain")),
        "target_problem": _normalized_text(raw.get("target_problem")),
        "congressional_lever": _normalized_text(raw.get("congressional_lever")),
        "ask_type": _normalized_text(raw.get("ask_type")),
        "display_ask": _limit_words(_normalized_text(raw.get("display_ask")), 10),
        "stance": _normalized_text(raw.get("stance")).lower() or "support",
        "geographic_relevance": _normalized_text(raw.get("geographic_relevance")) or "national",
        "optional_bill_ref": _normalized_text(raw.get("optional_bill_ref")) or None,
        "constraints_from_user": _normalized_text(raw.get("constraints_from_user")) or None,
        "confidence": _coerce_float(raw.get("confidence"), fallback=0.0),
        "needs_clarification": bool(raw.get("needs_clarification", False)),
        "clarification_prompt": _normalized_text(raw.get("clarification_prompt")) or None,
        "spoken_language_notes": _normalized_text(raw.get("spoken_language_notes")) or None,
        "session_state": _normalized_text(raw.get("session_state")) or "new",
        "user_zip": _normalized_text(raw.get("user_zip")) or None,
        "accumulated_context": _coerce_context_turns(raw.get("accumulated_context")),
        "intro_shown": bool(raw.get("intro_shown", False)),
        "clarification_turn_count": _coerce_non_negative_int(raw.get("clarification_turn_count"), fallback=0),
        "mapc_approved": bool(raw.get("mapc_approved", False)),
    }
    if session["stance"] not in {"support", "oppose"}:
        session["stance"] = "support"
    if session["confidence"] <= 0.80:
        session["optional_bill_ref"] = None
    if _word_count(session["display_issue"]) > 15:
        session["display_issue"] = _limit_words(session["display_issue"], 15)
    if _word_count(session["display_ask"]) > 10:
        session["display_ask"] = _limit_words(session["display_ask"], 10)
    return session


def _limit_words(text: str, limit: int) -> str:
    words = text.split()
    if len(words) <= limit:
        return text
    return " ".join(words[:limit])


def _compact_validator_log(report: dict[str, Any]) -> dict[str, Any]:
    checks = report.get("checks")
    if not isinstance(checks, list):
        return {"checks": []}
    return {"checks": [{"name": check.get("name"), "passed": check.get("passed")} for check in checks if isinstance(check, dict)]}


def _stance_aligned(script: str, expected_stance: str) -> tuple[bool, str]:
    lowered = script.lower()
    if "oppose this issue" in lowered:
        return False, "oppose_this_issue"
    if " oppose " in f" {lowered} " or "reject" in lowered or "vote no" in lowered:
        detected = "oppose"
    elif " support " in f" {lowered} " or "back " in lowered or "vote yes" in lowered:
        detected = "support"
    else:
        detected = "unknown"
    if expected_stance not in {"support", "oppose"}:
        return True, detected
    if detected == "unknown":
        return False, detected
    return detected == expected_stance, detected


def _sentence_tokens(text: str) -> list[set[str]]:
    tokens_by_sentence: list[set[str]] = []
    for sentence in re.split(r"[.!?]+", text):
        words = [
            _stem(token)
            for token in re.findall(r"[a-zA-Z][a-zA-Z\-]{1,}", sentence.lower())
            if token not in STOPWORDS
        ]
        if words:
            tokens_by_sentence.append(set(words))
    return tokens_by_sentence


def _verbatim_ok(script: str, raw_user_issue: str, constraints_from_user: str) -> tuple[bool, str | None]:
    script_sets = _sentence_tokens(script)
    source_sets = {
        "raw_user_issue": _sentence_tokens(raw_user_issue),
        "constraints_from_user": _sentence_tokens(constraints_from_user),
    }
    for script_set in script_sets:
        for source_name, source_group in source_sets.items():
            for source_set in source_group:
                if not script_set or not source_set:
                    continue
                overlap = len(script_set.intersection(source_set))
                denom = max(1, len(script_set))
                if overlap / denom >= 0.90:
                    return False, source_name
    return True, None


def _placeholder_leak_ok(script: str) -> tuple[bool, str | None]:
    blocked_explicit_tokens = {
        "[YOUR_NAME]",
        "[Your Name]",
        "[Name]",
        "[REPRESENTATIVE]",
        "[Rep Name]",
        "[Member]",
        "[District]",
        "[State]",
        "[DATE]",
        "[BILL]",
    }
    for token in blocked_explicit_tokens:
        if token.lower() in script.lower():
            return False, token
    for token in re.findall(r"\[[^\]]+\]", script):
        if token != "[ZIP]":
            return False, token
    if re.search(r"[\{\}]|<[^>]*>", script):
        return False, "{}<>"
    for keyword in ("INSERT", "FILL IN", "TBD", "PLACEHOLDER"):
        if re.search(rf"\b{re.escape(keyword)}\b", script, flags=re.IGNORECASE):
            return False, keyword
    return True, None


def _sanitize_disallowed_placeholders(script: str) -> str:
    cleaned = script
    cleaned = re.sub(r"\[(your[_ ]?name|name)\]", "a constituent", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\[(representative|rep name|member)\]", "the office", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\[(district|state|date|bill)\]", "", cleaned, flags=re.IGNORECASE)

    def _strip_unknown_token(match: re.Match[str]) -> str:
        token = match.group(0)
        return token if token == "[ZIP]" else ""

    cleaned = re.sub(r"\[[^\]]+\]", _strip_unknown_token, cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    return cleaned


def _dedupe_repeated_phrase(script: str) -> tuple[str, bool]:
    words = script.split()
    if len(words) < 12:
        return script, False
    seen: dict[tuple[str, ...], int] = {}
    for idx in range(len(words) - 5):
        gram = tuple(word.lower() for word in words[idx : idx + 6])
        if gram in seen:
            phrase = " ".join(words[idx : idx + 6])
            updated = re.sub(re.escape(phrase), "", script, count=1)
            updated = re.sub(r"\s+", " ", updated).strip()
            return updated, True
        seen[gram] = idx
    return script, False


def _is_malformed_ask(script: str) -> bool:
    lowered = script.lower()
    patterns = (
        r"(support|oppose)\s+on\s+.+\s+on\s+(support|oppose)",
        r"\bto\s+support\s+support\b",
        r"\bto\s+oppose\s+oppose\b",
        r"\bsupport on congressional action on support\b",
        r"\boppose\s+stop\b",
        r"\bcalling about i want a mapc on\b",
        r"\bsupport this issue\b",
        r"\boppose this issue\b",
    )
    return any(re.search(pattern, lowered) for pattern in patterns)


def _zip_context_ok(script: str) -> tuple[bool, str | None]:
    lowered = script.lower()
    if re.search(r"my\s+name\s+is\s*\[zip\]", lowered):
        return False, "zip_in_name_context"
    if "[zip]" in lowered:
        location_ok = bool(
            re.search(
                r"(calling from|constituent from|constituent in|from|in)\s*\[zip\]",
                lowered,
            )
        )
        if not location_ok:
            return False, "zip_not_in_location_context"
    return True, None


def _sentence_list(text: str) -> list[str]:
    collapsed = re.sub(r"\s+", " ", _normalized_text(text)).strip()
    if not collapsed:
        return []
    return [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", collapsed) if segment.strip()]


def _contains_concrete_action_verb(text: str) -> bool:
    lowered = _normalized_text(text).lower()
    patterns = (
        r"\bsupport\b",
        r"\boppose\b",
        r"\bvote\s+yes\b",
        r"\bvote\s+no\b",
        r"\bfund(?:ing)?\b",
        r"\binvestigat(?:e|es|ing|ion)\b",
        r"\brequire\s+report(?:ing|s)?\b",
        r"\bback\s+protections?\b",
        r"\brestrict\s+funding\b",
        r"\bissue\s+a\s+public\s+statement\b",
    )
    return any(re.search(pattern, lowered) for pattern in patterns)


def _ask_sentence_has_action(script: str) -> bool:
    sentences = _sentence_list(script)
    if not sentences:
        return False
    for sentence in sentences:
        lowered = sentence.lower()
        if "please" in lowered or "asking" in lowered or "i'm asking" in lowered:
            return _contains_concrete_action_verb(sentence)
    return _contains_concrete_action_verb(sentences[0])


def _close_requests_position_or_next_step(script: str) -> bool:
    sentences = _sentence_list(script)
    if not sentences:
        return False
    close_line = sentences[-1].lower()
    if ("office" in close_line or "member" in close_line) and "position" in close_line:
        return True
    if "next step" in close_line:
        return True
    if re.search(
        r"(whether|will)\s+the\s+office\s+(support|oppose|back|vote|fund|investigate|require|restrict|issue)",
        close_line,
    ):
        return True
    return False


def _normalize_for_verbatim(text: str) -> str:
    lowered = _normalized_text(text).lower()
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _direct_verbatim_copy_detected(script: str, raw_user_issue: str) -> bool:
    raw_norm = _normalize_for_verbatim(raw_user_issue)
    script_norm = _normalize_for_verbatim(script)
    if not raw_norm or not script_norm:
        return False

    raw_words = raw_norm.split()
    if len(raw_words) >= 2 and len(raw_norm) >= 8 and raw_norm in script_norm:
        if script_norm.startswith(raw_norm) or f" about {raw_norm}" in script_norm or f" calling about {raw_norm}" in script_norm:
            return True
        if len(raw_words) >= 5:
            return True
    return False


def _single_script_universal_lint(script: str, raw_user_issue: str) -> tuple[bool, str | None]:
    lowered = _normalized_text(script).lower()
    if not lowered:
        return False, "empty_script"

    blocked_phrases = (
        "my name is [zip]",
        "support this issue",
        "oppose this issue",
        "represents your house district",
        "support on congressional action on support",
        "oppose stop",
        "calling about i want a mapc on",
    )
    for phrase in blocked_phrases:
        if phrase in lowered:
            return False, f"blocked_phrase:{phrase}"

    leak_ok, leaked = _placeholder_leak_ok(script)
    if not leak_ok:
        return False, f"placeholder:{leaked}"

    zip_ok, zip_issue = _zip_context_ok(script)
    if not zip_ok:
        return False, f"zip_context:{zip_issue}"

    if not _ask_sentence_has_action(script):
        return False, "missing_concrete_action_verb"

    if not _close_requests_position_or_next_step(script):
        return False, "missing_close_request"

    if _is_malformed_ask(script):
        return False, "malformed_ask"

    if _direct_verbatim_copy_detected(script, raw_user_issue):
        return False, "direct_verbatim_copy"

    return True, None


def _universal_mapc_script_lint_ok(*, live_script: str, voicemail_script: str, raw_user_issue: str) -> tuple[bool, str | None]:
    live_ok, live_reason = _single_script_universal_lint(live_script, raw_user_issue)
    if not live_ok:
        return False, f"live:{live_reason}"
    vm_ok, vm_reason = _single_script_universal_lint(voicemail_script, raw_user_issue)
    if not vm_ok:
        return False, f"voicemail:{vm_reason}"
    return True, None


def _offline_interpret(payload: dict[str, Any]) -> dict[str, Any]:
    raw_latest = _normalized_text(payload.get("raw_user_issue"))
    context_turns = _coerce_context_turns(payload.get("accumulated_context"))
    user_texts = [
        _normalized_text(entry.get("text"))
        for entry in context_turns
        if _normalized_text(entry.get("role")).lower() == "user" and _normalized_text(entry.get("text"))
    ]
    context_combined = _normalized_text(" ".join(user_texts))
    text = context_combined or raw_latest
    lowered = text.lower()
    session = _blank_session(session_id=_normalized_text(payload.get("session_id")) or str(uuid.uuid4()))
    session["raw_user_issue"] = raw_latest
    session["user_zip"] = payload.get("user_zip")
    session["session_state"] = "issue_received"
    session["constraints_from_user"] = None
    session["accumulated_context"] = _append_context_turn(context_turns, role="user", text=raw_latest)
    session["clarification_turn_count"] = max(0, int(payload.get("clarification_turn_count", 0) or 0))
    session["intro_shown"] = bool(payload.get("intro_shown", False))
    session["mapc_approved"] = bool(payload.get("mapc_approved", False))

    if _latest_is_yes_with_prior_choice_question(
        latest_user_text=raw_latest,
        history=session["accumulated_context"],
    ):
        session.update({
            "normalized_issue": context_combined or "Interpreted from prior clarification context",
            "display_issue": _limit_words(context_combined or "Interpreted issue from prior context", 15),
            "issue_domain": session.get("issue_domain") or "general_policy",
            "target_problem": "User confirmed the listed clarification options",
            "congressional_lever": "oversight",
            "ask_type": "require_reporting",
            "display_ask": "Require public reporting deadlines",
            "stance": "support",
            "geographic_relevance": "national",
            "confidence": 0.50,
            "needs_clarification": False,
            "clarification_prompt": None,
            "spoken_language_notes": "Interpretation synthesized from multiple turns.",
        })
        return session

    if lowered in {"tibet"} or "hong kong" in lowered or "tibet" in lowered:
        session.update({
            "normalized_issue": "Congressional oversight on Tibet human rights protections",
            "display_issue": "Congressional action on Tibet human rights protections",
            "issue_domain": "foreign_policy",
            "target_problem": "Limited accountability tools for human-rights repression",
            "congressional_lever": "foreign_policy_oversight",
            "ask_type": "sanctions_oversight",
            "display_ask": "Strengthen sanctions enforcement",
            "stance": "support",
            "geographic_relevance": "national",
            "confidence": 0.58,
            "needs_clarification": True,
            "clarification_prompt": "What issue do you care about most?",
            "spoken_language_notes": "Congress acts through oversight and sanctions tools, not direct foreign administration.",
        })
        if session["clarification_turn_count"] >= 1:
            session = _force_best_effort_interpretation(session, session["accumulated_context"])
        return session

    if lowered in {"groceries", "cost of living"} or "cost of living" in lowered:
        session.update({
            "normalized_issue": "Federal response to grocery and household cost pressures",
            "display_issue": "Congressional action on grocery and cost-of-living pressures",
            "issue_domain": "consumer_prices",
            "target_problem": "High household prices without a defined federal policy lever",
            "congressional_lever": "oversight",
            "ask_type": "anti_fraud_consumer_protection_enforcement",
            "display_ask": "Investigate food-price manipulation",
            "stance": "support",
            "geographic_relevance": "national",
            "confidence": 0.52,
            "needs_clarification": True,
            "clarification_prompt": "What issue do you care about most?",
            "spoken_language_notes": "Keep terms plain and household-focused.",
        })
        if session["clarification_turn_count"] >= 1:
            session = _force_best_effort_interpretation(session, session["accumulated_context"])
        return session

    if "marriage equality" in lowered:
        session.update({
            "normalized_issue": "Federal protections for marriage equality",
            "display_issue": "Federal protections for marriage equality",
            "issue_domain": "civil_rights",
            "target_problem": "Risk of inconsistent legal protections across jurisdictions",
            "congressional_lever": "legislation",
            "ask_type": "support_protections",
            "display_ask": "Support federal marriage equality protections",
            "stance": "support",
            "geographic_relevance": "national",
            "confidence": 0.91,
            "needs_clarification": False,
            "clarification_prompt": None,
            "spoken_language_notes": "Avoid legal jargon.",
        })
        return session

    if "stop wildfire" in lowered or "wildfire" in lowered:
        session.update({
            "normalized_issue": "Federal wildfire prevention and resilience action",
            "display_issue": "Federal wildfire prevention and resilience action",
            "issue_domain": "wildfire",
            "target_problem": "Escalating wildfire risk and recovery damage",
            "congressional_lever": "funding",
            "ask_type": "increase_funding",
            "display_ask": "Fund wildfire prevention and fuel reduction",
            "stance": "support",
            "geographic_relevance": "state",
            "confidence": 0.86,
            "needs_clarification": False,
            "clarification_prompt": None,
            "spoken_language_notes": "Use active spoken phrasing and avoid acronyms.",
        })
        return session

    if "fema" in lowered and "scam" in lowered:
        session.update({
            "normalized_issue": "Disaster-aid fraud prevention and FEMA oversight",
            "display_issue": "FEMA fraud prevention and disaster-aid protections",
            "issue_domain": "disaster_response",
            "target_problem": "Fraud risk undermining disaster aid delivery",
            "congressional_lever": "oversight",
            "ask_type": "hold_hearing",
            "display_ask": "Investigate FEMA fraud controls",
            "stance": "support",
            "geographic_relevance": "national",
            "confidence": 0.84,
            "needs_clarification": False,
            "clarification_prompt": None,
            "spoken_language_notes": "Focus on accountability and consumer protection.",
        })
        return session

    short = _word_count(text) <= 1
    if short:
        session.update({
            "normalized_issue": text or "Federal policy issue",
            "display_issue": text or "Federal policy issue",
            "issue_domain": "",
            "target_problem": "",
            "congressional_lever": "",
            "ask_type": "",
            "display_ask": "",
            "stance": "support",
            "geographic_relevance": "national",
            "confidence": 0.40,
            "needs_clarification": True,
            "clarification_prompt": "What issue do you care about most?",
            "spoken_language_notes": None,
        })
        if session["clarification_turn_count"] >= 1:
            session = _force_best_effort_interpretation(session, session["accumulated_context"])
        return session

    session.update({
        "normalized_issue": text,
        "display_issue": _limit_words(text, 15),
        "issue_domain": "general_policy",
        "target_problem": "User seeks congressional action on the stated issue",
        "congressional_lever": "oversight",
        "ask_type": "require_reporting",
        "display_ask": "Require public reporting deadlines",
        "stance": "support",
        "geographic_relevance": "national",
        "confidence": 0.72,
        "needs_clarification": False,
        "clarification_prompt": None,
        "spoken_language_notes": "Use plain spoken language.",
    })
    return session


def _offline_ask_options(*, session_obj: dict[str, Any], require_bill_ref: bool) -> dict[str, Any]:
    lever = _normalized_text(session_obj.get("congressional_lever")).lower()
    confidence = _coerce_float(session_obj.get("confidence"), fallback=0.0)
    if lever == "foreign_policy_oversight":
        if confidence < 0.50:
            return {
                "session_id": session_obj.get("session_id"),
                "options": [{
                    "option_id": "A1",
                    "ask_type": "sanctions_oversight",
                    "display_ask": "Strengthen sanctions enforcement",
                    "confidence": 0.68,
                }],
                "needs_clarification": True,
                "session_state": "ask_selected",
            }
        return {
            "session_id": session_obj.get("session_id"),
            "options": [
                {"option_id": "A1", "ask_type": "sanctions_oversight", "display_ask": "Strengthen sanctions enforcement", "confidence": 0.82},
                {"option_id": "A2", "ask_type": "export_control_review", "display_ask": "Tighten export-control enforcement", "confidence": 0.79},
            ],
            "needs_clarification": False,
            "session_state": "ask_selected",
        }

    options: list[dict[str, Any]] = []
    for option_id, ask_type, display_ask, opt_conf in GENERIC_OPTION_POOL:
        if require_bill_ref and ask_type == "increase_funding" and _coerce_float(session_obj.get("confidence"), fallback=0.0) <= 0.80:
            continue
        options.append({
            "option_id": option_id,
            "ask_type": ask_type,
            "display_ask": display_ask,
            "confidence": opt_conf,
        })
    return {
        "session_id": session_obj.get("session_id"),
        "options": options[:4] if len(options) >= 2 else options[:1],
        "needs_clarification": len(options) < 2,
        "session_state": "ask_selected",
    }


def _offline_background(*, session_obj: dict[str, Any]) -> dict[str, Any]:
    confidence = _coerce_float(session_obj.get("confidence"), fallback=0.0)
    if confidence < 0.50:
        return {"background_text": None, "reason": "low_confidence"}
    issue_domain = _normalized_text(session_obj.get("issue_domain"))
    normalized_issue = _normalized_text(session_obj.get("normalized_issue"))
    target_problem = _normalized_text(session_obj.get("target_problem"))
    if not issue_domain:
        return {"background_text": None, "reason": "missing_domain"}
    if not target_problem:
        return {"background_text": None, "reason": "missing_target_problem"}
    background = (
        f"This issue centers on {normalized_issue.lower() or issue_domain.replace('_', ' ')}. "
        f"It sits in {issue_domain.replace('_', ' ')} policy and focuses on {target_problem.lower()}. "
        "The office can push reporting mandates, enforcement checks, and targeted appropriations to drive execution. "
        "A specific ask helps offices take a position quickly and route it to the right staff. "
        "Clear accountability steps make follow-up measurable for constituents."
    )
    return {"background_text": background}


def _offline_script(*, session_obj: dict[str, Any], selected_option: dict[str, Any]) -> dict[str, Any]:
    issue = _normalized_text(session_obj.get("display_issue")) or "this issue"
    ask = _normalized_text(selected_option.get("display_ask")) or _normalized_text(session_obj.get("display_ask")) or "take action"
    live = (
        f"Hi, I’m a constituent from [ZIP]. I’m calling about {issue.lower()}. "
        f"Please {ask.lower()}. This step would address a concrete public harm and improve accountability. "
        "Families need timely action, not delay. Will the office support this action this session and share its position?"
    )
    voicemail = (
        f"Hi, I’m a constituent from [ZIP] calling about {issue.lower()}. "
        f"Please {ask.lower()}. This action would improve accountability and protect affected families. "
        "Please share whether the office supports this action and what step comes next."
    )
    live = _pad_to_min_words(live, minimum=43)
    voicemail = _pad_to_min_words(voicemail, minimum=43)
    return {
        "live_script": live,
        "voicemail_script": voicemail,
        "session_state": "script_shown",
    }


def _blank_session(*, session_id: str) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "raw_user_issue": "",
        "normalized_issue": "",
        "display_issue": "",
        "issue_domain": "",
        "target_problem": "",
        "congressional_lever": "",
        "ask_type": "",
        "display_ask": "",
        "stance": "support",
        "geographic_relevance": "national",
        "optional_bill_ref": None,
        "constraints_from_user": None,
        "confidence": 0.0,
        "needs_clarification": False,
        "clarification_prompt": None,
        "spoken_language_notes": None,
        "session_state": "new",
        "user_zip": None,
        "accumulated_context": [],
        "intro_shown": False,
        "clarification_turn_count": 0,
        "mapc_approved": False,
    }


def _env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _pad_to_min_words(text: str, minimum: int) -> str:
    if _word_count(text) >= minimum:
        return text
    suffix = " This action has immediate local impact and should be addressed now."
    padded = (text + suffix).strip()
    if _word_count(padded) >= minimum:
        return padded
    while _word_count(padded) < minimum:
        padded += " Please share the office position."
    return padded
