from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .models import (
    Ask,
    AssistantResolveRequest,
    CallCompletionRequest,
    CallLaunchRequest,
    CallLogRequest,
    CallOutcome,
    LeaderboardPeriodType,
    RepTarget,
)
from .service import CivicService

service = CivicService()


def parse_resolve_request(payload: dict[str, Any]) -> AssistantResolveRequest:
    return AssistantResolveRequest(
        user_id=str(payload["user_id"]),
        concern_text=str(payload["concern_text"]),
        selected_ask=Ask(str(payload["selected_ask"])),
        target_reps=[RepTarget(str(value)) for value in payload.get("target_reps", [])],
        optional_bill_ref=payload.get("optional_bill_ref"),
    )


def parse_log_request(payload: dict[str, Any]) -> CallLogRequest:
    return CallLogRequest(
        user_id=str(payload["user_id"]),
        rep_id=str(payload["rep_id"]),
        issue_id=str(payload["issue_id"]),
        brief_id=str(payload["brief_id"]),
        outcome=CallOutcome(str(payload["outcome"])),
        staffer_position=payload.get("staffer_position"),
        notes=str(payload.get("notes", "")),
    )


def parse_launch_request(payload: dict[str, Any]) -> CallLaunchRequest:
    return CallLaunchRequest(
        user_id=str(payload["user_id"]),
        office_id=str(payload["office_id"]),
        issue_id=payload.get("issue_id"),
        source_screen=str(payload.get("source_screen", "issue_call_center")),
        session_id=payload.get("session_id"),
    )


def parse_completion_request(payload: dict[str, Any]) -> CallCompletionRequest:
    return CallCompletionRequest(
        user_id=str(payload["user_id"]),
        launch_event_id=str(payload["launch_event_id"]),
        completed=bool(payload.get("completed", True)),
    )


def parse_period_type(raw: str) -> LeaderboardPeriodType:
    return LeaderboardPeriodType(raw)


def get_examples(user_id: str) -> dict[str, Any]:
    return service.get_examples(user_id).to_dict()


def post_assistant_resolve(payload: dict[str, Any]) -> dict[str, Any]:
    response = service.resolve_assistant(parse_resolve_request(payload))
    return response.to_dict()


def post_calls_log(payload: dict[str, Any]) -> dict[str, Any]:
    return service.log_call(parse_log_request(payload))


def post_calls_launch(payload: dict[str, Any]) -> dict[str, Any]:
    return service.log_call_launch(parse_launch_request(payload))


def post_calls_confirm(payload: dict[str, Any]) -> dict[str, Any]:
    return service.confirm_call_completion(parse_completion_request(payload)).to_dict()


def get_history(user_id: str) -> dict[str, Any]:
    return service.history(user_id).to_dict()


def get_call_score_summary(user_id: str) -> dict[str, Any]:
    return service.get_call_score_summary(user_id)


def get_call_score_breakdown(user_id: str) -> dict[str, Any]:
    return service.get_call_score_breakdown(user_id)


def get_call_score_history(user_id: str, limit: int = 20) -> dict[str, Any]:
    return service.get_recent_scoring_history(user_id, limit=limit).to_dict()


def post_call_score_recompute(payload: dict[str, Any]) -> dict[str, Any]:
    user_id = str(payload["user_id"])
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


try:
    from fastapi import FastAPI, HTTPException
except Exception:  # pragma: no cover
    FastAPI = None
    HTTPException = Exception


if FastAPI is not None:
    app = FastAPI(title="VoteNow Civic API", version="1.0.0")

    @app.get("/api/v1/civic/examples")
    def civic_examples(user_id: str) -> dict[str, Any]:
        try:
            return get_examples(user_id)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/civic/assistant/resolve")
    def civic_resolve(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return post_assistant_resolve(payload)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/civic/calls/log")
    def civic_log_call(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return post_calls_log(payload)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/civic/calls/launch")
    def civic_call_launch(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return post_calls_launch(payload)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/civic/calls/confirm")
    def civic_call_confirm(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return post_calls_confirm(payload)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/civic/history")
    def civic_history(user_id: str) -> dict[str, Any]:
        try:
            return get_history(user_id)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/civic/call-score/summary")
    def civic_call_score_summary(user_id: str) -> dict[str, Any]:
        try:
            return get_call_score_summary(user_id)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/civic/call-score/breakdown")
    def civic_call_score_breakdown(user_id: str) -> dict[str, Any]:
        try:
            return get_call_score_breakdown(user_id)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/civic/call-score/history")
    def civic_call_score_history(user_id: str, limit: int = 20) -> dict[str, Any]:
        try:
            return get_call_score_history(user_id=user_id, limit=limit)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/api/v1/civic/call-score/recompute")
    def civic_call_score_recompute(payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return post_call_score_recompute(payload)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/civic/leaderboard")
    def civic_leaderboard(
        period_type: str,
        period_start: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        try:
            return get_leaderboard(period_type=period_type, period_start=period_start, limit=limit)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.get("/api/v1/civic/leaderboard/me")
    def civic_leaderboard_me(
        user_id: str,
        period_type: str,
        period_start: str | None = None,
    ) -> dict[str, Any]:
        try:
            return get_leaderboard_me(user_id=user_id, period_type=period_type, period_start=period_start)
        except ValueError as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc
