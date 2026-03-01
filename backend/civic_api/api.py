from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .models import Ask, AssistantResolveRequest, CallLogRequest, CallOutcome, RepTarget
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


def get_examples(user_id: str) -> dict[str, Any]:
    return service.get_examples(user_id).to_dict()


def post_assistant_resolve(payload: dict[str, Any]) -> dict[str, Any]:
    response = service.resolve_assistant(parse_resolve_request(payload))
    return response.to_dict()


def post_calls_log(payload: dict[str, Any]) -> dict[str, Any]:
    return service.log_call(parse_log_request(payload))


def get_history(user_id: str) -> dict[str, Any]:
    return service.history(user_id).to_dict()


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

    @app.get("/api/v1/civic/history")
    def civic_history(user_id: str) -> dict[str, Any]:
        try:
            return get_history(user_id)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc
