from __future__ import annotations

import unittest
import uuid
from unittest import mock

from backend.civic_api import api


class _RequestStub:
    def __init__(self, headers: dict[str, str] | None = None) -> None:
        self.headers = headers or {}


def _http_exception(status_code: int) -> Exception:
    try:
        return api.HTTPException(status_code=status_code, detail="auth error")
    except TypeError:
        # FastAPI is optional in some local test contexts.
        exc = api.HTTPException("auth error")
        setattr(exc, "status_code", status_code)
        return exc


class AuthResolutionTests(unittest.TestCase):
    def test_resolve_authenticated_or_anonymous_user_id_returns_authenticated_user_id(self) -> None:
        request = _RequestStub()
        with mock.patch.object(api, "require_authenticated_user_id", return_value="auth-user-1") as mocked:
            resolved = api.resolve_authenticated_or_anonymous_user_id(request)
        self.assertEqual(resolved, "auth-user-1")
        mocked.assert_called_once_with(request)

    def test_resolve_authenticated_or_anonymous_user_id_uses_stable_uuid5_for_401(self) -> None:
        request = _RequestStub(headers={"x-anonymous-id": "device-fingerprint-123"})
        expected = str(uuid.uuid5(uuid.NAMESPACE_DNS, "device-fingerprint-123"))

        with mock.patch.object(api, "require_authenticated_user_id", side_effect=_http_exception(401)):
            first = api.resolve_authenticated_or_anonymous_user_id(request)
        with mock.patch.object(api, "require_authenticated_user_id", side_effect=_http_exception(401)):
            second = api.resolve_authenticated_or_anonymous_user_id(request)

        self.assertEqual(first, expected)
        self.assertEqual(second, expected)

    def test_resolve_authenticated_or_anonymous_user_id_uses_stable_uuid5_for_403(self) -> None:
        request = _RequestStub(headers={"x-anonymous-id": "session-token-abc"})
        expected = str(uuid.uuid5(uuid.NAMESPACE_DNS, "session-token-abc"))

        with mock.patch.object(api, "require_authenticated_user_id", side_effect=_http_exception(403)):
            resolved = api.resolve_authenticated_or_anonymous_user_id(request)

        self.assertEqual(resolved, expected)

    def test_resolve_authenticated_or_anonymous_user_id_reraises_502(self) -> None:
        request = _RequestStub(headers={"x-anonymous-id": "device-fingerprint-123"})
        with mock.patch.object(api, "require_authenticated_user_id", side_effect=_http_exception(502)):
            with self.assertRaises(api.HTTPException) as context:
                api.resolve_authenticated_or_anonymous_user_id(request)

        exc = context.exception
        if hasattr(exc, "status_code"):
            self.assertEqual(exc.status_code, 502)

    def test_resolve_authenticated_or_anonymous_user_id_uses_ephemeral_uuid_when_header_missing(self) -> None:
        request = _RequestStub()

        with mock.patch.object(api, "require_authenticated_user_id", side_effect=_http_exception(401)):
            first = api.resolve_authenticated_or_anonymous_user_id(request)
        with mock.patch.object(api, "require_authenticated_user_id", side_effect=_http_exception(401)):
            second = api.resolve_authenticated_or_anonymous_user_id(request)

        uuid.UUID(first)
        uuid.UUID(second)
        self.assertNotEqual(first, second)


if __name__ == "__main__":
    unittest.main()
