from __future__ import annotations

import json
import logging
import math
import os
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
    ScriptPackageRequest,
)
from .issue_brief_service import IssueBriefService
from .repository import CivicRepository, InMemoryCivicRepository, SupabaseCivicRepository
from .script_package_service import ScriptPackageService
from .service import CivicService

logger = logging.getLogger(__name__)


def _log_marker(marker: str, payload: Any | None = None) -> None:
    if payload is None:
        logger.info(marker)
        return
    try:
        if isinstance(payload, str):
            logger.info("%s %s", marker, payload)
        else:
            logger.info("%s %s", marker, json.dumps(payload, ensure_ascii=False, default=str))
    except Exception:
        logger.info("%s %s", marker, str(payload))


def _is_production_env() -> bool:
    for key in ("VOTENOW_ENV", "APP_ENV", "ENV"):
        value = os.environ.get(key, "").strip().lower()
        if value in {"prod", "production"}:
            return True
    return False


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

service = CivicService(repository=_build_repository())
issue_brief_service = IssueBriefService(repository=service.repository)
script_package_service = ScriptPackageService(civic_service=service, issue_brief_service=issue_brief_service)


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
    return ScriptPackageRequest(
        user_id=user_id,
        concern_text=_required_string(payload, "concern_text"),
        selected_ask=Ask(_required_string(payload, "selected_ask")),
        target_reps=_coerce_rep_targets(payload),
        rep_contexts=_coerce_rep_contexts(payload),
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
    return service.confirm_call_completion(parse_completion_request(payload, user_id)).to_dict()


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

    _log_marker("=== PARSED SCRIPT PACKAGE REQUEST START ===")
    _log_marker(
        "=== PARSED SCRIPT PACKAGE REQUEST PAYLOAD ===",
        parsed.model_dump() if hasattr(parsed, "model_dump")
        else parsed.dict() if hasattr(parsed, "dict")
        else parsed.to_dict() if hasattr(parsed, "to_dict")
        else parsed.__dict__
    )
    _log_marker("=== PARSED SCRIPT PACKAGE REQUEST END ===")

    response = script_package_service.create_package(parsed)

    _log_marker("=== SCRIPT PACKAGE RESPONSE START ===")
    _log_marker(
        "=== SCRIPT PACKAGE RESPONSE PAYLOAD ===",
        response.model_dump() if hasattr(response, "model_dump")
        else response.dict() if hasattr(response, "dict")
        else response.to_dict() if hasattr(response, "to_dict")
        else response.__dict__
    )
    _log_marker("=== SCRIPT PACKAGE RESPONSE END ===")

    return response.to_dict()


_SHARE_CARD_DEFAULTS: dict[str, dict[str, str]] = {
    "election": {
        "title": "Don’t Miss Your Next Election",
        "subtitle": "Check deadlines, voting options, and what is on your ballot.",
        "cta": "View Election Details",
        "badge": "Upcoming Election",
        "target": "election",
    },
    "registration": {
        "title": "Check Your Registration",
        "subtitle": "Register, update your address, or check your voter status in one place.",
        "cta": "Check Registration",
        "badge": "Registration Reminder",
        "target": "registration",
    },
    "mapv": {
        "title": "Make Your Plan to Vote",
        "subtitle": "Pick your voting method, review deadlines, and get ready now.",
        "cta": "Start Your Plan",
        "badge": "Plan Ahead",
        "target": "mapv",
    },
    "civic": {
        "title": "Take Civic Action in Minutes",
        "subtitle": "VoteNow gives you a script, contacts, and call steps so you can act now.",
        "cta": "Take Action",
        "badge": "Script Ready",
        "target": "civic",
    },
}


def _clamp_text(value: str | None, fallback: str, max_len: int) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        cleaned = fallback
    return cleaned[:max_len]


def _resolve_card_type(raw_card_type: str) -> str:
    candidate = (raw_card_type or "").strip().lower()
    if candidate in _SHARE_CARD_DEFAULTS:
        return candidate
    return "election"


def _friendly_date(raw: str | None, *, with_weekday: bool = False) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    for pattern in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            parsed = datetime.strptime(value, pattern)
            if with_weekday:
                return f"{parsed.strftime('%A')}, {parsed.strftime('%b')} {parsed.day}, {parsed.year}"
            return f"{parsed.strftime('%b')} {parsed.day}, {parsed.year}"
        except ValueError:
            continue
    return value


def _human_label(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    return value.replace("_", " ").replace("-", " ").title()


def _build_share_info_rows(card_type: str, params: dict[str, str]) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    if card_type == "election":
        day = _friendly_date(params.get("day"), with_weekday=True)
        state = params.get("state_name") or params.get("state")
        election_type = _human_label(params.get("type"))
        registration = (params.get("registration") or "").strip()
        early_voting = (params.get("early_voting") or "").strip()

        if day:
            rows.append(("Election Day", day))
        if state:
            rows.append(("Location", state))
        if election_type:
            rows.append(("Election Type", election_type))
        if registration and registration.lower() not in {"not listed", "unknown"}:
            rows.append(("Registration Deadline", registration))
        if early_voting and early_voting.lower() not in {"not listed", "unknown"}:
            rows.append(("Early Voting", early_voting))
    elif card_type == "registration":
        state = params.get("state") or "Your state"
        deadline = _friendly_date(params.get("deadline")) or (params.get("deadline") or "").strip()
        mode = _human_label(params.get("mode"))
        rows.append(("State", state))
        if deadline:
            rows.append(("Deadline", deadline))
        if mode:
            rows.append(("Action", mode))
    elif card_type == "mapv":
        election = (params.get("election") or "").strip()
        day = _friendly_date(params.get("day"))
        method = (params.get("method") or "").strip()
        state = (params.get("state") or "").strip()
        if election:
            rows.append(("Election", election))
        if day:
            rows.append(("Date", day))
        if method:
            rows.append(("Voting Method", method))
        if state:
            rows.append(("State", state))
    elif card_type == "civic":
        issue = (params.get("issue") or "").strip()
        calls = (params.get("calls") or "").strip()
        if issue:
            rows.append(("Issue", issue))
        if calls:
            rows.append(("VoteNow Calls", calls))

    return rows


def _build_share_deep_link(card_type: str, params: dict[str, str]) -> str:
    if card_type == "election":
        query_items: list[tuple[str, str]] = []
        for key in ("eid", "type", "day", "state", "state_name", "title"):
            value = params.get(key, "").strip()
            if value:
                query_items.append((key, value))
        if query_items:
            return f"votenow://election?{urlencode(query_items)}"
        return "votenow://election"
    if card_type == "registration":
        query_items = []
        for key in ("state", "deadline", "mode"):
            value = params.get(key, "").strip()
            if value:
                query_items.append((key, value))
        if query_items:
            return f"votenow://registration?{urlencode(query_items)}"
        return "votenow://registration"
    if card_type == "mapv":
        query_items = []
        for key in ("election", "day", "method", "state"):
            value = params.get(key, "").strip()
            if value:
                query_items.append((key, value))
        if query_items:
            return f"votenow://mapv?{urlencode(query_items)}"
        return "votenow://mapv"
    query_items = []
    for key in ("issue", "issue_id", "calls"):
        value = params.get(key, "").strip()
        if value:
            query_items.append((key, value))
    if query_items:
        return f"votenow://civic?{urlencode(query_items)}"
    return "votenow://civic"


def _build_share_svg(card_type: str, title: str, subtitle: str, badge: str, cta: str) -> str:
    gradient_by_type = {
        "election": ("#113FAD", "#56A3FF"),
        "registration": ("#0D6F8A", "#1EB89F"),
        "mapv": ("#1C4A77", "#5F86B8"),
        "civic": ("#1A2F71", "#4F76DB"),
    }
    c0, c1 = gradient_by_type.get(card_type, ("#113FAD", "#56A3FF"))

    safe_title = escape(title)
    safe_subtitle = escape(subtitle)
    safe_badge = escape(badge)
    safe_cta = escape(cta)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="{safe_title}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c0}" />
      <stop offset="100%" stop-color="{c1}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)" />
  <rect x="0" y="448" width="1200" height="182" fill="rgba(255,255,255,0.16)" />
  <rect x="72" y="62" width="340" height="44" rx="22" fill="rgba(255,255,255,0.22)" />
  <text x="94" y="91" fill="#FFFFFF" font-size="26" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-weight="600">{safe_badge}</text>
  <foreignObject x="72" y="122" width="1056" height="250">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 700 68px system-ui,-apple-system,Segoe UI,sans-serif; line-height:1.08; color:white;">
      {safe_title}
    </div>
  </foreignObject>
  <foreignObject x="72" y="474" width="770" height="110">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 600 34px system-ui,-apple-system,Segoe UI,sans-serif; line-height:1.16; color:rgba(255,255,255,0.96);">
      {safe_subtitle}
    </div>
  </foreignObject>
  <rect x="72" y="560" width="34" height="34" rx="8" fill="#ADD7E5"/>
  <rect x="88" y="566" width="10" height="3.2" fill="#DF5845"/>
  <rect x="88" y="572" width="10" height="3.2" fill="#DF5845"/>
  <rect x="88" y="578" width="10" height="3.2" fill="#DF5845"/>
  <rect x="79" y="584" width="19" height="3.2" fill="#DF5845"/>
  <rect x="79" y="590" width="19" height="3.2" fill="#DF5845"/>
  <rect x="870" y="500" width="252" height="56" rx="28" fill="#E1593B" />
  <text x="996" y="536" text-anchor="middle" fill="#FFFFFF" font-size="26" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-weight="600">{safe_cta}</text>
  <text x="116" y="587" fill="rgba(255,255,255,0.98)" font-size="30" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-weight="700">VoteNow</text>
</svg>"""


try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import HTMLResponse, Response
except Exception:  # pragma: no cover
    FastAPI = None
    HTTPException = Exception
    Request = Any
    HTMLResponse = None
    Response = None


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
            raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc
        raise HTTPException(status_code=502, detail="Auth verification failed.") from exc
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Auth verification unavailable.") from exc

    user_id = str(payload.get("id", "")).strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid auth context.")
    return user_id


def require_authenticated_user_id(request: Request) -> str:
    access_token = _extract_bearer_token(request.headers.get("authorization"))
    return _resolve_authenticated_user_id(access_token)


def resolve_authenticated_or_anonymous_user_id(request: Request) -> str:
    try:
        return require_authenticated_user_id(request)
    except HTTPException as exc:
        if getattr(exc, "status_code", None) in {401, 403, 500, 502}:
            logger.warning("[civic] falling back to anonymous user context status=%s", exc.status_code)
            return str(uuid.uuid4())
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
    if not math.isfinite(lat) or not math.isfinite(lng):
        raise ValueError("Invalid coordinates.")
    if lat < -90 or lat > 90 or lng < -180 or lng > 180:
        raise ValueError("Coordinates out of range.")

    api_key = os.environ.get("OPENSTATES_API_KEY", "").strip()
    if not api_key or api_key == "YOUR_OPENSTATES_API_KEY":
        raise HTTPException(status_code=500, detail="OpenStates API key is not configured.")

    params = {
        "lat": f"{lat:.6f}",
        "lng": f"{lng:.6f}",
        "include": "links" if (include or "").strip().lower() == "links" else "links",
    }

    openstates_request = urllib.request.Request(
        f"https://v3.openstates.org/people.geo?{urlencode(params)}",
        method="GET",
        headers={
            "Accept": "application/json",
            "X-API-KEY": api_key,
        },
    )

    try:
        with urllib.request.urlopen(openstates_request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 400:
            raise HTTPException(status_code=400, detail="Invalid OpenStates request.") from exc
        raise HTTPException(status_code=502, detail="OpenStates request failed.") from exc
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="OpenStates request unavailable.") from exc

    if not isinstance(payload, dict):
        return {"results": []}
    return payload


if FastAPI is not None:
    app = FastAPI(title="VoteNow Civic API", version="1.0.0")
    bad_request = (ValueError, TypeError)

    @app.get("/")
    def root_status() -> dict[str, Any]:
        return {
            "ok": True,
            "service": "VoteNow Civic API",
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
        _log_marker("=== SCRIPT PACKAGE RAW PAYLOAD DATA ===", payload)
        _log_marker("=== SCRIPT PACKAGE RAW PAYLOAD END ===")
        return _run_endpoint(
            lambda: post_script_package(payload, resolve_authenticated_or_anonymous_user_id(request)),
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

    @app.get("/share/preview/{card_type}.svg")
    def share_preview_svg(
        card_type: str,
        title: str | None = None,
        subtitle: str | None = None,
        badge: str | None = None,
        cta: str | None = None,
    ) -> Response:
        resolved = _resolve_card_type(card_type)
        defaults = _SHARE_CARD_DEFAULTS[resolved]
        svg = _build_share_svg(
            card_type=resolved,
            title=_clamp_text(title, defaults["title"], 120),
            subtitle=_clamp_text(subtitle, defaults["subtitle"], 220),
            badge=_clamp_text(badge, defaults["badge"], 64),
            cta=_clamp_text(cta, defaults["cta"], 80),
        )
        return Response(content=svg, media_type="image/svg+xml")

    @app.get("/share/{card_type}", response_class=HTMLResponse)
    def share_landing_page(
        card_type: str,
        target: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        cta: str | None = None,
        badge: str | None = None,
        campaign: str | None = None,
        eid: str | None = None,
        type: str | None = None,
        day: str | None = None,
        state: str | None = None,
        state_name: str | None = None,
        election: str | None = None,
        method: str | None = None,
        issue: str | None = None,
        issue_id: str | None = None,
        calls: str | None = None,
        mode: str | None = None,
        deadline: str | None = None,
        registration: str | None = None,
        early_voting: str | None = None,
    ) -> HTMLResponse:
        resolved = _resolve_card_type(card_type)
        defaults = _SHARE_CARD_DEFAULTS[resolved]

        raw_title = (title or "").strip()
        raw_subtitle = (subtitle or "").strip()
        raw_cta = (cta or "").strip()
        raw_badge = (badge or "").strip()
        raw_target = (target or "").strip().lower()

        query_items = {
            "target": raw_target or defaults["target"],
            "title": raw_title,
            "subtitle": raw_subtitle,
            "cta": raw_cta,
            "badge": raw_badge,
            "campaign": campaign or "",
            "eid": eid or "",
            "type": type or "",
            "day": day or "",
            "state": state or "",
            "state_name": state_name or "",
            "election": election or "",
            "method": method or "",
            "issue": issue or "",
            "issue_id": issue_id or "",
            "calls": calls or "",
            "mode": mode or "",
            "deadline": deadline or "",
            "registration": registration or "",
            "early_voting": early_voting or "",
        }

        inferred_title = defaults["title"]
        if resolved == "election" and query_items["election"]:
            inferred_title = f"Upcoming Election: {query_items['election']}"
        elif resolved == "mapv" and query_items["election"]:
            inferred_title = f"Plan Your Vote: {query_items['election']}"
        elif resolved == "civic" and query_items["issue"]:
            inferred_title = f"Take Action: {query_items['issue']}"

        inferred_subtitle = defaults["subtitle"]
        if resolved == "election":
            day_label = _friendly_date(query_items["day"], with_weekday=True)
            election_type_label = _human_label(query_items["type"])
            registration_label = query_items["registration"].strip()
            early_voting_label = query_items["early_voting"].strip()
            detail_parts = []
            if day_label:
                detail_parts.append(f"Election Day: {day_label}")
            if election_type_label:
                detail_parts.append(election_type_label)
            if registration_label and registration_label.lower() not in {"not listed", "unknown"}:
                detail_parts.append(f"Registration: {registration_label}")
            if early_voting_label and early_voting_label.lower() not in {"not listed", "unknown"}:
                detail_parts.append(f"Early Voting: {early_voting_label}")
            if detail_parts:
                inferred_subtitle = " · ".join(detail_parts)
        elif resolved == "mapv":
            day_label = _friendly_date(query_items["day"], with_weekday=True)
            method_label = query_items["method"].strip()
            parts = []
            if day_label:
                parts.append(f"Election Day: {day_label}")
            if method_label:
                parts.append(f"Method: {method_label}")
            if parts:
                inferred_subtitle = " · ".join(parts)
        elif resolved == "registration":
            deadline_label = _friendly_date(query_items["deadline"]) or query_items["deadline"].strip()
            if deadline_label:
                inferred_subtitle = f"Deadline: {deadline_label}."

        resolved_target = _clamp_text(query_items["target"], defaults["target"], 32).lower()
        if resolved_target not in _SHARE_CARD_DEFAULTS:
            resolved_target = defaults["target"]
        resolved_title = _clamp_text(raw_title or inferred_title, defaults["title"], 120)
        resolved_subtitle = _clamp_text(raw_subtitle or inferred_subtitle, defaults["subtitle"], 220)
        resolved_cta = _clamp_text(raw_cta, defaults["cta"], 80)
        resolved_badge = _clamp_text(raw_badge, defaults["badge"], 64)

        info_rows = _build_share_info_rows(resolved, query_items)
        info_rows_html = "".join(
            f"<li><span>{escape(label)}</span><strong>{escape(value)}</strong></li>"
            for label, value in info_rows
        )
        info_section_html = ""
        if info_rows_html:
            info_section_html = (
                "<section class=\"info\" aria-label=\"Key details\">"
                "<ul class=\"info-list\">"
                f"{info_rows_html}"
                "</ul>"
                "</section>"
            )

        canonical_pairs = [(k, v) for k, v in query_items.items() if v]
        canonical_query = urlencode(canonical_pairs)
        canonical_url = f"https://votenow.app/share/{resolved}"
        if canonical_query:
            canonical_url = f"{canonical_url}?{canonical_query}"

        preview_query = urlencode(
            {
                "title": resolved_title,
                "subtitle": resolved_subtitle,
                "badge": resolved_badge,
                "cta": resolved_cta,
            }
        )
        preview_url = f"https://votenow.app/share/preview/{resolved}.svg?{preview_query}"
        app_deep_link = _build_share_deep_link(resolved_target, query_items)
        app_store_url = "https://apps.apple.com/us/search?term=VoteNow"
        web_pairs = canonical_pairs + [("open", "web")]
        web_url = f"https://votenow.app/share/{resolved}?{urlencode(web_pairs)}"

        theme_by_type: dict[str, dict[str, str]] = {
            "election": {"bg0": "#0E2D69", "bg1": "#2B76B9", "bg2": "#B3DEF2", "cta": "#DF5846"},
            "registration": {"bg0": "#19515F", "bg1": "#2B76B9", "bg2": "#B3DEF2", "cta": "#DF5846"},
            "mapv": {"bg0": "#17385D", "bg1": "#2B76B9", "bg2": "#B3DEF2", "cta": "#DF5846"},
            "civic": {"bg0": "#1D315A", "bg1": "#2F4E95", "bg2": "#B3DEF2", "cta": "#DF5846"},
        }
        theme = theme_by_type.get(resolved, theme_by_type["election"])

        safe_title = escape(resolved_title)
        safe_subtitle = escape(resolved_subtitle)
        safe_cta = escape(resolved_cta)
        safe_badge = escape(resolved_badge)
        safe_deep_link = escape(app_deep_link, quote=True)
        safe_app_store_url = escape(app_store_url, quote=True)
        safe_canonical = escape(canonical_url, quote=True)
        safe_preview = escape(preview_url, quote=True)
        safe_web_url = escape(web_url, quote=True)
        safe_bg0 = escape(theme["bg0"], quote=True)
        safe_bg1 = escape(theme["bg1"], quote=True)
        safe_bg2 = escape(theme["bg2"], quote=True)
        safe_theme_cta = escape(theme["cta"], quote=True)

        html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_title} | VoteNow</title>
  <meta name="description" content="{escape(resolved_subtitle, quote=True)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="VoteNow" />
  <meta property="og:title" content="{escape(resolved_title, quote=True)}" />
  <meta property="og:description" content="{escape(resolved_subtitle, quote=True)}" />
  <meta property="og:url" content="{safe_canonical}" />
  <meta property="og:image" content="{safe_preview}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{escape(resolved_title, quote=True)}" />
  <meta property="al:ios:url" content="{safe_deep_link}" />
  <meta property="al:ios:app_name" content="VoteNow" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{escape(resolved_title, quote=True)}" />
  <meta name="twitter:description" content="{escape(resolved_subtitle, quote=True)}" />
  <meta name="twitter:image" content="{safe_preview}" />
  <link rel="canonical" href="{safe_canonical}" />
  <style>
    :root {{
      --bg-0: {safe_bg0};
      --bg-1: {safe_bg1};
      --bg-2: {safe_bg2};
      --surface: rgba(255,255,255,0.14);
      --surface-2: rgba(255,255,255,0.22);
      --text: #ffffff;
      --muted: rgba(255,255,255,0.9);
      --cta: {safe_theme_cta};
      --cta-hover: #ca4432;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "SF Pro Display", "Avenir Next", "Segoe UI", system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(74% 68% at 80% 14%, rgba(179, 222, 242, 0.28), rgba(179, 222, 242, 0) 62%),
        linear-gradient(132deg, var(--bg-0), var(--bg-1));
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .card {{
      width: min(760px, 100%);
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(2, 8, 24, 0.35);
      border: 1px solid rgba(255,255,255,0.16);
      background: linear-gradient(140deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
      backdrop-filter: blur(6px);
    }}
    .hero {{
      padding: 32px 28px 24px 28px;
    }}
    .brand-pill {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      border-radius: 999px;
      padding: 6px 10px 6px 6px;
      background: rgba(255,255,255,0.14);
    }}
    .app-icon {{
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }}
    .brand-copy {{
      display: grid;
      line-height: 1.05;
      gap: 2px;
    }}
    .brand-copy strong {{
      font-size: 13px;
      letter-spacing: 0.01em;
    }}
    .brand-copy small {{
      font-size: 11px;
      color: rgba(255,255,255,0.82);
    }}
    .badge {{
      display: inline-flex;
      max-width: 100%;
      padding: 8px 14px;
      border-radius: 999px;
      background: var(--surface-2);
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.02em;
    }}
    h1 {{
      margin: 14px 0 0;
      font-size: clamp(30px, 5.2vw, 46px);
      line-height: 1.05;
      letter-spacing: -0.01em;
    }}
    .footer {{
      background: var(--surface);
      padding: 20px 24px 24px;
      display: grid;
      gap: 16px;
    }}
    .subtitle {{
      margin: 0;
      font-size: clamp(16px, 2.9vw, 24px);
      line-height: 1.32;
      color: var(--muted);
    }}
    .info {{
      background: rgba(255,255,255,0.10);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.16);
      padding: 12px 14px;
    }}
    .info-list {{
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }}
    .info-list li {{
      display: grid;
      gap: 2px;
    }}
    .info-list span {{
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255,255,255,0.75);
    }}
    .info-list strong {{
      font-size: 16px;
      line-height: 1.2;
      color: #fff;
      font-weight: 650;
    }}
    .actions {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .button {{
      appearance: none;
      border: 0;
      border-radius: 999px;
      background: var(--cta);
      color: #fff;
      font: 700 16px/1 "SF Pro Display", "Avenir Next", "Segoe UI", system-ui, sans-serif;
      padding: 12px 18px;
      text-decoration: none;
      transition: transform 120ms ease, background-color 120ms ease;
    }}
    .button:hover {{ background: var(--cta-hover); transform: translateY(-1px); }}
    .button.secondary {{
      background: rgba(255,255,255,0.18);
      color: #fff;
      font-weight: 600;
    }}
    .button.tertiary {{
      background: rgba(255,255,255,0.09);
      color: rgba(255,255,255,0.95);
      font-weight: 600;
    }}
    .brand {{
      font-size: 13px;
      letter-spacing: 0.02em;
      color: rgba(255,255,255,0.82);
    }}
  </style>
</head>
<body>
  <article class="card">
    <header class="hero">
      <div class="brand-pill">
        <span class="app-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" role="img" aria-label="VoteNow icon">
            <rect x="1" y="1" width="26" height="26" rx="7" fill="#ADD7E5" stroke="rgba(255,255,255,0.74)" stroke-width="1.3"/>
            <rect x="14.4" y="7.2" width="8" height="2" fill="#DF5846"/>
            <rect x="14.4" y="10.6" width="8" height="2" fill="#DF5846"/>
            <rect x="14.4" y="14" width="8" height="2" fill="#DF5846"/>
            <rect x="6.2" y="17.4" width="16.2" height="2" fill="#DF5846"/>
            <rect x="6.2" y="20.8" width="16.2" height="2" fill="#DF5846"/>
          </svg>
        </span>
        <span class="brand-copy">
          <strong>VoteNow</strong>
          <small>Civic action made clear</small>
        </span>
      </div>
      <div style="height: 12px;"></div>
      <span class="badge">{safe_badge}</span>
      <h1>{safe_title}</h1>
    </header>
    <section class="footer">
      <p class="subtitle">{safe_subtitle}</p>
      {info_section_html}
      <div class="actions">
        <a class="button" id="open-app" href="{safe_deep_link}">{safe_cta}</a>
        <a class="button secondary" href="{safe_web_url}">Open in Browser</a>
        <a class="button tertiary" href="{safe_app_store_url}">Get VoteNow</a>
      </div>
      <div class="brand">VoteNow civic action card</div>
    </section>
  </article>
  <script>
    (() => {{
      const deepLink = "{safe_deep_link}";
      const fallback = "{safe_web_url}";
      const ua = navigator.userAgent || "";
      const params = new URLSearchParams(window.location.search);
      const openInWebMode = params.get("open") === "web";
      const isBot = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|whatsapp|telegram|discord|snapchat/i.test(ua);
      const isMobile = /iphone|ipad|ipod|android/i.test(ua.toLowerCase());

      const tryOpenVoteNow = () => {{
        let becameHidden = false;
        const onVisibilityChange = () => {{
          if (document.hidden) {{
            becameHidden = true;
          }}
        }};
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.location.href = deepLink;
        window.setTimeout(() => {{
          document.removeEventListener("visibilitychange", onVisibilityChange);
          if (!becameHidden) {{
            window.location.href = fallback;
          }}
        }}, 1200);
      }};

      const openButton = document.getElementById("open-app");
      if (openButton) {{
        openButton.addEventListener("click", (event) => {{
          event.preventDefault();
          tryOpenVoteNow();
        }});
      }}

      if (!isBot && isMobile && !openInWebMode) {{
        window.setTimeout(tryOpenVoteNow, 120);
      }}
    }})();
  </script>
</body>
</html>"""
        return HTMLResponse(content=html, status_code=200)
