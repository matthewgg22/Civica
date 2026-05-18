from __future__ import annotations

import functools
import json
import logging
import math
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from html import escape
from typing import Any, Callable
from urllib.parse import urlencode
import urllib.error
import urllib.request

from .models import (
    Ask,
    AssistantResolveRequest,
    CallCompletionRequest,
    CallLaunchRequest,
    CallLogRequest,
    CallOutcome,
    IssueBriefRequest,
    IssueClassifyRequest,
    LeaderboardPeriodType,
    RepContext,
    RepTarget,
    ScriptChatTurnRequest,
    ScriptPackageFeedbackRequest,
    ScriptPackageRequest,
)
from .issue_brief_service import IssueBriefService
from .mapc_pipeline_v3 import MAPCPipelineV3Error, MAPCPipelineV3Service
from .repository import CivicRepository, InMemoryCivicRepository, SupabaseCivicRepository
from .script_package_service import ScriptPackageService
from .service import CivicService

logger = logging.getLogger(__name__)

try:
    _AUTH_VERIFICATION_CACHE_TTL_SECONDS = max(
        0, int(os.environ.get("SUPABASE_AUTH_VERIFY_CACHE_TTL_SECONDS", "60"))
    )
except ValueError:
    _AUTH_VERIFICATION_CACHE_TTL_SECONDS = 60

try:
    _AUTH_VERIFICATION_CACHE_MAX_ENTRIES = max(
        1, int(os.environ.get("SUPABASE_AUTH_VERIFY_CACHE_MAX_ENTRIES", "2048"))
    )
except ValueError:
    _AUTH_VERIFICATION_CACHE_MAX_ENTRIES = 2048

_auth_verification_cache_lock = threading.Lock()
_auth_verification_cache: dict[str, tuple[float, str]] = {}


def _auth_cache_get(access_token: str) -> str | None:
    if _AUTH_VERIFICATION_CACHE_TTL_SECONDS <= 0:
        return None
    now = time.monotonic()
    with _auth_verification_cache_lock:
        entry = _auth_verification_cache.get(access_token)
        if entry is None:
            return None
        expires_at, user_id = entry
        if expires_at <= now:
            _auth_verification_cache.pop(access_token, None)
            return None
        return user_id


def _auth_cache_set(access_token: str, user_id: str) -> None:
    if _AUTH_VERIFICATION_CACHE_TTL_SECONDS <= 0:
        return
    now = time.monotonic()
    expires_at = now + _AUTH_VERIFICATION_CACHE_TTL_SECONDS
    with _auth_verification_cache_lock:
        # Trim expired entries opportunistically.
        expired_keys = [k for k, (exp, _) in _auth_verification_cache.items() if exp <= now]
        for key in expired_keys:
            _auth_verification_cache.pop(key, None)

        if (
            access_token not in _auth_verification_cache
            and len(_auth_verification_cache) >= _AUTH_VERIFICATION_CACHE_MAX_ENTRIES
        ):
            oldest_key = next(iter(_auth_verification_cache), None)
            if oldest_key is not None:
                _auth_verification_cache.pop(oldest_key, None)

        _auth_verification_cache[access_token] = (expires_at, user_id)


def _auth_cache_delete(access_token: str) -> None:
    with _auth_verification_cache_lock:
        _auth_verification_cache.pop(access_token, None)


def _marker_logging_enabled() -> bool:
    value = os.environ.get("VOTENOW_DEBUG_MARKER_LOGS", "")
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _log_marker(marker: str, payload: Any | None = None) -> None:
    if not _marker_logging_enabled():
        return
    if payload is None:
        logger.info(marker)
        return
    try:
        logger.info("%s %s", marker, json.dumps(_log_payload_metadata(payload), ensure_ascii=False, default=str))
    except Exception:
        logger.info("%s payload_type=%s", marker, type(payload).__name__)


_SENSITIVE_LOG_FIELDS = {
    "concern_text",
    "notes",
    "full_address",
    "user_address",
    "address",
    "zip",
    "zip_code",
    "user_zip",
    "message_text",
    "raw_user_issue",
    "accumulated_context",
    "final_script",
    "script",
}


def _log_payload_metadata(payload: Any) -> dict[str, Any]:
    metadata: dict[str, Any] = {"type": type(payload).__name__}
    try:
        metadata["approx_bytes"] = len(json.dumps(payload, ensure_ascii=False, default=str))
    except Exception:
        metadata["approx_bytes"] = None

    if isinstance(payload, dict):
        keys = [str(key) for key in payload.keys()]
        normalized = [key.lower() for key in keys]
        metadata["top_level_keys"] = sorted(keys)
        metadata["top_level_key_count"] = len(keys)
        sensitive_present = sorted({key for key in normalized if key in _SENSITIVE_LOG_FIELDS})
        if sensitive_present:
            metadata["redacted_top_level_fields"] = sensitive_present
        if "session" in payload:
            metadata["has_session"] = isinstance(payload.get("session"), dict)
        if isinstance(payload.get("options"), list):
            metadata["options_count"] = len(payload.get("options", []))
    elif isinstance(payload, list):
        metadata["item_count"] = len(payload)

    return metadata


@functools.lru_cache(maxsize=1)
def _is_production_env() -> bool:
    for key in ("VOTENOW_ENV", "APP_ENV", "ENV"):
        value = os.environ.get(key, "").strip().lower()
        if value in {"prod", "production"}:
            return True
    return False


@functools.lru_cache(maxsize=1)
def _configured_repository_backend() -> str:
    configured = os.environ.get("VOTENOW_CIVIC_REPOSITORY", "").strip().lower()
    if configured:
        return configured
    # Prefer Supabase whenever required credentials are present, even if
    # VOTENOW_ENV is not explicitly marked as production.
    has_supabase_creds = bool(
        os.environ.get("SUPABASE_URL", "").strip()
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    if has_supabase_creds:
        return "supabase"
    return "supabase" if _is_production_env() else "inmemory"


def _build_repository() -> CivicRepository:
    backend = _configured_repository_backend()

    if backend == "supabase":
        return SupabaseCivicRepository()

    if backend == "inmemory":
        if _is_production_env():
            raise RuntimeError(
                "InMemoryCivicRepository is not allowed in production. "
                "Set VOTENOW_CIVIC_REPOSITORY=supabase and configure SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY."
            )
        return InMemoryCivicRepository()

    raise RuntimeError(
        f"Unsupported VOTENOW_CIVIC_REPOSITORY={backend!r}. Expected 'supabase' or 'inmemory'."
    )


resolved_backend = _configured_repository_backend()
logger.info(
    "Civic API backend mode resolved to '%s' (production=%s, has_supabase_url=%s, has_service_key=%s).",
    resolved_backend,
    _is_production_env(),
    bool(os.environ.get("SUPABASE_URL", "").strip()),
    bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()),
)

class _LazySingleton:
    """Defers construction until first attribute access.

    Why: importing this module previously constructed a Supabase repo,
    ran issue-catalog seeding (up to ~50 network upserts), and built
    every downstream service before a single request was handled — which
    blocked process startup and made `import api` expensive in tests.
    """

    __slots__ = ("_factory", "_instance")

    def __init__(self, factory: Callable[[], Any]) -> None:
        self._factory = factory
        self._instance: Any = None

    def _resolve(self) -> Any:
        if self._instance is None:
            self._instance = self._factory()
        return self._instance

    def __getattr__(self, name: str) -> Any:
        if name in ("_factory", "_instance"):
            raise AttributeError(name)
        return getattr(self._resolve(), name)


service = _LazySingleton(lambda: CivicService(repository=_build_repository()))
issue_brief_service = _LazySingleton(
    lambda: IssueBriefService(repository=service._resolve().repository)
)
script_package_service = _LazySingleton(
    lambda: ScriptPackageService(
        civic_service=service._resolve(),
        issue_brief_service=issue_brief_service._resolve(),
    )
)
mapc_pipeline_v3_service = _LazySingleton(lambda: MAPCPipelineV3Service())


def _required_string(payload: dict[str, Any], key: str) -> str:
    raw = payload.get(key)
    value = str(raw).strip() if raw is not None else ""
    if not value:
        raise ValueError(f"{key} is required.")
    return value


def _optional_string(payload: dict[str, Any], key: str) -> str | None:
    raw = payload.get(key)
    if raw is None:
        return None
    value = str(raw).strip()
    return value or None


def _coerce_bool(value: Any, field_name: str, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    raise ValueError(f"{field_name} must be a boolean.")


def _coerce_rep_targets(payload: dict[str, Any]) -> list[RepTarget]:
    raw_targets = payload.get("target_reps", [])
    if raw_targets is None:
        return []
    if not isinstance(raw_targets, list):
        raise ValueError("target_reps must be an array.")

    normalized: list[RepTarget] = []
    for value in raw_targets:
        candidate = str(value).strip()
        if not candidate:
            continue
        normalized.append(RepTarget(candidate))
    return normalized


def _coerce_rep_contexts(payload: dict[str, Any]) -> list[RepContext]:
    raw_contexts = payload.get("rep_contexts", [])
    if raw_contexts is None:
        return []
    if not isinstance(raw_contexts, list):
        raise ValueError("rep_contexts must be an array.")

    normalized: list[RepContext] = []
    for raw in raw_contexts:
        if not isinstance(raw, dict):
            continue
        rep_id = str(raw.get("rep_id", "")).strip()
        rep_name = str(raw.get("rep_name", "")).strip()
        office_type = str(raw.get("office_type", "")).strip()
        chamber = str(raw.get("chamber", "")).strip().lower()
        primary_phone_number = str(raw.get("primary_phone_number", "")).strip()
        if not rep_id or not rep_name or not office_type or not chamber:
            continue
        if chamber not in {"house", "senate"}:
            continue
        normalized.append(
            RepContext(
                rep_id=rep_id,
                rep_name=rep_name,
                office_type=office_type,
                chamber=chamber,
                district=_optional_string(raw, "district"),
                state=_optional_string(raw, "state"),
                primary_phone_number=primary_phone_number or "(202) 225-3121",
                local_office_phone_number=_optional_string(raw, "local_office_phone_number"),
                city=_optional_string(raw, "city"),
                zip_code=_optional_string(raw, "zip_code") or _optional_string(raw, "zip"),
                full_address=_optional_string(raw, "full_address") or _optional_string(raw, "address"),
            )
        )
    return normalized


def _validate_script_package_targeting(
    target_reps: list[RepTarget],
    rep_contexts: list[RepContext],
) -> None:
    if not target_reps:
        raise ValueError("target_reps must include at least one target.")

    if not rep_contexts:
        raise ValueError("rep_contexts are required for the requested target_reps.")

    required_house = 1 if RepTarget.HOUSE in target_reps else 0
    required_senate = sum(1 for target in target_reps if target in {RepTarget.SENATE_1, RepTarget.SENATE_2})

    available_house = sum(1 for context in rep_contexts if context.chamber == "house")
    available_senate = sum(1 for context in rep_contexts if context.chamber == "senate")

    missing_parts: list[str] = []
    if required_house > available_house:
        missing_parts.append("house rep_context")
    if required_senate > available_senate:
        missing_parts.append("senate rep_context")

    if missing_parts:
        raise ValueError(
            "Missing required rep_contexts for requested target_reps: "
            + ", ".join(missing_parts)
            + "."
        )


def parse_resolve_request(payload: dict[str, Any], user_id: str) -> AssistantResolveRequest:
    return AssistantResolveRequest(
        user_id=user_id,
        concern_text=_required_string(payload, "concern_text"),
        selected_ask=Ask(_required_string(payload, "selected_ask")),
        target_reps=_coerce_rep_targets(payload),
        optional_bill_ref=_optional_string(payload, "optional_bill_ref"),
    )


def parse_log_request(payload: dict[str, Any], user_id: str) -> CallLogRequest:
    return CallLogRequest(
        user_id=user_id,
        rep_id=_required_string(payload, "rep_id"),
        issue_id=_required_string(payload, "issue_id"),
        brief_id=_required_string(payload, "brief_id"),
        outcome=CallOutcome(_required_string(payload, "outcome")),
        staffer_position=_optional_string(payload, "staffer_position"),
        notes=str(payload.get("notes", "")),
    )


def parse_launch_request(payload: dict[str, Any], user_id: str) -> CallLaunchRequest:
    return CallLaunchRequest(
        user_id=user_id,
        office_id=_required_string(payload, "office_id"),
        issue_id=_optional_string(payload, "issue_id"),
        source_screen=_optional_string(payload, "source_screen") or "issue_call_center",
        session_id=_optional_string(payload, "session_id"),
    )


def parse_completion_request(payload: dict[str, Any], user_id: str) -> CallCompletionRequest:
    return CallCompletionRequest(
        user_id=user_id,
        launch_event_id=_required_string(payload, "launch_event_id"),
        completed=_coerce_bool(payload.get("completed"), "completed", default=True),
    )


def parse_period_type(raw: str) -> LeaderboardPeriodType:
    normalized = raw.strip().lower()
    if normalized == "all_time":
        normalized = LeaderboardPeriodType.ANNUAL.value
    return LeaderboardPeriodType(normalized)


def parse_issue_classify_request(payload: dict[str, Any], user_id: str) -> IssueClassifyRequest:
    return IssueClassifyRequest(
        user_id=user_id,
        concern_text=str(payload.get("concern_text", "")).strip(),
        requested_output=(str(payload.get("requested_output", "")).strip() or None),
    )


def parse_issue_brief_request(payload: dict[str, Any], user_id: str) -> IssueBriefRequest:
    return IssueBriefRequest(
        user_id=user_id,
        concern_text=str(payload.get("concern_text", "")).strip(),
        requested_output=(str(payload.get("requested_output", "")).strip() or None),
        allow_revision=_coerce_bool(payload.get("allow_revision"), "allow_revision", default=True),
    )


def parse_script_package_request(payload: dict[str, Any], user_id: str) -> ScriptPackageRequest:
    target_reps = _coerce_rep_targets(payload)
    rep_contexts = _coerce_rep_contexts(payload)
    _validate_script_package_targeting(target_reps, rep_contexts)
    return ScriptPackageRequest(
        user_id=user_id,
        concern_text=_required_string(payload, "concern_text"),
        selected_ask=Ask(_required_string(payload, "selected_ask")),
        target_reps=target_reps,
        rep_contexts=rep_contexts,
        optional_bill_ref=_optional_string(payload, "optional_bill_ref"),
        allow_revision=_coerce_bool(payload.get("allow_revision"), "allow_revision", default=True),
        user_zip=_optional_string(payload, "user_zip") or _optional_string(payload, "zip"),
        user_city=_optional_string(payload, "user_city") or _optional_string(payload, "city"),
        user_state=_optional_string(payload, "user_state") or _optional_string(payload, "state"),
        user_address=_optional_string(payload, "user_address") or _optional_string(payload, "address"),
        include_full_address_in_script=_coerce_bool(
            payload.get("include_full_address_in_script"),
            "include_full_address_in_script",
            default=False,
        ),
        chosen_option=_optional_string(payload, "chosen_option"),
    )


def parse_script_feedback_request(payload: dict[str, Any], user_id: str) -> ScriptPackageFeedbackRequest:
    decision = _required_string(payload, "decision").strip().lower()
    if decision not in {"accurate", "revise"}:
        raise ValueError("decision must be one of: accurate, revise.")
    return ScriptPackageFeedbackRequest(
        user_id=user_id,
        package_id=_required_string(payload, "package_id"),
        decision=decision,
        chosen_option=_optional_string(payload, "chosen_option"),
        final_script=_optional_string(payload, "final_script"),
    )


def parse_script_chat_turn_request(payload: dict[str, Any], user_id: str) -> ScriptChatTurnRequest:
    role = _required_string(payload, "role").strip().lower()
    if role not in {"user", "assistant"}:
        raise ValueError("role must be one of: user, assistant.")
    turn_index_raw = payload.get("turn_index")
    try:
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        raise ValueError("turn_index must be an integer.") from None
    if turn_index < 1:
        raise ValueError("turn_index must be >= 1.")
    metadata_raw = payload.get("metadata")
    metadata: dict[str, str] | None = None
    if isinstance(metadata_raw, dict):
        cleaned: dict[str, str] = {}
        for key, value in metadata_raw.items():
            key_text = str(key).strip() if key is not None else ""
            value_text = str(value).strip() if value is not None else ""
            if not key_text or not value_text:
                continue
            cleaned[key_text[:120]] = value_text[:500]
            if len(cleaned) >= 16:
                break
        metadata = cleaned or None
    return ScriptChatTurnRequest(
        user_id=user_id,
        session_id=_required_string(payload, "session_id"),
        role=role,
        message_text=_required_string(payload, "message_text"),
        turn_index=turn_index,
        package_id=_optional_string(payload, "package_id"),
        message_type=_optional_string(payload, "message_type"),
        metadata=metadata,
    )


def get_examples(user_id: str) -> dict[str, Any]:
    return service.get_examples(user_id).to_dict()


def post_assistant_resolve(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    response = service.resolve_assistant(parse_resolve_request(payload, user_id))
    return response.to_dict()


def post_calls_log(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    return service.log_call(parse_log_request(payload, user_id))


def post_calls_launch(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    return service.log_call_launch(parse_launch_request(payload, user_id))


def post_calls_confirm(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    parsed = parse_completion_request(payload, user_id)
    launch = service.repository.get_call_launch_event(parsed.user_id, parsed.launch_event_id)
    response = service.confirm_call_completion(parsed)
    script_package_service.record_mapc_completion(
        user_id=parsed.user_id,
        launch_event_id=parsed.launch_event_id,
        completed=parsed.completed,
        issue_id=launch.issue_id if launch is not None else None,
        session_id=launch.session_id if launch is not None else None,
    )
    return response.to_dict()


def get_history(user_id: str) -> dict[str, Any]:
    return service.history(user_id).to_dict()


def get_call_score_summary(user_id: str) -> dict[str, Any]:
    return service.get_call_score_summary(user_id)


def get_call_score_breakdown(user_id: str) -> dict[str, Any]:
    return service.get_call_score_breakdown(user_id)


def get_call_score_history(user_id: str, limit: int = 20) -> dict[str, Any]:
    return service.get_recent_scoring_history(user_id, limit=limit).to_dict()


def post_call_score_recompute(user_id: str) -> dict[str, Any]:
    snapshot, changed_components, baseline_crossed, tier_changed = service.recompute_call_score(user_id)
    return {
        "ok": True,
        "snapshot": snapshot.to_dict(),
        "changed_components": changed_components,
        "baseline_crossed": baseline_crossed,
        "tier_changed": tier_changed,
    }


def get_leaderboard(period_type: str, period_start: str | None = None, limit: int = 100) -> dict[str, Any]:
    resolved_period_type = parse_period_type(period_type)
    parsed_start: datetime | None = None
    if period_start:
        parsed_start = datetime.fromisoformat(period_start.replace("Z", "+00:00")).astimezone(timezone.utc)
    return service.get_leaderboard(
        period_type=resolved_period_type,
        period_start=parsed_start,
        limit=limit,
    ).to_dict()


def get_leaderboard_me(user_id: str, period_type: str, period_start: str | None = None) -> dict[str, Any]:
    resolved_period_type = parse_period_type(period_type)
    parsed_start: datetime | None = None
    if period_start:
        parsed_start = datetime.fromisoformat(period_start.replace("Z", "+00:00")).astimezone(timezone.utc)
    return service.get_user_leaderboard_summary(
        user_id=user_id,
        period_type=resolved_period_type,
        period_start=parsed_start,
    ).to_dict()


def post_issue_classify(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    response = issue_brief_service.classify(parse_issue_classify_request(payload, user_id))
    return response.to_dict()


def post_issue_brief(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    response = issue_brief_service.create_brief(parse_issue_brief_request(payload, user_id))
    return response.to_dict()


def post_script_package(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    parsed = parse_script_package_request(payload, user_id)
    parsed_payload = (
        parsed.model_dump() if hasattr(parsed, "model_dump")
        else parsed.dict() if hasattr(parsed, "dict")
        else parsed.to_dict() if hasattr(parsed, "to_dict")
        else parsed.__dict__
    )

    _log_marker("=== PARSED SCRIPT PACKAGE REQUEST START ===")
    _log_marker(
        "=== PARSED SCRIPT PACKAGE REQUEST METADATA ===",
        parsed_payload
    )
    _log_marker("=== PARSED SCRIPT PACKAGE REQUEST END ===")

    response = script_package_service.create_package(parsed)
    response_payload = (
        response.model_dump() if hasattr(response, "model_dump")
        else response.dict() if hasattr(response, "dict")
        else response.to_dict() if hasattr(response, "to_dict")
        else response.__dict__
    )

    _log_marker("=== SCRIPT PACKAGE RESPONSE START ===")
    _log_marker(
        "=== SCRIPT PACKAGE RESPONSE METADATA ===",
        response_payload
    )
    _log_marker("=== SCRIPT PACKAGE RESPONSE END ===")

    return response.to_dict()


def post_script_feedback(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    parsed = parse_script_feedback_request(payload, user_id)
    script_package_service.record_feedback(parsed)
    return {"ok": True}


def post_script_chat_turn(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    logger.info(
        "🧭 [Founder Trace][Backend] /script-chat-turn received payload_metadata=%s",
        json.dumps(_log_payload_metadata(payload), ensure_ascii=False, default=str),
    )
    parsed = parse_script_chat_turn_request(payload, user_id)
    logger.info(
        "🧭 [Founder Trace][Backend] /script-chat-turn parsed session_id_present=%s role=%s turn_index=%s message_type=%s",
        bool(parsed.session_id),
        parsed.role,
        parsed.turn_index,
        parsed.message_type,
    )
    script_package_service.record_chat_turn(parsed)
    return {"ok": True}


def _mapc_v3_detail(exc: MAPCPipelineV3Error) -> dict[str, str]:
    return {
        "reason_code": exc.reason_code,
        "message": exc.message,
    }


def _mapc_v3_payload_session_state(payload: dict[str, Any]) -> str:
    session = payload.get("session")
    if not isinstance(session, dict):
        return ""
    raw_state = session.get("session_state")
    if not isinstance(raw_state, str):
        return ""
    return raw_state.strip().lower()


def _mapc_v3_payload_session_id(payload: dict[str, Any]) -> str:
    session = payload.get("session")
    if isinstance(session, dict):
        raw = session.get("session_id")
        if isinstance(raw, str):
            return raw.strip()
    raw_root = payload.get("session_id")
    if isinstance(raw_root, str):
        return raw_root.strip()
    return ""


def post_mapc_v3_interpret(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        response = mapc_pipeline_v3_service.interpret(payload, user_id=user_id)
        response_size = len(json.dumps(response, default=str))
        logger.info(
            "[mapc_v3] interpret response_size=%s has_session=%s",
            response_size,
            isinstance(response, dict) and "session" in response,
        )
        return response
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_ask_options(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        response = mapc_pipeline_v3_service.ask_options(payload, user_id=user_id)
        response_size = len(json.dumps(response, default=str))
        options_count = len(response.get("options", [])) if isinstance(response, dict) else -1
        logger.info(
            "[mapc_v3] ask-options response_size=%s options_count=%s has_session=%s",
            response_size,
            options_count,
            isinstance(response, dict) and "session" in response,
        )
        return response
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_background(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    payload_state = _mapc_v3_payload_session_state(payload)
    payload_session_id = _mapc_v3_payload_session_id(payload)
    logger.info(
        "🧭 [Founder Trace][Backend] /mapc/background request session_id_present=%s session_state=%s payload_metadata=%s",
        bool(payload_session_id),
        payload_state or "<missing>",
        json.dumps(_log_payload_metadata(payload), ensure_ascii=False, default=str),
    )
    logger.info(
        "🧭 [Founder Trace][Backend] Supabase thread/session read-write in this route: none (MAPC uses in-memory session cache)."
    )
    if payload_state in {"script_shown", "preview_shown"}:
        logger.info("[mapc_v3] background terminal no-op payload_state=%s", payload_state)
        session = payload.get("session")
        safe_session = session if isinstance(session, dict) else {}
        return {
            "session": safe_session,
            "background_text": None,
            "reason": "terminal_state_noop",
            "validator_report": {
                "stage": "background",
                "checks": [{"name": "terminal_state_noop", "passed": True}],
            },
        }
    try:
        response = mapc_pipeline_v3_service.background(payload, user_id=user_id)
        logger.info(
            "🧭 [Founder Trace][Backend] /mapc/background response_metadata=%s",
            json.dumps(_log_payload_metadata(response), ensure_ascii=False, default=str),
        )
        return response
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_script(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    payload_state = _mapc_v3_payload_session_state(payload)
    payload_session_id = _mapc_v3_payload_session_id(payload)
    selected_option_id = str(payload.get("selected_option_id", "")).strip()
    logger.info(
        "🧭 [Founder Trace][Backend] /mapc/script request session_id_present=%s session_state=%s selected_option_id_present=%s payload_metadata=%s",
        bool(payload_session_id),
        payload_state or "<missing>",
        bool(selected_option_id),
        json.dumps(_log_payload_metadata(payload), ensure_ascii=False, default=str),
    )
    logger.info(
        "🧭 [Founder Trace][Backend] Supabase thread/session read-write in this route: none (MAPC uses in-memory session cache)."
    )
    try:
        response = mapc_pipeline_v3_service.script(payload, user_id=user_id)
        logger.info(
            "🧭 [Founder Trace][Backend] /mapc/script response_metadata=%s",
            json.dumps(_log_payload_metadata(response), ensure_ascii=False, default=str),
        )
        return response
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_revise(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        return mapc_pipeline_v3_service.revise(payload, user_id=user_id)
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def post_mapc_v3_pending(payload: dict[str, Any], user_id: str) -> dict[str, Any]:
    try:
        return mapc_pipeline_v3_service.pending_selection(payload, user_id=user_id)
    except MAPCPipelineV3Error as exc:
        raise ValueError(json.dumps(_mapc_v3_detail(exc))) from exc


def get_mapc_v3_health(_: str) -> dict[str, Any]:
    return mapc_pipeline_v3_service.health_snapshot()



try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import HTMLResponse, Response
except Exception:  # pragma: no cover
    FastAPI = None
    HTTPException = Exception
    Request = Any
    HTMLResponse = None
    Response = None

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    _SENTRY_AVAILABLE = True
except ImportError:  # pragma: no cover
    _SENTRY_AVAILABLE = False


def _init_sentry() -> None:
    if not _SENTRY_AVAILABLE:
        return
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("FLY_APP_NAME", "development"),
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.05,
        send_default_pii=False,
    )


_init_sentry()


def _extract_bearer_token(authorization_header: str | None) -> str:
    header = (authorization_header or "").strip()
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    return token


def _resolve_authenticated_user_id(access_token: str) -> str:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    supabase_service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    auth_apikey = supabase_anon_key or supabase_service_role_key
    if not supabase_url or not auth_apikey:
        raise HTTPException(
            status_code=500,
            detail="Supabase auth verification is not configured (requires SUPABASE_URL plus SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY).",
        )

    cached_user_id = _auth_cache_get(access_token)
    if cached_user_id:
        return cached_user_id

    request = urllib.request.Request(
        f"{supabase_url}/auth/v1/user",
        method="GET",
        headers={
            "Authorization": f"Bearer {access_token}",
            "apikey": auth_apikey,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            _auth_cache_delete(access_token)
            raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc
        raise HTTPException(status_code=502, detail="Auth verification failed.") from exc
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Auth verification unavailable.") from exc

    user_id = str(payload.get("id", "")).strip()
    if not user_id:
        _auth_cache_delete(access_token)
        raise HTTPException(status_code=401, detail="Invalid auth context.")
    _auth_cache_set(access_token, user_id)
    return user_id


def require_authenticated_user_id(request: Request) -> str:
    access_token = _extract_bearer_token(request.headers.get("authorization"))
    return _resolve_authenticated_user_id(access_token)


def _resolve_anonymous_user_id(request: Request) -> str:
    anonymous_header = str(request.headers.get("x-anonymous-id", "")).strip()
    if anonymous_header:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, anonymous_header))
    logger.warning("[civic] missing X-Anonymous-ID header; using ephemeral anonymous user id")
    return str(uuid.uuid4())


def resolve_authenticated_or_anonymous_user_id(request: Request) -> str:
    try:
        return require_authenticated_user_id(request)
    except HTTPException as exc:
        if getattr(exc, "status_code", None) in {401, 403}:
            logger.warning("[civic] falling back to anonymous user context status=%s", exc.status_code)
            return _resolve_anonymous_user_id(request)
        raise


def _internal_server_error(exc: Exception) -> HTTPException:
    logger.exception("Unhandled civic API exception", exc_info=exc)
    return HTTPException(status_code=500, detail="Internal server error.")


def _run_endpoint(
    handler: Callable[[], dict[str, Any]],
    *,
    bad_request_exceptions: tuple[type[Exception], ...] = (),
) -> dict[str, Any]:
    try:
        return handler()
    except HTTPException:
        raise
    except bad_request_exceptions as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise _internal_server_error(exc) from exc


def get_openstates_people_geo(lat: float, lng: float, include: str | None = "links") -> dict[str, Any]:
    params = {
        "lat": f"{lat:.6f}",
        "lng": f"{lng:.6f}",
        "include": "links" if (include or "").strip().lower() == "links" else "links",
    }
    try:
        if not math.isfinite(lat) or not math.isfinite(lng):
            raise ValueError("Invalid coordinates.")
        if lat < -90 or lat > 90 or lng < -180 or lng > 180:
            raise ValueError("Coordinates out of range.")

        api_key = os.environ.get("OPENSTATES_API_KEY", "").strip()
        if not api_key or api_key == "YOUR_OPENSTATES_API_KEY":
            logger.warning("OpenStates API key is not configured.")
            return {
                "status": "error",
                "error_code": "openstates_not_configured",
                "message": "OpenStates API key is not configured.",
                "results": [],
            }

        openstates_request = urllib.request.Request(
            f"https://v3.openstates.org/people.geo?{urlencode(params)}",
            method="GET",
            headers={
                "Accept": "application/json",
                "X-API-KEY": api_key,
            },
        )

        with urllib.request.urlopen(openstates_request, timeout=25) as response:
            payload = json.loads(response.read().decode("utf-8"))

        if not isinstance(payload, dict):
            return {
                "status": "error",
                "error_code": "openstates_invalid_response",
                "message": "OpenStates returned an invalid response shape.",
                "results": [],
            }
        results = payload.get("results")
        if not isinstance(results, list):
            results = []
        return {
            "status": "ok",
            "error_code": None,
            "message": None,
            "results": results,
        }
    except Exception as exc:
        logger.warning(
            "OpenStates lookup failed. lat=%s lng=%s include=%s error=%s",
            lat,
            lng,
            include,
            exc,
            exc_info=exc,
        )
        return {
            "status": "error",
            "error_code": "openstates_upstream_failure",
            "message": "OpenStates request failed.",
            "results": [],
        }


if FastAPI is not None:
    app = FastAPI(title="Civica Civic API", version="1.0.0")
    bad_request = (ValueError, TypeError)

    # Mount the SNAP conversational-pipeline router. Best-effort — if
    # the SNAP module's dependencies (Pydantic v2, anthropic SDK,
    # cryptography) are missing in a particular deploy or a required
    # env var (SNAP_FERNET_KEY in production) isn't set, log a clear
    # warning and continue without SNAP rather than failing the whole
    # API. The MyReps endpoints have nothing to do with SNAP and should
    # keep working.
    try:
        from .snap.api import build_snap_router
        from .snap.factory import build_default_orchestrator

        _snap_orchestrator = build_default_orchestrator()
        app.include_router(build_snap_router(_snap_orchestrator))
        logger.info("SNAP router mounted at /snap/*.")
    except Exception as snap_exc:  # noqa: BLE001
        logger.warning(
            "SNAP router not mounted (%s). MyReps endpoints continue unaffected.",
            snap_exc,
        )

    @app.get("/")
    def root_status() -> dict[str, Any]:
        return {
            "ok": True,
            "service": "Civica Civic API",
            "version": "1.0.0",
        }

    @app.get("/healthz")
    def healthz() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/v1/civic/examples")
    def civic_examples(request: Request) -> dict[str, Any]:
        return _run_endpoint(lambda: get_examples(resolve_authenticated_or_anonymous_user_id(request)))

    @app.post("/api/v1/civic/assistant/resolve")
    def civic_resolve(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_assistant_resolve(payload, require_authenticated_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/issue-classify")
    def civic_issue_classify(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_issue_classify(payload, require_authenticated_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/issue-brief")
    def civic_issue_brief(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_issue_brief(payload, require_authenticated_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v1/civic/script-package")
    def civic_script_package(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        _log_marker("=== SCRIPT PACKAGE RAW PAYLOAD START ===")
        _log_marker("=== SCRIPT PACKAGE REQUEST METADATA ===", payload)
        _log_marker("=== SCRIPT PACKAGE RAW PAYLOAD END ===")
        return _run_endpoint(
            lambda: post_script_package(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v1/civic/script-feedback")
    def civic_script_feedback(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_script_feedback(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v1/civic/script-chat-turn")
    def civic_script_chat_turn(
        payload: dict[str, Any],
        request: Request,
    ) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_script_chat_turn(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v2/civic/mapc/interpret")
    def civic_mapc_v3_interpret(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_mapc_v3_interpret(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v2/civic/mapc/ask-options")
    def civic_mapc_v3_ask_options(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_mapc_v3_ask_options(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v2/civic/mapc/background")
    def civic_mapc_v3_background(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_mapc_v3_background(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v2/civic/mapc/script")
    def civic_mapc_v3_script(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_mapc_v3_script(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v2/civic/mapc/revise")
    def civic_mapc_v3_revise(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_mapc_v3_revise(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v2/civic/mapc/pending")
    def civic_mapc_v3_pending(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_mapc_v3_pending(payload, resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.get("/api/v2/civic/mapc/health")
    def civic_mapc_v3_health(request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: get_mapc_v3_health(resolve_authenticated_or_anonymous_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v1/civic/calls/log")
    def civic_log_call(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_calls_log(payload, require_authenticated_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v1/civic/calls/launch")
    def civic_call_launch(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_calls_launch(payload, require_authenticated_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.post("/api/v1/civic/calls/confirm")
    def civic_call_confirm(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        return _run_endpoint(
            lambda: post_calls_confirm(payload, require_authenticated_user_id(request)),
            bad_request_exceptions=bad_request,
        )

    @app.get("/api/v1/civic/history")
    def civic_history(request: Request) -> dict[str, Any]:
        return _run_endpoint(lambda: get_history(require_authenticated_user_id(request)))

    @app.get("/api/v1/civic/call-score/summary")
    def civic_call_score_summary(request: Request) -> dict[str, Any]:
        return _run_endpoint(lambda: get_call_score_summary(require_authenticated_user_id(request)))

    @app.get("/api/v1/civic/call-score/breakdown")
    def civic_call_score_breakdown(request: Request) -> dict[str, Any]:
        return _run_endpoint(lambda: get_call_score_breakdown(require_authenticated_user_id(request)))

    @app.get("/api/v1/civic/call-score/history")
    def civic_call_score_history(request: Request, limit: int = 20) -> dict[str, Any]:
        return _run_endpoint(
            lambda: get_call_score_history(user_id=require_authenticated_user_id(request), limit=limit)
        )

    @app.post("/api/v1/civic/call-score/recompute")
    def civic_call_score_recompute(payload: dict[str, Any], request: Request) -> dict[str, Any]:
        def handler() -> dict[str, Any]:
            _ = payload
            return post_call_score_recompute(require_authenticated_user_id(request))

        return _run_endpoint(handler, bad_request_exceptions=bad_request)

    @app.get("/api/v1/civic/leaderboard")
    def civic_leaderboard(
        request: Request,
        period_type: str,
        period_start: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        def handler() -> dict[str, Any]:
            _ = require_authenticated_user_id(request)
            return get_leaderboard(period_type=period_type, period_start=period_start, limit=limit)

        return _run_endpoint(handler, bad_request_exceptions=bad_request)

    @app.get("/api/v1/civic/leaderboard/me")
    def civic_leaderboard_me(
        request: Request,
        period_type: str,
        period_start: str | None = None,
    ) -> dict[str, Any]:
        return _run_endpoint(
            lambda: get_leaderboard_me(
                user_id=require_authenticated_user_id(request),
                period_type=period_type,
                period_start=period_start,
            ),
            bad_request_exceptions=bad_request,
        )

    @app.get("/api/v1/openstates/people.geo")
    def openstates_people_geo(
        request: Request,
        lat: float,
        lng: float,
        include: str = "links",
    ) -> dict[str, Any]:
        def handler() -> dict[str, Any]:
            _ = resolve_authenticated_or_anonymous_user_id(request)
            return get_openstates_people_geo(lat=lat, lng=lng, include=include)

        return _run_endpoint(handler, bad_request_exceptions=bad_request)

